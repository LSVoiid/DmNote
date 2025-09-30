import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import type { SettingsDiff, SettingsState } from "@src/types/settings";

export type SupportedLocale = "ko" | "en";

type Messages = Record<string, unknown>;

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const STORAGE_KEY = "dmnote:locale";
const DEFAULT_LOCALE: SupportedLocale = "ko";

const I18nContext = createContext<I18nContextValue | null>(null);

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return value === "ko" || value === "en";
}

function getNestedValue(messages: Messages, path: string) {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages);
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
) {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = params[key];
    return value === undefined ? "" : String(value);
  });
}

function loadPersistedLocale(): SupportedLocale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isSupportedLocale(stored)) {
      return stored;
    }
  } catch (error) {
    console.warn("Failed to read stored locale", error);
  }
  return DEFAULT_LOCALE;
}

async function importLocaleMessages(locale: SupportedLocale) {
  const mod = await import(`../locales/${locale}.json`);
  return mod.default ?? mod;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    loadPersistedLocale()
  );
  const [messages, setMessages] = useState<Messages>({});
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loadedMessages = await importLocaleMessages(locale);
        if (!cancelled) {
          setMessages(loadedMessages);
          setHasInitialized(true);
        }
      } catch (error) {
        console.error("Failed to load locale messages", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const settings: SettingsState = await window.api.settings.get();
        if (!cancelled && isSupportedLocale(settings.language)) {
          setLocaleState(settings.language);
          try {
            window.localStorage.setItem(STORAGE_KEY, settings.language);
          } catch (error) {
            console.warn("Failed to persist locale", error);
          }
          try {
            const loadedMessages = await importLocaleMessages(
              settings.language
            );
            if (!cancelled) {
              setMessages(loadedMessages);
              setHasInitialized(true);
            }
          } catch (error) {
            console.error("Failed to preload locale messages", error);
          }
        }
      } catch (error) {
        console.error("Failed to fetch initial language", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.api.settings.onChanged((diff: SettingsDiff) => {
      const next = diff.changed.language;
      if (isSupportedLocale(next)) {
        setLocaleState(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch (error) {
          console.warn("Failed to persist locale", error);
        }
      }
    });

    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.error("Failed to remove settings listener", error);
      }
    };
  }, []);

  const changeLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      console.warn("Failed to persist locale", error);
    }
    window.api.settings.update({ language: next }).catch((error) => {
      console.error("Failed to update language", error);
    });
  }, []);

  const t = useMemo(
    () =>
      function translate(
        key: string,
        params?: Record<string, string | number>
      ): string {
        const raw = getNestedValue(messages, key);
        if (typeof raw === "string") {
          return interpolate(raw, params);
        }
        if (typeof raw === "number") {
          return String(raw);
        }
        return key;
      },
    [messages]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: changeLocale,
      t,
    }),
    [locale, changeLocale, t]
  );

  if (!hasInitialized) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within I18nProvider");
  }

  return {
    t: ctx.t,
    i18n: {
      language: ctx.locale,
      changeLanguage: ctx.setLocale,
    },
  };
}
