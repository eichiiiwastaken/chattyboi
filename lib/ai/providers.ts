import { gateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { GATEWAY_FALLBACK_CHAT_MODEL, titleModel } from "./models";
import {
  getProviderFromModelId,
  isGatewayConfigured,
  isProviderConfigured,
  normalizeGatewayAlias,
  shouldUseGateway,
} from "./provider-config";

const opencodego = createOpenAICompatible({
  baseURL: "https://opencode.ai/zen/go/v1/",
  apiKey: process.env.OPENCODE_API_KEY,
  name: "opencodego",
});

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const openai = createOpenAI();

function toGatewayModelId(modelId: string) {
  const provider = getProviderFromModelId(modelId);

  if (provider === "openrouter" || provider === "opencodego") {
    const gatewayModelId = normalizeGatewayAlias(
      modelId.split("/").slice(1).join("/")
    );
    return gatewayModelId || GATEWAY_FALLBACK_CHAT_MODEL;
  }

  return normalizeGatewayAlias(modelId);
}

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("chat-model");
  }

  if (shouldUseGateway(modelId)) {
    return gateway(toGatewayModelId(modelId));
  }

  const [provider, ...rest] = modelId.split("/");
  const actualModelId = rest.join("/");

  if (provider === "opencodego") {
    if (!isProviderConfigured(provider)) {
      throw new Error("OpenCode Go is missing OPENCODE_API_KEY.");
    }
    return opencodego(actualModelId);
  }
  if (provider === "openrouter") {
    if (!isProviderConfigured(provider)) {
      throw new Error("OpenRouter is missing OPENROUTER_API_KEY.");
    }
    return openrouter.chat(actualModelId);
  }
  if (provider === "openai") {
    if (!isProviderConfigured(provider)) {
      throw new Error("OpenAI is missing OPENAI_API_KEY.");
    }
    return openai(actualModelId);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }

  if (isGatewayConfigured()) {
    return gateway(GATEWAY_FALLBACK_CHAT_MODEL);
  }

  const [provider, ...rest] = titleModel.id.split("/");
  const actualModelId = rest.join("/");

  if (provider === "opencodego") {
    if (!isProviderConfigured(provider)) {
      throw new Error("OpenCode Go is missing OPENCODE_API_KEY.");
    }
    return opencodego(actualModelId);
  }
  if (provider === "openrouter") {
    if (!isProviderConfigured(provider)) {
      throw new Error("OpenRouter is missing OPENROUTER_API_KEY.");
    }
    return openrouter.chat(actualModelId);
  }
  if (provider === "openai") {
    if (!isProviderConfigured(provider)) {
      throw new Error("OpenAI is missing OPENAI_API_KEY.");
    }
    return openai(actualModelId);
  }

  throw new Error(`Unknown provider: ${provider}`);
}
