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
type SearchResult = {
  title: string;
  url: string;
  content: string;
};
type SearchWebResult =
  | {
      query: string;
      results: SearchResult[];
    }
  | {
      query: string;
      error: string;
      status: number;
      results: [];
    };

const PLACEHOLDER_ENV_PREFIX = "replace-with-";
const searchProviders = ["exa", "tavily"] as const;
const searchProviderLabels: Record<SearchProvider, string> = {
  exa: "Exa",
  tavily: "Tavily",
};
const searchProviderEnvKeys: Record<SearchProvider, string> = {
  exa: "EXA_API_KEY",
  tavily: "TAVILY_API_KEY",
};

function hasUsableEnvValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  return Boolean(
    trimmedValue && !trimmedValue.startsWith(PLACEHOLDER_ENV_PREFIX)
  );
}

function getConfiguredSearchProvider():
  | { provider: SearchProvider }
  | { error: string } {
  const configuredProvider = process.env.WEB_SEARCH_PROVIDER?.trim();

  if (configuredProvider) {
    if (searchProviders.includes(configuredProvider as SearchProvider)) {
      return { provider: configuredProvider as SearchProvider };
    }

    return {
      error: `Unsupported WEB_SEARCH_PROVIDER "${configuredProvider}". Use "exa" or "tavily".`,
    };
  }

  if (hasUsableEnvValue(process.env.EXA_API_KEY)) {
    return { provider: "exa" };
  }

  if (hasUsableEnvValue(process.env.TAVILY_API_KEY)) {
    return { provider: "tavily" };
  }

  return {
    error:
      "Search is not configured. Set EXA_API_KEY or TAVILY_API_KEY to enable web search.",
  };
}

async function readSearchError(response: Response, provider: SearchProvider) {
  const providerLabel = searchProviderLabels[provider];
  const fallback = `${providerLabel} search failed (${response.status})`;

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

    if (!detail) {
      return fallback;
    }

    const credentialHint =
      response.status === 401 || response.status === 403
        ? ` Check that ${searchProviderEnvKeys[provider]} is valid.`
        : "";

    return `${fallback}: ${detail}.${credentialHint}`;
  } catch {
    return fallback;
  }
}

function connectionSearchError(
  query: string,
  provider: SearchProvider
): SearchWebResult {
  const providerLabel = searchProviderLabels[provider];

  return {
    query,
    error: `${providerLabel} search could not be reached. Check your network connection and try again.`,
    status: 503,
    results: [],
  };
}

function invalidSearchQuery(query: string): SearchWebResult {
  return {
    query,
    error: "Enter a search query between 1 and 300 characters.",
    status: 400,
    results: [],
  };
}

function searchConfigurationError(
  query: string,
  error: string
): SearchWebResult {
  return {
    query,
    error,
    status: 503,
    results: [],
  };
}

async function searchWithTavily(
  normalizedQuery: string
): Promise<SearchWebResult> {
  if (!hasUsableEnvValue(process.env.TAVILY_API_KEY)) {
    return {
      query: normalizedQuery,
      error:
        "Tavily search is selected but TAVILY_API_KEY is not configured. Add TAVILY_API_KEY or choose another WEB_SEARCH_PROVIDER.",
      status: 503,
      results: [],
    };
  }

  let response: Response;

  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: normalizedQuery,
        max_results: 5,
      }),
    });
  } catch (error) {
    console.error("Tavily search request could not be sent", { error });
    return connectionSearchError(normalizedQuery, "tavily");
  }

  if (!response.ok) {
    const error = await readSearchError(response, "tavily");
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

async function searchWithExa(
  normalizedQuery: string
): Promise<SearchWebResult> {
  if (!hasUsableEnvValue(process.env.EXA_API_KEY)) {
    return {
      query: normalizedQuery,
      error:
        "Exa search is selected but EXA_API_KEY is not configured. Add EXA_API_KEY or choose another WEB_SEARCH_PROVIDER.",
      status: 503,
      results: [],
    };
  }

  let response: Response;

  try {
    response = await fetch("https://api.exa.ai/search", {
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
  } catch (error) {
    console.error("Exa search request could not be sent", { error });
    return connectionSearchError(normalizedQuery, "exa");
  }

  if (!response.ok) {
    const error = await readSearchError(response, "exa");
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

export async function searchWeb(query: string): Promise<SearchWebResult> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery || normalizedQuery.length > 300) {
    return invalidSearchQuery(query);
  }

  const configuredSearchProvider = getConfiguredSearchProvider();

  if ("error" in configuredSearchProvider) {
    return searchConfigurationError(
      normalizedQuery,
      configuredSearchProvider.error
    );
  }

  const { provider } = configuredSearchProvider;

  if (provider === "exa") {
    return await searchWithExa(normalizedQuery);
  }

  if (provider === "tavily") {
    return await searchWithTavily(normalizedQuery);
  }

  return searchConfigurationError(
    normalizedQuery,
    "Search is not configured. Set EXA_API_KEY or TAVILY_API_KEY to enable web search."
  );
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
