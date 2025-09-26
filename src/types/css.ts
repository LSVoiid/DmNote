import { z } from "zod";

export const customCssSchema = z.object({
  path: z.string().nullable(),
  content: z.string(),
});

export type CustomCss = z.infer<typeof customCssSchema>;
