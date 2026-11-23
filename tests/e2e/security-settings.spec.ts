import { expect, type Page, test } from "@playwright/test";
import {
  installIdbGate,
  mockLmStudio,
  openLmStudioSettings,
  releaseIdbGate,
  reloadWithIdbOpenHung,
  storedConfig,
} from "./support/app";
import {
  reloadWithConfigLoadHeld,
  settle,
  storeLmStudioKey,
  toChat,
} from "./support/findings";

const MODELS = [{ key: "google/gemma-3-12b" }];

/**
 * Enter an API key for LM Studio, optionally turn off saving keys, leave the
 * settings view (which saves the config) and reload the page.
 */
async function saveKeyAndReload(
  page: Page,
  apiKey: string,
  { saveApiKeys }: { saveApiKeys: boolean },
) {
  await mockLmStudio(page, { models: MODELS });
  await openLmStudioSettings(page);
  await expect(page.locator("#saveApiKeys")).toBeChecked();
  await page.locator("#apikey").fill(apiKey);
  if (!saveApiKeys) await page.locator("#saveApiKeys").uncheck();
  // Settings are saved when leaving the view via "To Chat"
  await page.getByRole("button", { name: "To Chat →" }).click();

  await page.reload();
  await expect(page.locator("#provider")).toHaveValue("lmstudio");
}

test.describe("API key storage", () => {
  test("says keys are stored unencrypted in this browser", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/not encrypted/)).toBeVisible();
    await expect(page.getByText(/saved securely/)).toHaveCount(0);
  });

  test("keeps API keys after reload by default", async ({ page }) => {
    await saveKeyAndReload(page, "keep-me", { saveApiKeys: true });

    await expect(page.locator("#apikey")).toHaveValue("keep-me");
  });

  test("does not keep API keys after reload when saving is off", async ({
    page,
  }) => {
    await saveKeyAndReload(page, "forget-me", { saveApiKeys: false });

    await expect(page.locator("#saveApiKeys")).not.toBeChecked();
    await expect(page.locator("#apikey")).toHaveValue("");
  });

  test("removes a stored key as soon as saving is turned off (S6)", async ({
    page,
  }) => {
    await saveKeyAndReload(page, "stored-key", { saveApiKeys: true });
    await expect(page.locator("#apikey")).toHaveValue("stored-key");

    // No save happens in between: Settings is not left
    await page.locator("#saveApiKeys").uncheck();
    await expect
      .poll(async () => (await storedConfig(page))?.saveApiKeys)
      .toBe(false);
    expect(await storedConfig(page)).not.toHaveProperty("apiKeys");

    await page.reload();
    await expect(page.locator("#provider")).toHaveValue("lmstudio");
    await expect(page.locator("#apikey")).toHaveValue("");
    await expect(page.locator("#saveApiKeys")).not.toBeChecked();
  });
});

test.describe("Config loading", () => {
  test("waits for the stored config before anything can save over it (S8)", async ({
    page,
  }) => {
    await installIdbGate(page);
    await storeLmStudioKey(page, "stored-key");
    await reloadWithConfigLoadHeld(page);
    await expect(
      page.getByRole("button", { name: "To Chat →" }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "☽" })).toBeDisabled();

    await releaseIdbGate(page, 0);
    await expect(page.locator("#provider")).toHaveValue("lmstudio");
    await toChat(page);
    await settle(page);
    await page.reload();
    await expect(page.locator("#provider")).toHaveValue("lmstudio");
    await expect(page.locator("#apikey")).toHaveValue("stored-key");
  });

  test("asks for a reload when the stored config does not load in time (S9)", async ({
    page,
  }) => {
    await storeLmStudioKey(page, "stored-key");
    await reloadWithIdbOpenHung(page, "ai-chat-config");
    const prompt = page
      .getByRole("alert")
      .filter({ hasText: "didn't load in time" });
    // runInStore gives up after 5 s
    await expect(prompt).toBeVisible({ timeout: 10_000 });
    // Nothing can save the defaults over the stored config
    await expect(
      page.getByRole("button", { name: "To Chat →" }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "☽" })).toBeDisabled();
    await expect(page.locator("#apikey")).toHaveCount(0);

    await prompt.getByRole("button", { name: "Reload" }).click();
    await expect(page.locator("#provider")).toHaveValue("lmstudio");
    await expect(page.locator("#apikey")).toHaveValue("stored-key");
  });

  test("shows the Settings form only once the stored config has loaded (S4)", async ({
    page,
  }) => {
    await installIdbGate(page);
    await storeLmStudioKey(page, "stored-key");
    await reloadWithConfigLoadHeld(page);
    // Nothing can be edited (and later overwritten) yet
    await expect(page.locator("#apikey")).toHaveCount(0);

    await releaseIdbGate(page, 0);
    await expect(page.locator("#provider")).toHaveValue("lmstudio");
    await expect(page.locator("#apikey")).toHaveValue("stored-key");
  });
});

test.describe("Insecure endpoint warning", () => {
  test.beforeEach(async ({ page }) => {
    // Keep requests to the entered endpoints inside the test
    await page.route(/^https?:\/\/(?!localhost:5173)/, (route) =>
      route.fulfill({
        headers: { "Access-Control-Allow-Origin": "*" },
        json: { data: [] },
      }),
    );
    await page.goto("/");
    await page.locator("#provider").selectOption("lmstudio");
  });

  test("warns for plain http to another host", async ({ page }) => {
    await page.locator("#endpoint").fill("http://192.168.0.101:1234");
    await page.locator("#endpoint").press("Enter");

    await expect(page.locator("#endpointWarning")).toContainText(
      "sent unencrypted",
    );
  });

  const secure = [
    ["https", "https://192.168.0.101:1234"],
    ["localhost", "http://localhost:1234"],
    ["loopback IP", "http://127.0.0.1:1234"],
  ];
  for (const [label, endpoint] of secure) {
    test(`does not warn for ${label}`, async ({ page }) => {
      await page.locator("#endpoint").fill(endpoint);
      await page.locator("#endpoint").press("Enter");

      await expect(page.locator("#endpoint")).toHaveValue(endpoint);
      await expect(page.locator("#endpointWarning")).toHaveCount(0);
    });
  }
});
