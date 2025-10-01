import Store from "electron-store";
import {
  appStoreDefaults,
  appStoreSchema,
  AppStoreSchema,
} from "@main/store/schema";
import { normalizeNoteSettings } from "@src/types/noteSettings";
import { DEFAULT_KEYS } from "@main/domains/keys/defaults";
import { DEFAULT_POSITIONS } from "@main/domains/positions/defaults";

export class AppStore extends Store<AppStoreSchema> {
  constructor() {
    super({
      defaults: appStoreDefaults,
    });
  }

  private snapshot(): AppStoreSchema {
    // electron-store exposes internal state via the undocumented `store` field.
    const raw = (this as unknown as { store: Partial<AppStoreSchema> }).store;
    return {
      ...appStoreDefaults,
      ...raw,
    } as AppStoreSchema;
  }

  getState(): AppStoreSchema {
    const snapshot = this.snapshot();
    const parsed = appStoreSchema.safeParse(snapshot);
    if (parsed.success) {
      return parsed.data;
    }

    const repaired: AppStoreSchema = {
      ...appStoreDefaults,
      ...snapshot,
      noteSettings: normalizeNoteSettings(snapshot.noteSettings),
      keys: snapshot.keys ?? DEFAULT_KEYS,
      keyPositions: snapshot.keyPositions ?? DEFAULT_POSITIONS,
    };
    this.set(repaired as any);
    return repaired;
  }

  setState(patch: Partial<AppStoreSchema>): AppStoreSchema {
    const next = {
      ...this.getState(),
      ...patch,
    };
    this.set(next as any);
    return next;
  }

  update<K extends keyof AppStoreSchema>(
    key: K,
    value: AppStoreSchema[K]
  ): AppStoreSchema[K] {
    this.set(key as string, value as any);
    return value;
  }

  patch<K extends keyof AppStoreSchema>(
    key: K,
    patchValue: Partial<AppStoreSchema[K]>
  ): AppStoreSchema[K] {
    const current = this.get(key as string) as AppStoreSchema[K];
    const next = {
      ...(typeof current === "object" && current !== null ? current : {}),
      ...(patchValue as object),
    } as AppStoreSchema[K];
    this.set(key as string, next as any);
    return next;
  }
}

export const appStore = new AppStore();
