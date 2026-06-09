import { expect, test } from "@playwright/test";

test.describe("Model Selector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays model selector button", async ({ page }) => {
    await expect(page.getByTestId("model-selector")).toBeVisible();
  });

  test("opens model selector popover on click", async ({ page }) => {
    await page.getByTestId("model-selector").click();

    await expect(page.getByPlaceholder("Search models...")).toBeVisible();
  });

  test("can search for models", async ({ page }) => {
    await page.getByTestId("model-selector").click();

    const searchInput = page.getByPlaceholder("Search models...");
    await searchInput.fill("Kimi");

    await expect(page.getByText("Kimi K2.6").first()).toBeVisible();
  });

  test("can close model selector with Escape", async ({ page }) => {
    await page.getByTestId("model-selector").click();

    await expect(page.getByPlaceholder("Search models...")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByPlaceholder("Search models...")).not.toBeVisible();
  });

  test("shows model provider groups", async ({ page }) => {
    await page.getByTestId("model-selector").click();

    await expect(page.getByText("opencodego").first()).toBeVisible();
    await expect(page.getByText("openai").first()).toBeVisible();
  });

  test("can select a different model", async ({ page }) => {
    await page.getByTestId("model-selector").click();

    await page.getByText("Mistral Small").first().click();

    await expect(page.getByPlaceholder("Search models...")).not.toBeVisible();

    await expect(
      page.getByTestId("model-selector").filter({ hasText: "Mistral Small" })
    ).toBeVisible();
  });
});
