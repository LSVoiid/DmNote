import { dialog } from "electron";
import { readFileSync } from "node:fs";
import { ipcRouter } from "@main/core/ipcRouter";
import { windowRegistry } from "@main/core/windowRegistry";
import { DomainContext } from "@main/domains/context";
import { customCssSchema } from "@src/types/css";

export function registerCssDomain(ctx: DomainContext) {
  ipcRouter.handle("css:get", async () => ctx.store.getState().customCSS);
  ipcRouter.handle(
    "css:get-use",
    async () => ctx.store.getState().useCustomCSS
  );

  ipcRouter.handle<{ enabled: boolean }, { enabled: boolean }>(
    "css:toggle",
    async ({ enabled }) => {
      ctx.store.update("useCustomCSS", enabled);
      windowRegistry.broadcast("css:use", { enabled });
      if (enabled) {
        windowRegistry.broadcast("css:content", ctx.store.getState().customCSS);
      }
      return { enabled };
    }
  );

  ipcRouter.handle("css:reset", async () => {
    ctx.store.setState({
      useCustomCSS: false,
      customCSS: { path: null, content: "" },
    });
    windowRegistry.broadcast("css:use", { enabled: false });
    windowRegistry.broadcast("css:content", { path: null, content: "" });
  });

  ipcRouter.handle<{ content: string }>(
    "css:set-content",
    async ({ content }) => {
      const parsed = customCssSchema.safeParse({
        path: ctx.store.getState().customCSS.path,
        content,
      });
      if (!parsed.success) {
        return { error: "invalid-css" };
      }
      ctx.store.update("customCSS", parsed.data);
      windowRegistry.broadcast("css:content", parsed.data);
      return { success: true };
    }
  );

  ipcRouter.handle("css:load", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "CSS", extensions: ["css"] }],
    });
    if (result.canceled || !result.filePaths.length) {
      return { success: false };
    }
    try {
      const content = readFileSync(result.filePaths[0], "utf8");
      const data = customCssSchema.parse({
        path: result.filePaths[0],
        content,
      });
      ctx.store.update("customCSS", data);
      windowRegistry.broadcast("css:content", data);
      return { success: true, content: data.content, path: data.path };
    } catch (error) {
      console.error("Failed to load custom CSS:", error);
      return { success: false, error: String(error) };
    }
  });
}
