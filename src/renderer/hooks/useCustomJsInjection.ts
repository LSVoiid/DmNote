import { useEffect } from "react";
import type { JsPlugin } from "@src/types/js";

const SCRIPT_ID_PREFIX = "dmn-custom-js-";

type CleanupAwareWindow = Window & {
  __dmn_custom_js_cleanup?: () => void;
};

export function useCustomJsInjection() {
  useEffect(() => {
    const anyWindow = window as unknown as CleanupAwareWindow;
    const activeElements = new Map<
      string,
      { element: HTMLScriptElement; cleanup?: () => void }
    >();
    let enabled = false;
    let disposed = false;
    let currentPlugins: JsPlugin[] = [];

    const safeRun = (fn?: () => void, label?: string) => {
      if (typeof fn !== "function") return;
      try {
        fn();
      } catch (error) {
        const tag = label ? ` (${label})` : "";
        console.error(`Error during custom JS cleanup${tag}`, error);
      }
    };

    const removeAll = () => {
      for (const [id, { element, cleanup }] of activeElements.entries()) {
        safeRun(cleanup, id);
        if (element && element.parentNode) {
          element.remove();
        }
      }
      activeElements.clear();
    };

    const injectAll = () => {
      removeAll();
      if (!enabled) return;

      currentPlugins
        .filter((plugin) => plugin.enabled && plugin.content)
        .forEach((plugin) => {
          try {
            const previousCleanup = anyWindow.__dmn_custom_js_cleanup;
            if (previousCleanup) {
              delete anyWindow.__dmn_custom_js_cleanup;
            }

            const element = document.createElement("script");
            element.id = `${SCRIPT_ID_PREFIX}${plugin.id}`;
            element.type = "text/javascript";
            element.textContent = plugin.content;
            document.head.appendChild(element);

            const pluginCleanup = anyWindow.__dmn_custom_js_cleanup;

            if (previousCleanup) {
              anyWindow.__dmn_custom_js_cleanup = previousCleanup;
            } else {
              delete anyWindow.__dmn_custom_js_cleanup;
            }

            activeElements.set(plugin.id, {
              element,
              cleanup:
                typeof pluginCleanup === "function" ? pluginCleanup : undefined,
            });
          } catch (error) {
            console.error(`Failed to inject JS plugin '${plugin.name}'`, error);
          }
        });
    };

    const syncPlugins = (next: JsPlugin[]) => {
      currentPlugins = next.map((plugin) => ({ ...plugin }));
      if (enabled) {
        injectAll();
      } else {
        removeAll();
      }
    };

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

    return () => {
      disposed = true;
      try {
        unsubUse();
      } catch (error) {
        console.error("Failed to unsubscribe JS use handler", error);
      }
      try {
        unsubState();
      } catch (error) {
        console.error("Failed to unsubscribe JS state handler", error);
      }
      removeAll();
    };
  }, []);
}
