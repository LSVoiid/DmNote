import { registerAppDomain } from "@main/domains/appDomain";
import { registerSettingsDomain } from "@main/domains/settingsDomain";
import { registerKeyDomain } from "@main/domains/keyDomain";
import { registerOverlayDomain } from "@main/domains/overlayDomain";
import { registerCssDomain } from "@main/domains/cssDomain";
import { registerPresetDomain } from "@main/domains/presetDomain";
import { registerSystemDomain } from "@main/domains/systemDomain";
import { DomainContext } from "@main/domains/context";

export function registerDomains(ctx: DomainContext) {
  registerAppDomain(ctx);
  registerSettingsDomain(ctx);
  registerKeyDomain(ctx);
  registerOverlayDomain(ctx);
  registerCssDomain(ctx);
  registerPresetDomain(ctx);
  registerSystemDomain(ctx);
}
