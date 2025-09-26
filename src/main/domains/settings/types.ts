import type { SettingsState } from "@src/types/settings";
import type { NoteSettings } from "@src/types/noteSettings";

export type SettingsPatch = Partial<Omit<SettingsState, "noteSettings">> & {
  noteSettings?: Partial<NoteSettings> | NoteSettings;
};

export interface SettingsDiff {
  changed: SettingsPatch;
  full: SettingsState;
}
