import { expect, type Page, type Request, test } from "@playwright/test";
import {
  LM_STUDIO,
  mockLmStudio,
  openLmStudioSettings,
  sendChatMessage,
} from "./support/app";

const NEW_ENDPOINT = "http://llm.example.test:1234";
const OLLAMA = "http://localhost:11434";

/** Record every model-list request the page makes, to any host. */
function recordModelRequests(page: Page) {
  const requests: Request[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/models") || r.url().includes("/api/tags")) {
      requests.push(r);
    }
  });
  return requests;
}

/** Mock an empty Ollama server so provider switches never reach a real one. */
async function mockOllama(page: Page) {
  const requests: Request[] = [];
  await page.route(`${OLLAMA}/**`, (route) => {
    requests.push(route.request());
    return route.fulfill({
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
      json: { models: [] },
    });
  });
  return requests;
}

test.describe("API key protection", () => {
  test("does not request partially typed endpoints", async ({ page }) => {
    // Keep requests to partially typed hosts inside the test and only record that they happened
    await page.route(/^https?:\/\/(?!localhost:5173)/, (route) =>
      route.fulfill({
        headers: { "Access-Control-Allow-Origin": "*" },
        json: { data: [] },
      }),
    );
    // Register the LM Studio mock last so it takes precedence over the catch-all route
    await mockLmStudio(page, { models: [{ key: "google/gemma-3-12b" }] });
    await openLmStudioSettings(page);
    await page.locator("#apikey").fill("secret");
    const requests = recordModelRequests(page);

    const endpoint = page.locator("#endpoint");
    await endpoint.fill("");
    await endpoint.pressSequentially(NEW_ENDPOINT);
    await page.waitForTimeout(300);
    // Before committing, nothing is requested except the already committed endpoint (LM Studio)
    const beforeCommit = requests
      .map((r) => new URL(r.url()).origin)
      .filter((origin) => origin !== LM_STUDIO);
    expect(beforeCommit).toEqual([]);

    const committed = page.waitForRequest(`${NEW_ENDPOINT}/v1/models`);
    await endpoint.press("Enter");
    await committed;

    const origins = requests
      .map((r) => new URL(r.url()).origin)
      .filter((origin) => origin !== LM_STUDIO);
    expect(new Set(origins)).toEqual(new Set([NEW_ENDPOINT]));
  });

  test("keeps each provider's API key when switching providers", async ({
    page,
  }) => {
    await mockLmStudio(page, { models: [{ key: "google/gemma-3-12b" }] });
    const ollamaRequests = await mockOllama(page);
    await openLmStudioSettings(page);
    await page.locator("#apikey").fill("lm-secret");

    await page.locator("#provider").selectOption("ollama");
    await expect(page.locator("#endpoint")).toHaveValue(OLLAMA);
    await expect(page.locator("#apikey")).toHaveValue("");
    await expect.poll(() => ollamaRequests.length).toBeGreaterThan(0);
    // The LM Studio key is never sent to Ollama
    for (const request of ollamaRequests) {
      expect(await request.headerValue("authorization")).toBeNull();
    }

    await page.locator("#provider").selectOption("lmstudio");
    await expect(page.locator("#apikey")).toHaveValue("lm-secret");
  });

  test("does not send the key when sending is turned off", async ({ page }) => {
    const mock = await mockLmStudio(page, {
      models: [{ key: "google/gemma-3-12b" }],
    });
    await openLmStudioSettings(page);
    await page.locator("#apikey").fill("lm-secret");
    await expect(page.locator("#sendApiKey")).toBeChecked();

    await page.locator("#sendApiKey").uncheck();
    const requestsAfterOff = mock.requests.length;
    await sendChatMessage(page, "hello");

    const sent = mock.requests.slice(requestsAfterOff);
    expect(sent.some((r) => r.url().endsWith("/v1/chat/completions"))).toBe(
      true,
    );
    for (const request of sent) {
      expect(await request.headerValue("authorization")).toBeNull();
    }

    // The key itself is kept
    await page
      .getByRole("button", { name: /Settings/ })
      .first()
      .click();
    await expect(page.locator("#apikey")).toHaveValue("lm-secret");
    await expect(page.locator("#sendApiKey")).not.toBeChecked();
  });

  test("controls sending per provider", async ({ page }) => {
    await mockLmStudio(page, { models: [{ key: "google/gemma-3-12b" }] });
    const ollamaRequests = await mockOllama(page);
    await openLmStudioSettings(page);
    await page.locator("#sendApiKey").uncheck();

    await page.locator("#provider").selectOption("ollama");
    await expect(page.locator("#sendApiKey")).toBeChecked();
    await page.locator("#apikey").fill("ollama-secret");
    await expect
      .poll(async () => {
        for (const r of ollamaRequests) {
          if ((await r.headerValue("authorization")) === "Bearer ollama-secret")
            return true;
        }
        return false;
      })
      .toBe(true);

    await page.locator("#provider").selectOption("lmstudio");
    await expect(page.locator("#sendApiKey")).not.toBeChecked();
  });

  test("keeps the API key when the endpoint changes", async ({ page }) => {
    await mockLmStudio(page, { models: [{ key: "google/gemma-3-12b" }] });
    await page.route(`${NEW_ENDPOINT}/**`, (route) =>
      route.fulfill({
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
        },
        json: { data: [] },
      }),
    );
    await openLmStudioSettings(page);
    await page.locator("#apikey").fill("secret");
    const committed = page.waitForRequest(`${NEW_ENDPOINT}/v1/models`);

    // Surrounding whitespace is trimmed on commit
    await page.locator("#endpoint").fill(` ${NEW_ENDPOINT} `);
    await page.locator("#endpoint").press("Enter");

    await expect(page.locator("#endpoint")).toHaveValue(NEW_ENDPOINT);
    await expect(page.locator("#apikey")).toHaveValue("secret");
    expect(await (await committed).headerValue("authorization")).toBe(
      "Bearer secret",
    );
  });
});
