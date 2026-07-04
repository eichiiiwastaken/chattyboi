import { tool } from "ai";
import { z } from "zod";

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
};

type ExaResult = {
  title?: string;
  url?: string;
  text?: string;
  highlights?: string[];
  summary?: string;
};

type SearchProvider = "exa" | "tavily";

const PLACEHOLDER_ENV_PREFIX = "replace-with-";
const searchProviders = ["exa", "tavily"] as const;

function hasUsableEnvValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  return Boolean(
    trimmedValue && !trimmedValue.startsWith(PLACEHOLDER_ENV_PREFIX)
  );
}

function getConfiguredSearchProvider(): SearchProvider | null {
  const configuredProvider = process.env.WEB_SEARCH_PROVIDER?.trim();

  if (configuredProvider) {
    if (searchProviders.includes(configuredProvider as SearchProvider)) {
      return configuredProvider as SearchProvider;
    }

    return null;
  }

  if (hasUsableEnvValue(process.env.EXA_API_KEY)) {
    return "exa";
  }

  if (hasUsableEnvValue(process.env.TAVILY_API_KEY)) {
    return "tavily";
  }

  return null;
}

async function readSearchError(response: Response) {
  const fallback = `Search request failed (${response.status})`;

  try {
    const data = await response.json();
    let detail: string | null = null;

    if (typeof data === "object" && data !== null) {
      if ("detail" in data && typeof data.detail === "string") {
        detail = data.detail;
      } else if ("error" in data && typeof data.error === "string") {
        detail = data.error;
      } else if ("message" in data && typeof data.message === "string") {
        detail = data.message;
      }
    }

    return detail ? `${fallback}: ${detail}` : fallback;
  } catch {
    return fallback;
  }
}

function invalidSearchQuery(query: string) {
  return {
    query,
    error: "Invalid search query",
    status: 400,
    results: [],
  };
}

function searchNotConfigured(query: string) {
  return {
    query,
    error: "Search is not configured",
    status: 503,
    results: [],
  };
}

async function searchWithTavily(normalizedQuery: string) {
  if (!hasUsableEnvValue(process.env.TAVILY_API_KEY)) {
    return {
      query: normalizedQuery,
      error: "Tavily search is not configured",
      status: 503,
      results: [],
    };
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: normalizedQuery,
      max_results: 5,
    }),
  });

  if (!response.ok) {
    const error = await readSearchError(response);
    console.error("Tavily search request failed", {
      status: response.status,
      error,
    });

    return {
      query: normalizedQuery,
      error,
      status: response.status,
      results: [],
    };
  }

  const data = await response.json();
  const results = (data.results || []).map((result: TavilyResult) => ({
    title: result.title ?? "",
    url: result.url ?? "",
    content: result.content ?? "",
  }));

  return { query: normalizedQuery, results };
}

async function searchWithExa(normalizedQuery: string) {
  if (!hasUsableEnvValue(process.env.EXA_API_KEY)) {
    return {
      query: normalizedQuery,
      error: "Exa search is not configured",
      status: 503,
      results: [],
    };
  }

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.EXA_API_KEY ?? "",
    },
    body: JSON.stringify({
      query: normalizedQuery,
      numResults: 5,
      contents: {
        highlights: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await readSearchError(response);
    console.error("Exa search request failed", {
      status: response.status,
      error,
    });

    return {
      query: normalizedQuery,
      error,
      status: response.status,
      results: [],
    };
  }

  const data = await response.json();
  const results = (data.results || []).map((result: ExaResult) => ({
    title: result.title ?? "",
    url: result.url ?? "",
    content: getExaContent(result),
  }));

  return { query: normalizedQuery, results };
}

function getExaContent(result: ExaResult) {
  const highlights = result.highlights?.filter(Boolean).join("\n");

  return highlights || result.text || result.summary || "";
}

export async function searchWeb(query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery || normalizedQuery.length > 300) {
    return invalidSearchQuery(query);
  }

  const provider = getConfiguredSearchProvider();

  if (provider === "exa") {
    return await searchWithExa(normalizedQuery);
  }

  if (provider === "tavily") {
    return await searchWithTavily(normalizedQuery);
  }

  return searchNotConfigured(normalizedQuery);
}

export const webSearch = tool({
  description:
    "Search the web for up-to-date information. YOU MAY ONLY CALL THIS TOOL ONCE per turn — after calling it, you will not be able to call it again. Ask the single best search query for the user's request.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .max(300)
      .describe(
        "The search query to run. Rewrite the user's request into the best web search query."
      ),
  }),
  execute: async ({ query }) => searchWeb(query),
});
