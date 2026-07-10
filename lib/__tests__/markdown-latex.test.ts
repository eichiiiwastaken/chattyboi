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

  it("puts inline display-dollar delimiters on their own lines", () => {
    expect(
      normalizeLatexDelimiters(
        "Before $$f(x) = \\begin{cases} x & x > 0 \\\\ 0 & x \\le 0 \\end{cases}$$ after"
      )
    ).toBe(
      "Before \n\n$$\nf(x) = \\begin{cases} x & x > 0 \\\\ 0 & x \\le 0 \\end{cases}\n$$\n\n after"
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
