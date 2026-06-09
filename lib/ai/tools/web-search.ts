import { tool } from "ai";
import { z } from "zod";

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
};

export async function searchWeb(query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery || normalizedQuery.length > 300) {
    return {
      query,
      error: "Invalid search query",
      status: 400,
      results: [],
    };
  }

  if (!process.env.TAVILY_API_KEY) {
    return {
      query: normalizedQuery,
      error: "Search is not configured",
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
    return {
      query: normalizedQuery,
      error: "Search request failed",
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

export const webSearch = tool({
  description:
    "Search the web for up-to-date information. Use this once to ask the best search query for the user's request.",
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
