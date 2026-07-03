type ProviderConfig = {
  envVar: string;
  name: string;
};

const providerConfig = {
  opencodego: {
    envVar: "OPENCODE_API_KEY",
    name: "OpenCode Go",
  },
  openai: {
    envVar: "OPENAI_API_KEY",
    name: "OpenAI",
  },
  openrouter: {
    envVar: "OPENROUTER_API_KEY",
    name: "OpenRouter",
  },
} satisfies Record<string, ProviderConfig>;

const GATEWAY_ENV_VAR = "AI_GATEWAY_API_KEY";
const PLACEHOLDER_ENV_PREFIX = "replace-with-";

export type ConfiguredProvider = keyof typeof providerConfig;

export function getProviderFromModelId(
  modelId: string
): ConfiguredProvider | null {
  const provider = modelId.split("/")[0];
  return isConfiguredProvider(provider) ? provider : null;
}

export function isConfiguredProvider(
  provider: string
): provider is ConfiguredProvider {
  return provider in providerConfig;
}

export function isProviderConfigured(provider: string): boolean {
  if (!isConfiguredProvider(provider)) {
    return false;
  }
  return hasUsableEnvValue(process.env[providerConfig[provider].envVar]);
}

export function isGatewayConfigured(): boolean {
  return hasUsableEnvValue(process.env[GATEWAY_ENV_VAR]);
}

function hasUsableEnvValue(value: string | undefined): boolean {
  const trimmedValue = value?.trim();

  return Boolean(
    trimmedValue && !trimmedValue.startsWith(PLACEHOLDER_ENV_PREFIX)
  );
}

export function shouldUseGateway(modelId: string): boolean {
  if (!isGatewayConfigured()) {
    return false;
  }

  const provider = getProviderFromModelId(modelId);

  return !provider || !isProviderConfigured(provider);
}

export function normalizeModelIdForGateway(modelId: string): string {
  if (!shouldUseGateway(modelId)) {
    return modelId;
  }

  const provider = getProviderFromModelId(modelId);

  if (provider === "openrouter" || provider === "opencodego") {
    return normalizeGatewayAlias(modelId.split("/").slice(1).join("/"));
  }

  return normalizeGatewayAlias(modelId);
}

export function normalizeGatewayAlias(modelId: string): string {
  const [provider, ...rest] = modelId.split("/");

  return [provider?.replace(/^~/, ""), ...rest].filter(Boolean).join("/");
}

export function getMissingProviderConfig(modelId: string): {
  envVar: string;
  provider: ConfiguredProvider;
  providerName: string;
} | null {
  if (shouldUseGateway(modelId)) {
    return null;
  }

  const provider = getProviderFromModelId(modelId);

  if (!provider || isProviderConfigured(provider)) {
    return null;
  }

  return {
    envVar: providerConfig[provider].envVar,
    provider,
    providerName: providerConfig[provider].name,
  };
}
