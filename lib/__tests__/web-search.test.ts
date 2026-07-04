import { afterEach, describe, expect, it, vi } from "vitest";
import { searchWeb } from "../ai/tools/web-search";

describe("web search", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses Exa when EXA_API_KEY is configured", async () => {
    vi.stubEnv("EXA_API_KEY", "exa-test-key");
    vi.stubEnv("TAVILY_API_KEY", "tavily-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          results: [
            {
              title: "Exa result",
              url: "https://example.com/exa",
              highlights: ["Relevant excerpt"],
            },
          ],
        })
      )
    );

    await expect(searchWeb("current news")).resolves.toEqual({
      query: "current news",
      results: [
        {
          title: "Exa result",
          url: "https://example.com/exa",
          content: "Relevant excerpt",
        },
      ],
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.exa.ai/search",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "exa-test-key",
        },
      })
    );
  });

  it("can force Tavily with WEB_SEARCH_PROVIDER", async () => {
    vi.stubEnv("WEB_SEARCH_PROVIDER", "tavily");
    vi.stubEnv("EXA_API_KEY", "exa-test-key");
    vi.stubEnv("TAVILY_API_KEY", "tavily-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          results: [
            {
              title: "Tavily result",
              url: "https://example.com/tavily",
              content: "Tavily excerpt",
            },
          ],
        })
      )
    );

    await expect(searchWeb("current news")).resolves.toEqual({
      query: "current news",
      results: [
        {
          title: "Tavily result",
          url: "https://example.com/tavily",
          content: "Tavily excerpt",
        },
      ],
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({
        body: JSON.stringify({
          api_key: "tavily-test-key",
          query: "current news",
          max_results: 5,
        }),
      })
    );
  });

  it("does not treat placeholder search keys as configured", async () => {
    vi.stubEnv("EXA_API_KEY", "replace-with-exa-api-key");
    vi.stubEnv("TAVILY_API_KEY", "replace-with-tavily-api-key");
    vi.stubGlobal("fetch", vi.fn());

    await expect(searchWeb("current news")).resolves.toEqual({
      query: "current news",
      error: "Search is not configured",
      status: 503,
      results: [],
    });

    expect(fetch).not.toHaveBeenCalled();
  });
});
