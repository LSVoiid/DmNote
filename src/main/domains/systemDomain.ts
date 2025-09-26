import { shell } from "electron";
import { ipcRouter } from "@main/core/ipcRouter";
import { DomainContext } from "@main/domains/context";

export function registerSystemDomain(ctx: DomainContext) {
  ipcRouter.handle("window:minimize", async () => {
    const mainWindow = ctx.getMainWindow();
    mainWindow?.minimize();
  });

  ipcRouter.handle("window:close", async () => {
    const mainWindow = ctx.getMainWindow();
    const overlayWindow = ctx.getOverlayWindow();
    mainWindow?.close();
    overlayWindow?.close();
  });

  ipcRouter.handle<{ url: string }>("app:open-external", async ({ url }) => {
    if (url) {
      await shell.openExternal(url);
    }
  });

  ipcRouter.handle("app:restart", async () => {
    const { app } = require("electron");
    app.relaunch();
    app.exit(0);
  });
}
