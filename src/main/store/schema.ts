import { z } from "zod";
import {
  NOTE_SETTINGS_DEFAULTS,
  noteSettingsSchema,
  type NoteSettings,
} from "@src/types/noteSettings";
import {
  customTabsSchema,
  keyMappingSchema,
  keyPositionsSchema,
  type CustomTab,
  type KeyMappings,
  type KeyPositions,
} from "@src/types/keys";
import { customCssSchema, type CustomCss } from "@src/types/css";
import { DEFAULT_KEYS } from "@main/domains/keys/defaults";
import { DEFAULT_POSITIONS } from "@main/domains/positions/defaults";

export const overlayResizeAnchorSchema = z.union([
  z.literal("top-left"),
  z.literal("top-right"),
  z.literal("bottom-left"),
  z.literal("bottom-right"),
  z.literal("center"),
]);

export type OverlayResizeAnchor = z.infer<typeof overlayResizeAnchorSchema>;

export interface AppStoreSchema {
  hardwareAcceleration: boolean;
  alwaysOnTop: boolean;
  overlayLocked: boolean;
  noteEffect: boolean;
  noteSettings: NoteSettings;
  selectedKeyType: string;
  customTabs: CustomTab[];
  angleMode: string;
  language: string;
  laboratoryEnabled: boolean;
  keys: KeyMappings;
  keyPositions: KeyPositions;
  backgroundColor: string;
  useCustomCSS: boolean;
  customCSS: CustomCss;
  overlayResizeAnchor: OverlayResizeAnchor;
  overlayLastContentTopOffset?: number;
}

export const appStoreSchema = z.object({
  hardwareAcceleration: z.boolean().default(true),
  alwaysOnTop: z.boolean().default(true),
  overlayLocked: z.boolean().default(false),
  noteEffect: z.boolean().default(false),
  noteSettings: noteSettingsSchema.default(NOTE_SETTINGS_DEFAULTS),
  selectedKeyType: z.string().default("4key"),
  customTabs: customTabsSchema.default([]),
  angleMode: z.string().default("d3d11"),
  language: z.string().default("ko"),
  laboratoryEnabled: z.boolean().default(false),
  keys: keyMappingSchema.default(DEFAULT_KEYS),
  keyPositions: keyPositionsSchema.default(DEFAULT_POSITIONS),
  backgroundColor: z.string().default("transparent"),
  useCustomCSS: z.boolean().default(false),
  customCSS: customCssSchema.default({ path: null, content: "" }),
  overlayResizeAnchor: overlayResizeAnchorSchema.default("top-left"),
  overlayLastContentTopOffset: z.number().optional(),
});

export const appStoreDefaults: AppStoreSchema = {
  hardwareAcceleration: true,
  alwaysOnTop: true,
  overlayLocked: false,
  noteEffect: false,
  noteSettings: NOTE_SETTINGS_DEFAULTS,
  selectedKeyType: "4key",
  customTabs: [],
  angleMode: "d3d11",
  language: "ko",
  laboratoryEnabled: false,
  keys: DEFAULT_KEYS,
  keyPositions: DEFAULT_POSITIONS,
  backgroundColor: "transparent",
  useCustomCSS: false,
  customCSS: { path: null, content: "" },
  overlayResizeAnchor: "top-left",
  overlayLastContentTopOffset: undefined,
};
