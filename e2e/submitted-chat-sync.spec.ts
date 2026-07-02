import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";

const username = process.env.E2E_USERNAME ?? "tester";
const password = process.env.E2E_PASSWORD ?? "password";
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3232";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("your username").fill(username);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("textbox", { name: "Ask anything..." })
  ).toBeVisible();
}

async function clearChats(context: BrowserContext) {
  const response = await context.request.delete("/api/history");
  expect(response.ok()).toBe(true);
}

async function openSidebarByDefault(context: BrowserContext) {
  await context.addCookies([
    {
      name: "sidebar_state",
      value: "true",
      url: baseURL,
    },
  ]);
}

async function removeUploadFromSrc(src: string | null) {
  if (!src) {
    return;
  }

  const url = new URL(src, "http://localhost:3232");
  if (!url.pathname.startsWith("/uploads/")) {
    return;
  }

  const filename = path.basename(url.pathname);
  const uploadPath = path.join(process.cwd(), "uploads", filename);
  const metadataPath = `${uploadPath}.json`;

  await Promise.all(
    [uploadPath, metadataPath].map(async (filePath) => {
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    })
  );
}

test("submitted chats appear in another browser session without auto-navigation", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  await Promise.all([
    openSidebarByDefault(contextA),
    openSidebarByDefault(contextB),
  ]);
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const prompt = `cross-device image sync ${Date.now()}`;

  await login(pageA);
  await clearChats(contextA);

  await login(pageB);
  await pageB.goto("/");
  await expect(
    pageB.getByRole("textbox", { name: "Ask anything..." })
  ).toBeVisible();

  await pageA.goto("/");
  await expect(
    pageA.getByRole("textbox", { name: "Ask anything..." })
  ).toBeVisible();

  await pageA
    .locator('input[accept="image/jpeg,image/png,application/pdf"]')
    .setInputFiles({
      name: "sync-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64"
      ),
    });
  await expect(pageA.getByTestId("input-attachment-preview")).toBeVisible();
  await expect(pageA.getByTestId("input-attachment-loader")).toHaveCount(0);

  await pageA.getByRole("textbox", { name: "Ask anything..." }).fill(prompt);
  await pageA.getByTestId("send-button").click();
  await expect(pageA).toHaveURL(/\/chat\/[0-9a-f-]+$/);

  await expect(pageB).toHaveURL(/\/$/);
  const chatLink = pageB.locator('a[href*="/chat/"]');
  await expect(chatLink).toHaveCount(1);

  const href = await chatLink.getAttribute("href");
  expect(href).toContain("/chat/");
  await chatLink.click();
  await expect(pageB).toHaveURL(/\/chat\/[0-9a-f-]+$/);
  await expect(pageB.getByText(prompt)).toBeVisible();
  await expect(pageB.getByTestId("message-attachments")).toBeVisible();

  const uploadedSrc = await pageB
    .getByTestId("message-attachments")
    .locator("img")
    .getAttribute("src");
  await removeUploadFromSrc(uploadedSrc);

  await contextA.close();
  await contextB.close();
});
