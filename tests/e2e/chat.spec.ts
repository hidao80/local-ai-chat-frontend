import { expect, test } from "@playwright/test";
import {
  LM_STUDIO,
  mockLmStudio,
  openLmStudioSettings,
  sendChatMessage,
} from "./support/app";

const MODELS = [{ key: "google/gemma-3-12b" }];

test.describe("Chat", () => {
  test("renders the reply as Markdown", async ({ page }) => {
    await mockLmStudio(page, {
      models: MODELS,
      reply: "# Title\n\n**bold** text",
    });
    await openLmStudioSettings(page);

    await sendChatMessage(page, "hello");

    await expect(page.getByRole("heading", { name: "Title" })).toBeVisible();
    await expect(page.locator("strong", { hasText: "bold" })).toBeVisible();
  });

  test("sanitizes HTML in the model reply", async ({ page }) => {
    await mockLmStudio(page, {
      models: MODELS,
      reply:
        'safe <img src="x" onerror="window.__xss = 1"> <script>window.__xss = 2</script> [link](javascript:window.__xss=3)',
    });
    await openLmStudioSettings(page);

    await sendChatMessage(page, "hello");

    await expect(page.getByText("safe")).toBeVisible();
    await expect(page.locator("img[onerror]")).toHaveCount(0);
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as { __xss?: number }).__xss),
    ).toBe(undefined);
  });

  test("sends the Authorization header only when an API key is set", async ({
    page,
  }) => {
    const mock = await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);

    await sendChatMessage(page, "without key");
    const withoutKey = mock.requests.filter((r) =>
      r.url().startsWith(LM_STUDIO),
    );
    expect(withoutKey.length).toBeGreaterThan(0);
    for (const request of withoutKey) {
      expect(await request.headerValue("authorization")).toBeNull();
    }

    await page
      .getByRole("button", { name: /Settings/ })
      .first()
      .click();
    const chatRequest = page.waitForRequest(`${LM_STUDIO}/v1/chat/completions`);
    await page.locator("#apikey").fill("test-key");
    await sendChatMessage(page, "with key");
    expect(await (await chatRequest).headerValue("authorization")).toBe(
      "Bearer test-key",
    );
  });
});
