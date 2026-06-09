import { expect, test } from "@playwright/test";

const CHAT_URL_REGEX = /\/chat\/[\w-]+/;

test.describe("Chat API Integration", () => {
  test("sends message and receives AI response", async ({ page }) => {
    await page.goto("/");

    const input = page.getByTestId("multimodal-input");
    await input.fill("Hello");
    await page.getByTestId("send-button").click();

    const assistantMessage = page.locator("[data-role='assistant']").first();
    await expect(assistantMessage).toBeVisible({ timeout: 15_000 });

    const content = await assistantMessage.textContent();
    expect(content?.length).toBeGreaterThan(0);
  });

  test("redirects to /chat/:id after sending message", async ({ page }) => {
    await page.goto("/");

    const input = page.getByTestId("multimodal-input");
    await input.fill("Test redirect");
    await page.getByTestId("send-button").click();

    await expect(page).toHaveURL(CHAT_URL_REGEX, { timeout: 10_000 });
  });

  test("clears input after sending", async ({ page }) => {
    await page.goto("/");

    const input = page.getByTestId("multimodal-input");
    await input.fill("Test message");
    await page.getByTestId("send-button").click();

    await expect(input).toHaveValue("", { timeout: 5000 });
  });

  test("shows stop button during generation", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("multimodal-input");
    await input.fill("A long message to keep streaming");
    await page.getByTestId("send-button").click();

    const stopButton = page.getByTestId("stop-button");
    await expect(stopButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Chat Error Handling", () => {
  test("handles API error gracefully", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          code: "offline:chat",
          message:
            "We're having trouble sending your message. Please check your internet connection and try again.",
        }),
      });
    });

    await page.goto("/");
    const input = page.getByTestId("multimodal-input");
    await input.fill("Test error");
    await page.getByTestId("send-button").click();

    await expect(page.getByText(/trouble/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Suggested Actions", () => {
  test("suggested actions are clickable", async ({ page }) => {
    await page.goto("/");

    const suggestions = page.locator(
      "[data-testid='suggested-actions'] button"
    );
    const count = await suggestions.count();

    if (count > 0) {
      await suggestions.first().click();

      await expect(page).toHaveURL(CHAT_URL_REGEX, { timeout: 10_000 });
    }
  });
});
