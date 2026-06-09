import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

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

  const [provider, ...rest] = modelId.split("/");
  const actualModelId = rest.join("/");

  if (provider === "opencodego") {
    return opencodego(actualModelId);
  }
  if (provider === "openrouter") {
    return openrouter(actualModelId);
  }
  if (provider === "openai") {
    return openai(actualModelId);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }

  const [provider, ...rest] = titleModel.id.split("/");
  const actualModelId = rest.join("/");

  if (provider === "opencodego") {
    return opencodego(actualModelId);
  }
  if (provider === "openrouter") {
    return openrouter(actualModelId);
  }
  if (provider === "openai") {
    return openai(actualModelId);
  }

  throw new Error(`Unknown provider: ${provider}`);
}
