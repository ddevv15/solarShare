import {
  PUBLIC_CONFIG_ELEMENT_ID,
  parsePublicAppConfig,
  type PublicAppConfig,
} from "@/lib/config/public";

let cachedPublicConfig: PublicAppConfig | undefined;

export function getBrowserPublicConfig(): PublicAppConfig {
  if (cachedPublicConfig) {
    return cachedPublicConfig;
  }

  const element = document.getElementById(PUBLIC_CONFIG_ELEMENT_ID);

  if (!element?.textContent) {
    throw new Error("SolarShare public configuration is unavailable.");
  }

  cachedPublicConfig = parsePublicAppConfig(JSON.parse(element.textContent));

  return cachedPublicConfig;
}
