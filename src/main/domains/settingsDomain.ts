import { ipcRouter } from "@main/core/ipcRouter";
import { DomainContext } from "@main/domains/context";
import type { SettingsDiff } from "@src/types/settings";

export function registerSettingsDomain(ctx: DomainContext) {
  ipcRouter.handle("settings:get", async () => ctx.settings.getSnapshot());

  ipcRouter.handle("settings:update", async (patch) => {
    const result = ctx.settings.applyPatch(patch);
    return result.full;
  });

  ctx.settings.onChange((diff: SettingsDiff) => {
    ipcRouter.emit("settings:changed", diff);
  });
}
