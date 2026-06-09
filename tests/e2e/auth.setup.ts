import { test as setup } from "@playwright/test";

const authFile = "tests/e2e/.auth/user.json";

setup("authenticate as alice", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("your username").fill("alice");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("/login", { timeout: 10_000 });

  await page.goto("/");
  await page.waitForSelector("[data-testid='multimodal-input']", {
    timeout: 15_000,
  });

  await page.context().storageState({ path: authFile });
});
