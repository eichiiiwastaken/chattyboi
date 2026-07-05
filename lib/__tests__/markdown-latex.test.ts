import { describe, expect, it } from "vitest";
import { normalizeLatexDelimiters } from "@/lib/markdown/latex";

describe("normalizeLatexDelimiters", () => {
  it("converts LaTeX inline delimiters to dollar math", () => {
    expect(normalizeLatexDelimiters("Use \\(x^2 + y^2\\) here.")).toBe(
      "Use $x^2 + y^2$ here."
    );
  });

  it("converts LaTeX display delimiters to dollar display math", () => {
    expect(normalizeLatexDelimiters("Before\n\\[x^2 + y^2 = 1\\]\nAfter")).toBe(
      "Before\n$$\nx^2 + y^2 = 1\n$$\nAfter"
    );
  });

  it("does not convert delimiters inside fenced code blocks", () => {
    const markdown = [
      "Outside \\(x\\)",
      "```tex",
      "\\[x^2\\]",
      "```",
      "Outside \\[y^2\\]",
    ].join("\n");

    expect(normalizeLatexDelimiters(markdown)).toBe(
      ["Outside $x$", "```tex", "\\[x^2\\]", "```", "Outside $$\ny^2\n$$"].join(
        "\n"
      )
    );
  });
});
