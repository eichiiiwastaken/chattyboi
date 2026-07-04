import { describe, expect, it } from "vitest";
import { getWebSearchStepSettings } from "../ai/web-search-step";

describe("web search step settings", () => {
  it("allows the model to call web search on the first step", () => {
    expect(
      getWebSearchStepSettings({
        baseSystemPrompt: "Base prompt",
        stepNumber: 0,
      })
    ).toEqual({
      activeTools: ["webSearch"],
      toolChoice: "auto",
    });
  });

  it("keeps the web search tool schema while preventing another tool call", () => {
    const settings = getWebSearchStepSettings({
      baseSystemPrompt: "Base prompt",
      stepNumber: 1,
    });

    expect(settings.activeTools).toEqual(["webSearch"]);
    expect(settings.toolChoice).toBe("none");
    expect("system" in settings ? settings.system : "").toContain(
      "Do not call tools again."
    );
  });
});
