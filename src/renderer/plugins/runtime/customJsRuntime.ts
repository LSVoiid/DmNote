import { usePluginMenuStore } from "@stores/usePluginMenuStore";
import { usePluginDisplayElementStore } from "@stores/usePluginDisplayElementStore";
import { useKeyStore } from "@stores/useKeyStore";
import { extractPluginId } from "@utils/pluginUtils";
import {
  handlerRegistry,
  displayElementInstanceRegistry,
} from "@api/pluginDisplayElements";
import { translatePluginMessage } from "@utils/pluginI18n";
import type {
  PluginDefinition,
  PluginSettingsDefinition,
  PluginSettingsInstance,
  PluginSettingSchema,
  PluginMessages,
} from "@src/types/api";
import type { JsPlugin } from "@src/types/js";

const SCRIPT_ID_PREFIX = "dmn-custom-js-";

type CleanupAwareWindow = Window & {
  __dmn_custom_js_cleanup?: () => void;
};

export interface CustomJsRuntime {
  initialize: () => void;
  dispose: () => void;
}

export function createCustomJsRuntime(): CustomJsRuntime {
  const anyWindow = window as unknown as CleanupAwareWindow;
  const activeElements = new Map<
    string,
    { element: HTMLScriptElement; cleanup?: () => void; pluginId?: string }
  >();
  const cleanupRegistry = new Map<string, (() => void)[]>();
  const unsubscribers: Array<() => void> = [];

  let enabled = false;
  let disposed = false;
  let currentPlugins: JsPlugin[] = [];

  // 전역 플래그: removeAll/injectAll 실행 중에는 저장 비활성화
  let isReloading = false;

  const safeRun = (fn?: () => void, label?: string) => {
    if (typeof fn !== "function") return;
    try {
      fn();
    } catch (error) {
      const tag = label ? ` (${label})` : "";
      console.error(`Error during custom JS cleanup${tag}`, error);
    }
  };

  const runPluginCleanups = (pluginId: string) => {
    const cleanups = cleanupRegistry.get(pluginId) || [];
    cleanups.forEach((cleanup, index) => {
      safeRun(cleanup, `${pluginId}[${index}]`);
    });
    cleanupRegistry.delete(pluginId);

    handlerRegistry.clearPlugin(pluginId);
  };

  const removeAll = () => {
    for (const [
      id,
      { element, cleanup, pluginId },
    ] of activeElements.entries()) {
      if (pluginId) {
        const previousPluginId = (window as any).__dmn_current_plugin_id;
        (window as any).__dmn_current_plugin_id = pluginId;

        runPluginCleanups(pluginId);

        if (cleanup) {
          safeRun(cleanup, id);
        }

        (window as any).__dmn_current_plugin_id = previousPluginId;
      } else if (cleanup) {
        safeRun(cleanup, id);
      }

      if (element && element.parentNode) {
        element.remove();
      }
    }
    activeElements.clear();

    if ((window as any).__dmn_window_type === "main") {
      try {
        usePluginMenuStore.getState().clearAll();
        usePluginDisplayElementStore.getState().elements = [];
        displayElementInstanceRegistry.clearAll();

        if (window.api?.bridge) {
          window.api.bridge.sendTo("overlay", "plugin:displayElements:sync", {
            elements: [],
          });
        }
      } catch (error) {
        console.error("Failed to clear plugin UI elements", error);
      }
    }
  };

  const registerCleanup = (pluginId: string, cleanup: () => void) => {
    if (typeof cleanup !== "function") {
      console.warn(`[Plugin ${pluginId}] registerCleanup requires a function`);
      return;
    }
    if (!cleanupRegistry.has(pluginId)) {
      cleanupRegistry.set(pluginId, []);
    }
    cleanupRegistry.get(pluginId)!.push(cleanup);
  };

  const injectPlugin = (plugin: JsPlugin) => {
    try {
      const previousCleanup = anyWindow.__dmn_custom_js_cleanup;
      if (previousCleanup) {
        delete anyWindow.__dmn_custom_js_cleanup;
      }

      const pluginId = extractPluginId(plugin.content, plugin.name);

      (anyWindow as any).__dmn_current_plugin_id = pluginId;

      if ((window as any).__dmn_window_type === "main") {
        try {
          usePluginMenuStore.getState().clearByPluginId(pluginId);
          usePluginDisplayElementStore.getState().clearByPluginId(pluginId);
          displayElementInstanceRegistry.clearByPluginId(pluginId);

          if (window.api?.bridge) {
            window.api.bridge.sendTo("overlay", "plugin:displayElements:sync", {
              elements: usePluginDisplayElementStore.getState().elements,
            });
          }
        } catch (error) {
          console.error(
            `Failed to clear UI elements for plugin '${pluginId}'`,
            error
          );
        }
      }

      const originalStorage = window.api.plugin.storage;

      const namespacedStorage = {
        get: async <T = any>(key: string) => {
          const prefixedKey = `${pluginId}/${key}`;
          return await originalStorage.get<T>(prefixedKey as string);
        },
        set: (key: string, value: any) =>
          originalStorage.set(`${pluginId}/${key}`, value),
        remove: (key: string) => originalStorage.remove(`${pluginId}/${key}`),
        clear: async () => {
          await originalStorage.clearByPrefix(pluginId);
        },
        keys: async () => {
          const allKeys = await originalStorage.keys();
          const prefix = `${pluginId}/`;
          return allKeys
            .filter((k) => k.startsWith(prefix))
            .map((k) => k.substring(prefix.length));
        },
        hasData: originalStorage.hasData,
        clearByPrefix: originalStorage.clearByPrefix,
      };

      const wrapFunctionWithContext = (fn: any) => {
        if (typeof fn !== "function") return fn;
        if (fn.__dmn_plugin_wrapped__) return fn;

        const wrapped = function (...args: any[]) {
          const prev = (window as any).__dmn_current_plugin_id;
          (window as any).__dmn_current_plugin_id = pluginId;
          let result: any;
          let threw = false;
          try {
            result = fn.apply(this, args);
          } catch (error) {
            threw = true;
            throw error;
          } finally {
            if (threw || !result || typeof result.then !== "function") {
              (window as any).__dmn_current_plugin_id = prev;
            }
          }

          if (result && typeof result.then === "function") {
            return result.finally(() => {
              (window as any).__dmn_current_plugin_id = prev;
            });
          }

          return result;
        };

        try {
          Object.defineProperty(wrapped, "name", {
            value: fn.name,
            configurable: true,
          });
        } catch {
          // noop
        }

        Object.defineProperty(wrapped, "__dmn_plugin_wrapped__", {
          value: true,
          configurable: false,
        });

        return wrapped;
      };

      const wrapApiValue = (value: any): any => {
        if (typeof value === "function") {
          return wrapFunctionWithContext(value);
        }

        if (value && typeof value === "object") {
          const clone: any = Array.isArray(value) ? [] : {};
          Object.keys(value).forEach((key) => {
            clone[key] = wrapApiValue(value[key]);
          });
          return clone;
        }

        return value;
      };

      const wrappedApi = wrapApiValue(window.api);

      const proxiedApi = {
        ...wrappedApi,
        window: {
          ...(wrappedApi.window || {}),
          type: (window as any).__dmn_window_type as "main" | "overlay",
        },
        plugin: {
          ...(wrappedApi.plugin || {}),
          storage: namespacedStorage,
          registerCleanup: (cleanup: () => void) =>
            registerCleanup(pluginId, cleanup),
          defineElement: (definition: PluginDefinition) => {
            const defId = pluginId;
            const internalDef = {
              ...definition,
              id: defId,
              pluginId: pluginId,
            };

            usePluginDisplayElementStore
              .getState()
              .registerDefinition(internalDef);

            const INSTANCES_KEY = "instances";

            // 복원 중에는 saveInstances가 호출되지 않도록 플래그 설정
            let isRestoring = true;

            const saveInstances = async () => {
              // 전역 리로드 중이거나 개별 복원 중에는 저장하지 않음
              if (isReloading || isRestoring) return;

              const elements = usePluginDisplayElementStore
                .getState()
                .elements.filter((el) => el.definitionId === defId);

              const instances = elements.map((el) => ({
                position: el.position,
                settings: el.settings,
                measuredSize: el.measuredSize,
                tabId: el.tabId,
              }));

              await namespacedStorage.set(INSTANCES_KEY, instances);
            };

            if ((window as any).__dmn_window_type === "main") {
              const unsubStore = usePluginDisplayElementStore.subscribe(
                (state, prevState) => {
                  const currentElements = state.elements.filter(
                    (el) => el.definitionId === defId
                  );
                  const prevElements = prevState.elements.filter(
                    (el) => el.definitionId === defId
                  );

                  if (
                    JSON.stringify(currentElements) !==
                    JSON.stringify(prevElements)
                  ) {
                    saveInstances();
                  }
                }
              );
              registerCleanup(pluginId, unsubStore);
            }

            const defaultSettings: Record<string, any> = {};
            if (definition.settings) {
              Object.entries(definition.settings).forEach(
                ([key, schema]: [string, any]) => {
                  defaultSettings[key] = schema.default;
                }
              );
            }

            let currentLocale = "ko";
            const applyLocale = (next?: string) => {
              if (typeof next === "string" && next.trim().length > 0) {
                currentLocale = next;
              }
            };

            if (window.api?.i18n?.getLocale) {
              window.api.i18n
                .getLocale()
                .then(applyLocale)
                .catch(() => undefined);
            } else if (window.api?.settings?.get) {
              window.api.settings
                .get()
                .then((settings) => applyLocale((settings as any)?.language))
                .catch(() => undefined);
            }

            let localeCleanup: (() => void) | null = null;
            if (window.api?.i18n?.onLocaleChange) {
              localeCleanup = window.api.i18n.onLocaleChange(applyLocale);
              if (localeCleanup) {
                registerCleanup(pluginId, () => {
                  try {
                    localeCleanup && localeCleanup();
                  } catch (error) {
                    console.error(
                      `[Plugin ${pluginId}] Failed to cleanup locale listener`,
                      error
                    );
                  }
                });
              }
            }

            const translate = (
              key?: string,
              params?: Record<string, string | number>,
              fallback?: string
            ) =>
              translatePluginMessage({
                messages: definition.messages,
                locale: currentLocale,
                key,
                params,
                fallback,
              });

            const buildActionsProxy = (elementId: string) =>
              new Proxy(
                {},
                {
                  get: (_target, prop: string | symbol) => {
                    if (typeof prop !== "string") return undefined;
                    return (...args: any[]) => {
                      try {
                        window.api?.bridge?.sendTo(
                          "overlay",
                          "plugin:displayElement:invokeAction",
                          {
                            elementId,
                            action: prop,
                            args,
                          }
                        );
                      } catch (error) {
                        console.error(
                          `[Plugin ${pluginId}] Failed to invoke exposed action '${String(
                            prop
                          )}'`,
                          error
                        );
                      }
                    };
                  },
                }
              );

            const buildCustomContextMenuItems = () =>
              (definition.contextMenu?.items || []).map((item, index) => ({
                id: item.action || `custom-${index}`,
                label: item.label,
                position: item.position,
                visible: item.visible,
                disabled: item.disabled,
                onClick: (ctx: any) => {
                  const actions =
                    ctx?.actions ||
                    buildActionsProxy(ctx?.element?.fullId || "");

                  if (typeof item.onClick === "function") {
                    return item.onClick({ ...ctx, actions });
                  }

                  if (
                    item.action &&
                    typeof (actions as any)[item.action] === "function"
                  ) {
                    return (actions as any)[item.action]();
                  }
                },
              }));

            const openInstanceSettings = async (instanceId: string) => {
              const element = usePluginDisplayElementStore
                .getState()
                .elements.find((el) => el.fullId === instanceId);

              if (!element) {
                console.warn(
                  `[Plugin ${pluginId}] Cannot find element ${instanceId} for settings`
                );
                return;
              }

              const currentSettings = {
                ...defaultSettings,
                ...(element.settings || {}),
              };
              const originalSettings = { ...currentSettings };

              let htmlContent =
                '<div class="flex flex-col gap-[19px] w-full text-left">';

              if (definition.settings) {
                for (const [key, schema] of Object.entries(
                  definition.settings
                )) {
                  const value =
                    currentSettings[key] !== undefined
                      ? currentSettings[key]
                      : schema.default;
                  let componentHtml = "";
                  const labelText = translate(
                    schema.label,
                    undefined,
                    schema.label
                  );
                  const placeholderText =
                    typeof schema.placeholder === "string"
                      ? translate(
                          schema.placeholder,
                          undefined,
                          schema.placeholder
                        )
                      : schema.placeholder;

                  const handleChange = async (newValue: any) => {
                    currentSettings[key] = newValue;
                    const newSettings = { ...currentSettings };

                    window.api.ui.displayElement.update(instanceId, {
                      settings: newSettings,
                    });
                  };

                  const wrappedChange = wrapFunctionWithContext(handleChange);

                  if (schema.type === "boolean") {
                    componentHtml = window.api.ui.components.checkbox({
                      checked: !!value,
                      onChange: wrappedChange,
                    });
                  } else if (schema.type === "color") {
                    const handleColorClick = (e: any) => {
                      const target = (e.target as HTMLElement).closest(
                        "button"
                      );
                      if (!target) return;

                      const pickerId = `plugin-${pluginId}-${instanceId}-${key}`;

                      if (
                        (window as any).__dmn_showColorPicker &&
                        (window as any).__dmn_getColorPickerState
                      ) {
                        const state = (
                          window as any
                        ).__dmn_getColorPickerState();
                        if (state?.isOpen && state.id === pickerId) {
                          (window as any).__dmn_showColorPicker({
                            initialColor: state.color,
                            id: pickerId,
                          });
                          return;
                        }
                      }

                      target.classList.remove("border-[#3A3943]");
                      target.classList.add("border-[#459BF8]");

                      window.api.ui.pickColor({
                        initialColor: currentSettings[key],
                        id: pickerId,
                        referenceElement: target as HTMLElement,
                        onColorChange: (newColor) => {
                          const preview = target.querySelector("div");
                          if (preview) preview.style.backgroundColor = newColor;
                        },
                        onColorChangeComplete: (newColor) => {
                          wrappedChange(newColor);
                        },
                        onClose: () => {
                          target.classList.remove("border-[#459BF8]");
                          target.classList.add("border-[#3A3943]");
                        },
                      });
                    };

                    const handlerId = handlerRegistry.register(
                      pluginId,
                      handleColorClick
                    );

                    componentHtml = `
                            <button type="button" 
                              class="relative w-[80px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-2"
                              data-plugin-handler="${handlerId}"
                            >
                              <div class="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]" style="background-color: ${value}"></div>
                              <span class="ml-[16px] text-left truncate w-[50px]">Linear</span>
                            </button>
                          `;
                  } else if (
                    schema.type === "string" ||
                    schema.type === "number"
                  ) {
                    let inputWidth = 200;
                    const strVal = String(value);

                    if (schema.type === "number") {
                      inputWidth = 60;
                    } else {
                      if (strVal.length <= 4) inputWidth = 60;
                      else if (strVal.length <= 10) inputWidth = 100;
                      else inputWidth = 200;
                    }

                    componentHtml = window.api.ui.components.input({
                      type:
                        schema.type === "string"
                          ? "text"
                          : (schema.type as any),
                      value: value,
                      onChange: wrappedChange,
                      min: schema.min,
                      max: schema.max,
                      step: schema.step,
                      placeholder: placeholderText,
                      width: inputWidth,
                    });
                  } else if (schema.type === "select") {
                    const translatedOptions = (schema.options || []).map(
                      (option: { label: string; value: any }) => ({
                        ...option,
                        label: translate(option.label, undefined, option.label),
                      })
                    );
                    componentHtml = window.api.ui.components.dropdown({
                      options: translatedOptions,
                      selected: value,
                      onChange: wrappedChange,
                    });
                  }

                  htmlContent += `
                          <div class="flex justify-between w-full items-center">
                            <p class="text-white text-style-2">${labelText}</p>
                            ${componentHtml}
                          </div>
                        `;
                }
              } else {
                const noSettingsText = await window.api.settings
                  .get()
                  .then((s) => {
                    const locale = (s as any).language || "ko";
                    return locale === "en"
                      ? "No settings available."
                      : "설정할 항목이 없습니다.";
                  })
                  .catch(() => "설정할 항목이 없습니다.");
                htmlContent += `<div class="text-gray-400 text-center">${noSettingsText}</div>`;
              }

              htmlContent += "</div>";

              const [saveText, cancelText] = await window.api.settings
                .get()
                .then((s) => {
                  const locale = (s as any).language || "ko";
                  return locale === "en"
                    ? ["Apply", "Cancel"]
                    : ["저장", "취소"];
                })
                .catch(() => ["저장", "취소"]);

              const confirmed = await window.api.ui.dialog.custom(htmlContent, {
                showCancel: true,
                confirmText: saveText,
                cancelText: cancelText,
              });

              if (!confirmed) {
                window.api.ui.displayElement.update(instanceId, {
                  settings: originalSettings,
                });
              }
            };

            const handleElementClick = (e: Event) => {
              const target = e.currentTarget as HTMLElement;
              const instanceId = target.getAttribute("data-plugin-element");
              if (instanceId) {
                openInstanceSettings(instanceId);
              }
            };

            if ((window as any).__dmn_window_type === "main") {
              const createLabel =
                definition.contextMenu?.create || `${definition.name} 생성`;

              // maxInstances 제한 체크를 위한 헬퍼 함수 (현재 탭 기준)
              const getInstanceCountForTab = (tabId: string) => {
                return usePluginDisplayElementStore
                  .getState()
                  .elements.filter(
                    (el) => el.definitionId === defId && el.tabId === tabId
                  ).length;
              };

              const menuId = window.api.ui.contextMenu.addGridMenuItem({
                id: `create-${defId}`,
                label: createLabel,
                // maxInstances 제한 도달 시 메뉴 비활성화 (현재 탭 기준)
                disabled: () => {
                  const maxInstances = definition.maxInstances;
                  if (!maxInstances || maxInstances <= 0) return false;
                  const currentTabId = useKeyStore.getState().selectedKeyType;
                  return getInstanceCountForTab(currentTabId) >= maxInstances;
                },
                onClick: async (context) => {
                  // 클릭 시에도 한 번 더 체크 (동시 클릭 방지, 현재 탭 기준)
                  const maxInstances = definition.maxInstances;
                  if (maxInstances && maxInstances > 0) {
                    const currentTabId = useKeyStore.getState().selectedKeyType;
                    if (getInstanceCountForTab(currentTabId) >= maxInstances) {
                      console.warn(
                        `[Plugin ${pluginId}] Max instances (${maxInstances}) reached for ${defId} in tab ${currentTabId}`
                      );
                      return;
                    }
                  }

                  window.api.ui.displayElement.add({
                    html: "<!-- plugin-element -->",
                    position: {
                      x: context.position.dx,
                      y: context.position.dy,
                    },
                    draggable: true,
                    definitionId: defId,
                    settings: { ...defaultSettings },
                    state: definition.previewState || {},
                    onClick: handleElementClick,
                    contextMenu: {
                      enableDelete: true,
                      deleteLabel: definition.contextMenu?.delete || "삭제",
                      customItems: buildCustomContextMenuItems(),
                    },
                  } as any);
                },
              });

              registerCleanup(pluginId, () => {
                window.api.ui.contextMenu.removeMenuItem(menuId);
              });
            }

            setTimeout(async () => {
              try {
                if ((window as any).__dmn_window_type === "main") {
                  const savedInstances = (await namespacedStorage.get(
                    INSTANCES_KEY
                  )) as any[];

                  if (savedInstances && Array.isArray(savedInstances)) {
                    // maxInstances 제한 적용: 탭별로 제한 개수만큼만 복원
                    const maxInstances = definition.maxInstances;
                    let instancesToRestore = savedInstances;

                    if (maxInstances && maxInstances > 0) {
                      // 탭별로 그룹화
                      const instancesByTab = new Map<string, any[]>();
                      savedInstances.forEach((inst) => {
                        const tabId = inst.tabId || "4key"; // 기본 탭
                        if (!instancesByTab.has(tabId)) {
                          instancesByTab.set(tabId, []);
                        }
                        instancesByTab.get(tabId)!.push(inst);
                      });

                      // 각 탭별로 maxInstances만큼만 선택
                      instancesToRestore = [];
                      instancesByTab.forEach((instances) => {
                        instancesToRestore.push(
                          ...instances.slice(0, maxInstances)
                        );
                      });
                    }

                    instancesToRestore.forEach((inst) => {
                      // 각 add 호출 직전에 plugin context 재설정 (async race condition 방지)
                      (window as any).__dmn_current_plugin_id = pluginId;

                      window.api.ui.displayElement.add({
                        html: "<!-- plugin-element -->",
                        position: inst.position,
                        draggable: true,
                        definitionId: defId,
                        settings: inst.settings || { ...defaultSettings },
                        state: definition.previewState || {},
                        measuredSize: inst.measuredSize,
                        tabId: inst.tabId,
                        onClick: handleElementClick,
                        contextMenu: {
                          enableDelete: true,
                          deleteLabel: definition.contextMenu?.delete || "삭제",
                          customItems: buildCustomContextMenuItems(),
                        },
                      } as any);
                    });
                  }
                }
              } catch (err) {
                console.error(
                  `[Plugin ${pluginId}] Failed to restore instances:`,
                  err
                );
              } finally {
                isRestoring = false;
              }
            }, 0);
          },
          defineSettings: (
            definition: PluginSettingsDefinition
          ): PluginSettingsInstance => {
            const SETTINGS_KEY = "__plugin_settings__";

            // 기본값 계산
            const defaultSettings: Record<string, any> = {};
            if (definition.settings) {
              for (const [key, schema] of Object.entries(definition.settings)) {
                defaultSettings[key] = schema.default;
              }
            }

            // 현재 설정값 (메모리 캐시)
            let currentSettings: Record<string, any> = { ...defaultSettings };
            let isInitialized = false;

            // 설정 변경 구독자 목록
            const subscribers: Set<
              (
                newSettings: Record<string, any>,
                oldSettings: Record<string, any>
              ) => void
            > = new Set();

            // 모든 구독자에게 변경 알림
            const notifySubscribers = (
              newSettings: Record<string, any>,
              oldSettings: Record<string, any>
            ) => {
              subscribers.forEach((listener) => {
                try {
                  listener(newSettings, oldSettings);
                } catch (err) {
                  console.error(
                    `[Plugin ${pluginId}] Error in settings subscriber:`,
                    err
                  );
                }
              });
            };

            // 같은 플러그인의 모든 패널 리렌더링 트리거
            const triggerPanelRerender = () => {
              const elements = usePluginDisplayElementStore
                .getState()
                .elements.filter((el) => el.pluginId === pluginId);

              elements.forEach((el) => {
                // state에 _settingsVersion을 증가시켜 리렌더링 트리거
                const currentState = el.state || {};
                const version = (currentState._settingsVersion || 0) + 1;
                usePluginDisplayElementStore
                  .getState()
                  .updateElement(el.fullId, {
                    state: { ...currentState, _settingsVersion: version },
                  });
              });
            };

            // 오버레이에 설정 변경 알림 (메인 → 오버레이 동기화)
            const notifyOverlay = (newSettings: Record<string, any>) => {
              if ((window as any).__dmn_window_type === "main") {
                try {
                  // JSON 직렬화/역직렬화로 순수 데이터만 복사 (순환 참조 및 특수 객체 제거)
                  const safeSettings = JSON.parse(JSON.stringify(newSettings));

                  window.api?.bridge?.sendTo(
                    "overlay",
                    "plugin:settings:changed",
                    {
                      pluginId,
                      settings: safeSettings,
                    }
                  );
                } catch (err) {
                  console.error(
                    `[Plugin ${pluginId}] Failed to notify overlay:`,
                    err
                  );
                }
              }
            };

            // 번역 함수
            const translate = (
              key: string,
              params?: Record<string, string | number>,
              fallback?: string
            ): string => {
              if (!definition.messages) return fallback || key;
              return translatePluginMessage({
                messages: definition.messages,
                locale: (window as any).__dmn_current_locale || "ko",
                key,
                params,
                fallback,
              });
            };

            // 플러그인 컨텍스트에서 함수 실행하도록 래핑
            const wrapFunctionWithContext = (fn: (...args: any[]) => any) => {
              const wrapped = (...args: any[]) => {
                const prev = (window as any).__dmn_current_plugin_id;
                (window as any).__dmn_current_plugin_id = pluginId;
                try {
                  return fn(...args);
                } finally {
                  (window as any).__dmn_current_plugin_id = prev;
                }
              };
              return handlerRegistry.register(pluginId, wrapped);
            };

            // storage에서 설정 로드
            const loadSettings = async (): Promise<void> => {
              try {
                const saved = await namespacedStorage.get(SETTINGS_KEY);
                if (saved && typeof saved === "object") {
                  currentSettings = { ...defaultSettings, ...saved };
                }
                isInitialized = true;
              } catch (err) {
                console.error(
                  `[Plugin ${pluginId}] Failed to load settings:`,
                  err
                );
                isInitialized = true;
              }
            };

            // storage에 설정 저장
            const saveSettings = async (): Promise<void> => {
              try {
                await namespacedStorage.set(SETTINGS_KEY, currentSettings);
              } catch (err) {
                console.error(
                  `[Plugin ${pluginId}] Failed to save settings:`,
                  err
                );
              }
            };

            // 설정 다이얼로그 열기
            const openSettingsDialog = async (): Promise<boolean> => {
              if (!isInitialized) {
                await loadSettings();
              }

              const dialogSettings = { ...currentSettings };
              const originalSettings = { ...currentSettings };

              // 실시간 미리보기 적용 함수
              const applyPreview = (newSettings: Record<string, any>) => {
                currentSettings = { ...newSettings };
                triggerPanelRerender();
                notifyOverlay(currentSettings);
              };

              let htmlContent =
                '<div class="flex flex-col gap-[19px] w-full text-left">';

              if (
                definition.settings &&
                Object.keys(definition.settings).length > 0
              ) {
                for (const [key, schema] of Object.entries(
                  definition.settings
                )) {
                  const value =
                    dialogSettings[key] !== undefined
                      ? dialogSettings[key]
                      : schema.default;
                  let componentHtml = "";
                  const labelText = translate(
                    schema.label,
                    undefined,
                    schema.label
                  );
                  const placeholderText =
                    typeof schema.placeholder === "string"
                      ? translate(
                          schema.placeholder,
                          undefined,
                          schema.placeholder
                        )
                      : schema.placeholder;

                  const handleChange = (newValue: any) => {
                    // 플러그인 컨텍스트 설정
                    const prev = (window as any).__dmn_current_plugin_id;
                    (window as any).__dmn_current_plugin_id = pluginId;
                    try {
                      dialogSettings[key] = newValue;
                      // 실시간 미리보기 적용
                      applyPreview(dialogSettings);
                    } finally {
                      (window as any).__dmn_current_plugin_id = prev;
                    }
                  };

                  // createInput/checkbox/dropdown에 함수 직접 전달 (자동 래핑됨)

                  if (schema.type === "boolean") {
                    componentHtml = window.api.ui.components.checkbox({
                      checked: !!value,
                      onChange: handleChange,
                    });
                  } else if (schema.type === "color") {
                    const handleColorClick = (e: any) => {
                      const target = (e.target as HTMLElement).closest(
                        "button"
                      );
                      if (!target) return;

                      const pickerId = `plugin-settings-${pluginId}-${key}`;

                      if (
                        (window as any).__dmn_showColorPicker &&
                        (window as any).__dmn_getColorPickerState
                      ) {
                        const state = (
                          window as any
                        ).__dmn_getColorPickerState();
                        if (state?.isOpen && state.id === pickerId) {
                          (window as any).__dmn_showColorPicker({
                            initialColor: state.color,
                            id: pickerId,
                          });
                          return;
                        }
                      }

                      target.classList.remove("border-[#3A3943]");
                      target.classList.add("border-[#459BF8]");

                      window.api.ui.pickColor({
                        initialColor: dialogSettings[key],
                        id: pickerId,
                        referenceElement: target as HTMLElement,
                        onColorChange: (newColor) => {
                          // 컬러피커 프리뷰만 업데이트 (버튼 내 색상 미리보기)
                          const preview = target.querySelector("div");
                          if (preview) preview.style.backgroundColor = newColor;
                        },
                        onColorChangeComplete: (newColor) => {
                          // 마우스를 떼었을 때 실제 적용
                          dialogSettings[key] = newColor;
                          applyPreview(dialogSettings);
                        },
                        onClose: () => {
                          target.classList.remove("border-[#459BF8]");
                          target.classList.add("border-[#3A3943]");
                        },
                      });
                    };

                    const handlerId = handlerRegistry.register(
                      pluginId,
                      handleColorClick
                    );

                    componentHtml = `
                      <button type="button" 
                        class="relative w-[80px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-2"
                        data-plugin-handler="${handlerId}"
                      >
                        <div class="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]" style="background-color: ${value}"></div>
                        <span class="ml-[16px] text-left truncate w-[50px]">Linear</span>
                      </button>
                    `;
                  } else if (
                    schema.type === "string" ||
                    schema.type === "number"
                  ) {
                    let inputWidth = 200;
                    const strVal = String(value);

                    if (schema.type === "number") {
                      inputWidth = 60;
                    } else {
                      if (strVal.length <= 4) inputWidth = 60;
                      else if (strVal.length <= 10) inputWidth = 100;
                      else inputWidth = 200;
                    }

                    componentHtml = window.api.ui.components.input({
                      type:
                        schema.type === "string"
                          ? "text"
                          : (schema.type as any),
                      value: value,
                      onChange: handleChange,
                      min: schema.min,
                      max: schema.max,
                      step: schema.step,
                      placeholder: placeholderText,
                      width: inputWidth,
                    });
                  } else if (schema.type === "select") {
                    const translatedOptions = (schema.options || []).map(
                      (option: { label: string; value: any }) => ({
                        ...option,
                        label: translate(option.label, undefined, option.label),
                      })
                    );
                    componentHtml = window.api.ui.components.dropdown({
                      options: translatedOptions,
                      selected: value,
                      onChange: handleChange,
                    });
                  }

                  htmlContent += `
                    <div class="flex justify-between w-full items-center">
                      <p class="text-white text-style-2">${labelText}</p>
                      ${componentHtml}
                    </div>
                  `;
                }
              } else {
                const noSettingsText = await window.api.settings
                  .get()
                  .then((s) => {
                    const locale = (s as any).language || "ko";
                    return locale === "en"
                      ? "No settings available."
                      : "설정할 항목이 없습니다.";
                  })
                  .catch(() => "설정할 항목이 없습니다.");
                htmlContent += `<div class="text-gray-400 text-center">${noSettingsText}</div>`;
              }

              htmlContent += "</div>";

              const [saveText, cancelText] = await window.api.settings
                .get()
                .then((s) => {
                  const locale = (s as any).language || "ko";
                  return locale === "en"
                    ? ["Apply", "Cancel"]
                    : ["저장", "취소"];
                })
                .catch(() => ["저장", "취소"]);

              const confirmed = await window.api.ui.dialog.custom(htmlContent, {
                showCancel: true,
                confirmText: saveText,
                cancelText: cancelText,
              });

              if (confirmed) {
                // 확인: 현재 설정을 저장 (미리보기 상태가 이미 currentSettings에 반영됨)
                await saveSettings();

                // onChange 콜백 호출
                if (definition.onChange) {
                  try {
                    definition.onChange(currentSettings, originalSettings);
                  } catch (err) {
                    console.error(
                      `[Plugin ${pluginId}] Error in onChange callback:`,
                      err
                    );
                  }
                }

                // 구독자에게 알림
                notifySubscribers(currentSettings, originalSettings);

                return true;
              } else {
                // 취소: 원래 설정으로 복원
                currentSettings = { ...originalSettings };
                triggerPanelRerender();
                notifyOverlay(currentSettings);

                return false;
              }
            };

            // 오버레이에서 설정 변경 메시지 수신 리스너
            if ((window as any).__dmn_window_type === "overlay") {
              const bridgeCleanup = window.api?.bridge?.on(
                "plugin:settings:changed",
                (data: { pluginId: string; settings: Record<string, any> }) => {
                  if (data.pluginId === pluginId) {
                    const oldSettings = { ...currentSettings };
                    currentSettings = { ...defaultSettings, ...data.settings };

                    // onChange 콜백 호출
                    if (definition.onChange) {
                      try {
                        definition.onChange(currentSettings, oldSettings);
                      } catch (err) {
                        console.error(
                          `[Plugin ${pluginId}] Error in onChange callback:`,
                          err
                        );
                      }
                    }

                    // 구독자에게 알림
                    notifySubscribers(currentSettings, oldSettings);

                    // 패널 리렌더링 트리거
                    triggerPanelRerender();
                  }
                }
              );

              if (bridgeCleanup) {
                registerCleanup(pluginId, bridgeCleanup);
              }
            }

            // 초기 설정 로드 (비동기)
            loadSettings();

            // PluginSettingsInstance 반환
            const instance: PluginSettingsInstance = {
              get: () => {
                return { ...currentSettings };
              },
              set: async (updates: Record<string, any>) => {
                const oldSettings = { ...currentSettings };
                currentSettings = { ...currentSettings, ...updates };
                await saveSettings();

                // onChange 콜백 호출
                if (definition.onChange) {
                  try {
                    definition.onChange(currentSettings, oldSettings);
                  } catch (err) {
                    console.error(
                      `[Plugin ${pluginId}] Error in onChange callback:`,
                      err
                    );
                  }
                }

                // 구독자에게 알림
                notifySubscribers(currentSettings, oldSettings);

                // 같은 플러그인의 패널 리렌더링
                triggerPanelRerender();

                // 오버레이에 설정 변경 알림
                notifyOverlay(currentSettings);
              },
              open: openSettingsDialog,
              reset: async () => {
                const oldSettings = { ...currentSettings };
                currentSettings = { ...defaultSettings };
                await saveSettings();

                // onChange 콜백 호출
                if (definition.onChange) {
                  try {
                    definition.onChange(currentSettings, oldSettings);
                  } catch (err) {
                    console.error(
                      `[Plugin ${pluginId}] Error in onChange callback:`,
                      err
                    );
                  }
                }

                // 구독자에게 알림
                notifySubscribers(currentSettings, oldSettings);

                // 같은 플러그인의 패널 리렌더링
                triggerPanelRerender();

                // 오버레이에 설정 변경 알림
                notifyOverlay(currentSettings);
              },
              subscribe: (
                listener: (
                  newSettings: Record<string, any>,
                  oldSettings: Record<string, any>
                ) => void
              ) => {
                subscribers.add(listener);
                return () => {
                  subscribers.delete(listener);
                };
              },
            };

            return instance;
          },
        },
      } as typeof window.api;

      const proxyWindow = new Proxy(window, {
        get(target, prop: string | symbol, receiver) {
          if (prop === "api") return proxiedApi;
          if (prop === "dmn") return proxiedApi; // dmn 별칭도 프록시된 API 반환
          return Reflect.get(target as any, prop, receiver);
        },
        set(target, prop: string | symbol, value, receiver) {
          return Reflect.set(target as any, prop, value, receiver);
        },
      });

      (anyWindow as any).__dmn_plugin_window_proxy = proxyWindow;

      const wrappedContent = `
            ;(function(window){
              'use strict';
              const __PLUGIN_ID__ = "${pluginId}";
              
              // dmn을 전역 변수로 추가 (window. 없이 바로 접근 가능)
              const dmn = window.api;
              if (typeof globalThis !== 'undefined') {
                globalThis.dmn = window.api;
              }
              
              const __autoWrapAsync__ = () => {
                const globalWindow = typeof window !== 'undefined' ? window : globalThis;
                const snapshot = Object.getOwnPropertyNames(globalWindow);
                
                snapshot.forEach(key => {
                  try {
                    const value = globalWindow[key];
                    
                    if (typeof value !== 'function') return;
                    if (value.__dmn_wrapped__ || value.__dmn_plugin_wrapped__) return;
                    
                    if (key.startsWith('__dmn') || key === 'eval' || key === 'Function') return;
                    
                    const isAsync = value.constructor.name === 'AsyncFunction';
                    
                    if (isAsync) {
                      const wrapped = async function(...args) {
                        const prev = globalWindow.__dmn_current_plugin_id;
                        globalWindow.__dmn_current_plugin_id = __PLUGIN_ID__;
                        try {
                          return await value.apply(this, args);
                        } finally {
                          globalWindow.__dmn_current_plugin_id = prev;
                        }
                      };
                      wrapped.__dmn_wrapped__ = true;
                      try {
                        Object.defineProperty(wrapped, 'name', { value: key, configurable: true });
                      } catch {}
                      globalWindow[key] = wrapped;
                    }
                  } catch (e) {
                  }
                });
              };
              
              try {
                // User code is automatically wrapped in a function scope for isolation
                (function(){
            ${plugin.content}
                })();
              } catch (e) {
                console.error('Failed to run JS plugin: ${plugin.name}', e);
              }
              
              __autoWrapAsync__();
            })(window.__dmn_plugin_window_proxy);
            `;

      const element = document.createElement("script");
      element.id = `${SCRIPT_ID_PREFIX}${plugin.id}`;
      element.type = "text/javascript";
      element.textContent = wrappedContent;
      document.head.appendChild(element);

      const pluginCleanup = anyWindow.__dmn_custom_js_cleanup;

      try {
        delete (anyWindow as any).__dmn_plugin_window_proxy;
        delete (anyWindow as any).__dmn_current_plugin_id;
      } catch {
        // noop
      }

      if (previousCleanup) {
        anyWindow.__dmn_custom_js_cleanup = previousCleanup;
      } else {
        delete anyWindow.__dmn_custom_js_cleanup;
      }

      activeElements.set(plugin.id, {
        element,
        cleanup:
          typeof pluginCleanup === "function" ? pluginCleanup : undefined,
        pluginId,
      });
    } catch (error) {
      console.error(`Failed to inject JS plugin '${plugin.name}'`, error);
    }
  };

  const injectAll = () => {
    isReloading = true;
    removeAll();
    if (!enabled) {
      isReloading = false;
      return;
    }

    currentPlugins
      .filter((plugin) => plugin.enabled && plugin.content)
      .forEach((plugin) => injectPlugin(plugin));

    // 모든 플러그인의 복원이 완료될 때까지 딜레이 후 리로드 플래그 해제
    setTimeout(() => {
      isReloading = false;
    }, 100);
  };

  const syncPlugins = (next: JsPlugin[]) => {
    currentPlugins = next.map((plugin) => ({ ...plugin }));
    if (enabled) {
      injectAll();
    } else {
      removeAll();
    }
  };

  const fetchInitialState = () => {
    window.api.js
      .get()
      .then((data) => {
        if (disposed) return;
        syncPlugins(Array.isArray(data.plugins) ? data.plugins : []);
      })
      .catch((error) => {
        console.error("Failed to fetch JS plugins", error);
      });

    window.api.js
      .getUse()
      .then((value) => {
        if (disposed) return;
        enabled = value;
        if (enabled) {
          injectAll();
        } else {
          removeAll();
        }
      })
      .catch((error) => {
        console.error("Failed to fetch JS plugin toggle state", error);
      });
  };

  const setupListeners = () => {
    const unsubUse = window.api.js.onUse(({ enabled: next }) => {
      enabled = next;
      if (enabled) {
        injectAll();
      } else {
        removeAll();
      }
    });

    const unsubState = window.api.js.onState((payload) => {
      syncPlugins(Array.isArray(payload.plugins) ? payload.plugins : []);
    });

    unsubscribers.push(unsubUse, unsubState);
  };

  const cleanupSubscriptions = () => {
    while (unsubscribers.length) {
      const unsubscribe = unsubscribers.pop();
      if (unsubscribe) {
        safeRun(() => unsubscribe());
      }
    }
  };

  const initialize = () => {
    fetchInitialState();
    setupListeners();
  };

  const dispose = () => {
    disposed = true;
    cleanupSubscriptions();
    removeAll();
  };

  return { initialize, dispose };
}
