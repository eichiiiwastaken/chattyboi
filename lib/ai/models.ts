import { gateway } from "@ai-sdk/gateway";
import { isTestEnvironment } from "@/lib/constants";
import { isGatewayConfigured, isProviderConfigured } from "./provider-config";

export const DEFAULT_CHAT_MODEL = "opencodego/kimi-k2.6";
export const GATEWAY_FALLBACK_CHAT_MODEL = "moonshotai/kimi-k2.6";

export const titleModel = {
  id: "opencodego/kimi-k2.6",
  name: "Kimi K2.6",
  provider: "opencodego",
  description: "Fast model for title generation",
};

const MOCK_MODELS: ChatModel[] = [
  {
    id: "opencodego/kimi-k2.6",
    name: "Kimi K2.6",
    provider: "opencodego",
    description: "",
  },
  {
    id: "opencodego/mistral-small",
    name: "Mistral Small",
    provider: "opencodego",
    description: "",
  },
  {
    id: "opencodego/deepseek-v3",
    name: "DeepSeek V3",
    provider: "opencodego",
    description: "",
  },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "openai", description: "" },
  { id: "openai/o1", name: "O1", provider: "openai", description: "" },
  {
    id: "openrouter/mistralai/mistral-small",
    name: "Mistral Small",
    provider: "openrouter",
    description: "",
  },
  {
    id: "openrouter/moonshotai/kimi-k2",
    name: "Kimi K2",
    provider: "openrouter",
    description: "",
  },
];

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  file: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

function uniqueModels(models: ChatModel[]) {
  const seen = new Set<string>();

  return models.filter((model) => {
    if (seen.has(model.id)) {
      return false;
    }

    seen.add(model.id);
    return true;
  });
}

export async function fetchGatewayModels(): Promise<ChatModel[]> {
  if (!isGatewayConfigured()) {
    return [];
  }

  try {
    const metadata = await gateway.getAvailableModels();
    return (metadata.models ?? []).map((model) => ({
      id: model.id,
      name: model.name || model.id,
      provider: model.id.split("/")[0] ?? "gateway",
      description: model.description ?? "",
    }));
  } catch {
    return [];
  }
}

