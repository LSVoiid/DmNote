import { z } from "zod";
import { NOTE_SETTINGS_CONSTRAINTS } from "./noteSettingsConstraints";

export const fadePositionSchema = z.union([
  z.literal("auto"),
  z.literal("top"),
  z.literal("bottom"),
]);

export const noteSettingsSchema = z.object({
  borderRadius: z
    .number()
    .int()
    .min(NOTE_SETTINGS_CONSTRAINTS.borderRadius.min)
    .max(NOTE_SETTINGS_CONSTRAINTS.borderRadius.max),
  speed: z
    .number()
    .int()
    .min(NOTE_SETTINGS_CONSTRAINTS.speed.min)
    .max(NOTE_SETTINGS_CONSTRAINTS.speed.max),
  trackHeight: z
    .number()
    .int()
    .min(NOTE_SETTINGS_CONSTRAINTS.trackHeight.min)
    .max(NOTE_SETTINGS_CONSTRAINTS.trackHeight.max),
  reverse: z.boolean(),
  fadePosition: fadePositionSchema,
  delayedNoteEnabled: z.boolean(),
  shortNoteThresholdMs: z
    .number()
    .int()
    .min(NOTE_SETTINGS_CONSTRAINTS.shortNoteThresholdMs.min)
    .max(NOTE_SETTINGS_CONSTRAINTS.shortNoteThresholdMs.max),
  shortNoteMinLengthPx: z
    .number()
    .int()
    .min(NOTE_SETTINGS_CONSTRAINTS.shortNoteMinLengthPx.min)
    .max(NOTE_SETTINGS_CONSTRAINTS.shortNoteMinLengthPx.max),
});

export type NoteSettings = z.infer<typeof noteSettingsSchema>;

export const NOTE_SETTINGS_DEFAULTS: NoteSettings = Object.freeze({
  borderRadius: 2,
  speed: 180,
  trackHeight: 150,
  reverse: false,
  fadePosition: "auto",
  delayedNoteEnabled: false,
  shortNoteThresholdMs: 120,
  shortNoteMinLengthPx: 10,
});

export function normalizeNoteSettings(raw: unknown): NoteSettings {
  const parsed = noteSettingsSchema.safeParse({
    ...NOTE_SETTINGS_DEFAULTS,
    ...(typeof raw === "object" && raw !== null ? raw : {}),
  });
  return parsed.success ? parsed.data : NOTE_SETTINGS_DEFAULTS;
}
