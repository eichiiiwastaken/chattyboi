import { describe, expect, it } from "vitest";
import { getCurrentDateTimePrompt } from "@/lib/ai/prompts";

describe("getCurrentDateTimePrompt", () => {
  it("adds the current date and time in the user's timezone", () => {
    expect(
      getCurrentDateTimePrompt(
        "Europe/Berlin",
        new Date("2026-07-03T19:00:00.000Z")
      )
    ).toContain("Friday, 3 July 2026 at 21:00:00 CEST (Europe/Berlin).");
  });

  it("falls back to UTC for an invalid timezone", () => {
    expect(
      getCurrentDateTimePrompt(
        "not-a-timezone",
        new Date("2026-07-03T19:00:00.000Z")
      )
    ).toContain("(UTC).");
  });
});
