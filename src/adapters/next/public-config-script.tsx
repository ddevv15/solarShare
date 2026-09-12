import {
  PUBLIC_CONFIG_ELEMENT_ID,
  type PublicAppConfig,
} from "@/lib/config/public";

type PublicConfigScriptProps = {
  config: PublicAppConfig;
};

function serializeConfig(config: PublicAppConfig): string {
  return JSON.stringify(config).replaceAll("<", "\\u003c");
}

export function PublicConfigScript({ config }: PublicConfigScriptProps) {
  return (
    <script
      id={PUBLIC_CONFIG_ELEMENT_ID}
      type="application/json"
      dangerouslySetInnerHTML={{ __html: serializeConfig(config) }}
    />
  );
}
