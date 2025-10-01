import { z } from "zod";

export const fadePositionSchema = z.union([
  z.literal("auto"),
  z.literal("top"),
  z.literal("bottom"),
]);

export const noteSettingsSchema = z.object({
  borderRadius: z.number().int().min(1).max(100),
  speed: z.number().int().min(70).max(1000),
  trackHeight: z.number().int().min(20).max(2000),
  reverse: z.boolean(),
  fadePosition: fadePositionSchema,
  delayedNoteEnabled: z.boolean(),
  shortNoteThresholdMs: z.number().int().min(0).max(2000),
  shortNoteMinLengthPx: z.number().int().min(1).max(500),
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