export async function fetchOpenCodeGoModels(): Promise<ChatModel[]> {
  if (!isProviderConfigured("opencodego")) {
    return [];
  }

  try {
    const res = await fetch("https://opencode.ai/zen/go/v1/models", {
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return (json.data ?? []).map((m: { id: string }) => ({
      id: `opencodego/${m.id}`,
      name: m.id,
      provider: "opencodego",
      description: "",
    }));
  } catch {
    return [];
  }
}

export async function fetchOpenAIModels(): Promise<ChatModel[]> {
  if (!process.env.OPENAI_API_KEY) {
    return [];
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return (json.data ?? [])
      .filter((m: { id: string }) => isChatModel(m.id))
      .map((m: { id: string }) => ({
        id: `openai/${m.id}`,
        name: m.id,
        provider: "openai",
        description: "",
      }));
  } catch {
    return [];
  }
}

function isChatModel(modelId: string): boolean {
  return /^(gpt|o[1-9]|o\d|chatgpt)/i.test(modelId);
}

export async function fetchOpenRouterModels(): Promise<ChatModel[]> {
  if (!isProviderConfigured("openrouter")) {
    return [];
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return (json.data ?? []).map((m: { id: string; name?: string }) => ({
      id: `openrouter/${m.id}`,
      name: m.name || m.id,
      provider: "openrouter",
      description: "",
    }));
  } catch {
    return [];
  }
}

export async function getAllModels(): Promise<ChatModel[]> {
  if (isTestEnvironment) {
    return MOCK_MODELS;
  }
  const [gatewayModels, openCodeGoModels, openRouterModels, openAIModels] =
    await Promise.all([
      fetchGatewayModels(),
      fetchOpenCodeGoModels(),
      fetchOpenRouterModels(),
      fetchOpenAIModels(),
    ]);
  return uniqueModels([
    ...gatewayModels,
    ...openCodeGoModels,
    ...openRouterModels,
    ...openAIModels,
  ]);
}

type OpenRouterRawModel = {
  id: string;
  name?: string;
  architecture?: { input_modalities?: string[] };
  supported_parameters?: string[];
};

async function fetchOpenRouterRawData(): Promise<OpenRouterRawModel[]> {
  if (!isProviderConfigured("openrouter")) {
    return [];
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

function parseCapabilities(modelData: OpenRouterRawModel): ModelCapabilities {
  const modalities = modelData.architecture?.input_modalities ?? [];
  const params = modelData.supported_parameters ?? [];
  return {
    tools: params.includes("tools"),
    vision: modalities.includes("image"),
    file: modalities.includes("file"),
    reasoning:
      params.includes("reasoning") || params.includes("include_reasoning"),
  };
}

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  tools: true,
  vision: false,
  file: false,
  reasoning: true,
};

function inferOpenAICapabilities(modelId: string): ModelCapabilities {
  const id = modelId.toLowerCase();
  const isOSeries = /^o[1-9]/.test(id);
  const hasVision = /gpt-4o|gpt-4-turbo|o1-preview|o1-pro/.test(id);
  const hasFiles = /gpt-4o/.test(id);
  return {
    tools: true,
    vision: hasVision || /o1|o3/.test(id),
    file: hasFiles,
    reasoning: isOSeries,
  };
}

function inferGatewayCapabilities(modelId: string): ModelCapabilities {
  const id = modelId.toLowerCase();
  const hasVision =
    /claude|gemini|gpt-4o|gpt-4\.1|gpt-5|image|pixtral|vision|vl/.test(id);

  return {
    tools: true,
    vision: hasVision,
    file: hasVision,
    reasoning: /claude|deepseek-r1|glm|gpt-5|o[1-9]|reasoning|thinking/.test(
      id
    ),
  };
}

export async function fetchAllModelData(): Promise<{
  allModels: ChatModel[];
  capabilities: Record<string, ModelCapabilities>;
}> {
  const [
    gatewayModels,
    openCodeGoModels,
    openRouterModels,
    openRouterRawData,
    openAIModels,
  ] = await Promise.all([
    fetchGatewayModels(),
    fetchOpenCodeGoModels(),
    fetchOpenRouterModels(),
    fetchOpenRouterRawData(),
    fetchOpenAIModels(),
  ]);

  const allModels = uniqueModels([
    ...gatewayModels,
    ...openCodeGoModels,
    ...openRouterModels,
    ...openAIModels,
  ]);
  const capabilities: Record<string, ModelCapabilities> = {};

  for (const model of gatewayModels) {
    capabilities[model.id] = inferGatewayCapabilities(model.id);
  }

  for (const modelData of openRouterRawData) {
    capabilities[`openrouter/${modelData.id}`] = parseCapabilities(modelData);
  }

  for (const model of openCodeGoModels) {
    const shortName = model.id.replace("opencodego/", "");
    const match = openRouterRawData.find((m) => {
      const mId: string = m.id;
      return mId.endsWith(`/${shortName}`) || mId === shortName;
    });
    capabilities[model.id] = match
      ? parseCapabilities(match)
      : DEFAULT_CAPABILITIES;
  }

  for (const model of openAIModels) {
    const shortName = model.id.replace("openai/", "");
    capabilities[model.id] = inferOpenAICapabilities(shortName);
  }

  return { allModels, capabilities };
}

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  if (isTestEnvironment) {
    return Object.fromEntries(
      MOCK_MODELS.map((m) => [m.id, DEFAULT_CAPABILITIES])
    );
  }
  const { capabilities } = await fetchAllModelData();
  return capabilities;
}

export const isDemo = process.env.IS_DEMO === "1";

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  if (isTestEnvironment) {
    return MOCK_MODELS.map((m) => ({
      ...m,
      capabilities: DEFAULT_CAPABILITIES,
    }));
  }
  const { allModels, capabilities } = await fetchAllModelData();
  return allModels.map((m) => ({
    ...m,
    capabilities: capabilities[m.id] ?? DEFAULT_CAPABILITIES,
  }));
}

export function getActiveModels(): Promise<ChatModel[]> {
  return getAllModels();
}

export async function getAllowedModelIds(): Promise<Set<string>> {
  const models = await getAllModels();
  return new Set(models.map((m) => m.id));
}
