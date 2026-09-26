import { expect, type Page, type Request, type Route } from "@playwright/test";

/** Default LM Studio endpoint the app selects for the "lmstudio" provider. */
export const LM_STUDIO = "http://localhost:1234";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type NativeModel = {
  key: string;
  allowed_options?: string[];
  default?: string;
};

export type LmStudioMock = {
  /** Chat completion request bodies, in order. */
  chatBodies: Record<string, unknown>[];
  /** All requests that reached the mock server. */
  requests: Request[];
};

/**
 * Mock an LM Studio server at {@link LM_STUDIO} so tests never hit a real one.
 * - `GET /v1/models`: ids of `models`
 * - `GET /api/v1/models`: native capabilities (or 404 when `native` is false, like LM Studio < 0.4)
 * - `POST /v1/chat/completions`: returns `reply`, as SSE when `stream` is set
 *   (like LM Studio when the request asks for streaming). Replies wait for
 *   `hold` to resolve, so tests can act while a reply is pending.
 */
export async function mockLmStudio(
  page: Page,
  {
    models,
    native = true,
    reply = "ok",
    stream = false,
    hold,
  }: {
    models: NativeModel[];
    native?: boolean;
    reply?: string;
    stream?: boolean;
    hold?: Promise<void>;
  },
): Promise<LmStudioMock> {
  const mock: LmStudioMock = { chatBodies: [], requests: [] };
  await page.route(`${LM_STUDIO}/**`, async (route: Route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    mock.requests.push(request);
    const path = new URL(request.url()).pathname;
    if (path === "/v1/models") {
      return route.fulfill({
        headers: CORS_HEADERS,
        json: { data: models.map((m) => ({ id: m.key })) },
      });
    }
    if (path === "/api/v1/models") {
      if (!native) {
        return route.fulfill({ status: 404, headers: CORS_HEADERS, body: "" });
      }
      return route.fulfill({
        headers: CORS_HEADERS,
        json: {
          models: models.map((m) => ({
            type: "llm",
            key: m.key,
            capabilities: m.allowed_options
              ? {
                  reasoning: {
                    allowed_options: m.allowed_options,
                    default: m.default ?? m.allowed_options[0],
                  },
                }
              : {},
          })),
        },
      });
    }
    if (path === "/v1/chat/completions") {
      mock.chatBodies.push(request.postDataJSON());
      await hold;
      if (stream) {
        return route.fulfill({
          headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" },
          body: toSse(reply),
        });
      }
      return route.fulfill({
        headers: CORS_HEADERS,
        json: {
          choices: [{ message: { content: reply } }],
          usage: { total_tokens: 10 },
        },
      });
    }
    return route.fulfill({ status: 404, headers: CORS_HEADERS, body: "" });
  });
  return mock;
}

/** Encode `reply` as an OpenAI-compatible SSE stream split into two deltas, with usage. */
function toSse(reply: string): string {
  const half = Math.ceil(reply.length / 2);
  const events = [
    { choices: [{ delta: { role: "assistant" } }] },
    { choices: [{ delta: { content: reply.slice(0, half) } }] },
    { choices: [{ delta: { content: reply.slice(half) } }] },
    {
      choices: [],
      usage: { prompt_tokens: 40, completion_tokens: 12, total_tokens: 52 },
    },
  ];
  const lines = [...events.map((e) => JSON.stringify(e)), "[DONE]"];
  return lines.map((data) => `data: ${data}\n\n`).join("");
}

/** Open the app and switch the provider to LM Studio (default endpoint {@link LM_STUDIO}). */
export async function openLmStudioSettings(page: Page) {
  await page.goto("/");
  await page.locator("#provider").selectOption("lmstudio");
  await expect(page.locator("#model option").first()).toBeAttached();
}

/** Model option labels as shown in the selector. */
export function modelOptionLabels(page: Page) {
  return page.locator("#model option").allInnerTexts();
}

/** Go to the chat view, send `text` and wait for the assistant reply to render. */
export async function sendChatMessage(page: Page, text: string) {
  const toChat = page.getByRole("button", { name: "To Chat →" });
  if (await toChat.isVisible()) await toChat.click();
  const response = page.waitForResponse(`${LM_STUDIO}/v1/chat/completions`);
  await page.getByPlaceholder("Type a message...").fill(text);
  await page.getByPlaceholder("Type a message...").press("Enter");
  await response;
}

/** Return to the settings view from the chat view. */
export async function backToSettings(page: Page) {
  await page
    .getByRole("button", { name: /Settings/ })
    .first()
    .click();
  await expect(page.locator("#provider")).toBeVisible();
}

/** Create an IndexedDB database at a newer version so the app's version-1 open fails with VersionError. */
async function createNewerDatabase(page: Page, name: string) {
  await page.evaluate(
    (dbName) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName, 2);
        req.onsuccess = () => {
          req.result.close();
          resolve();
        };
        req.onerror = () => reject(req.error);
      }),
    name,
  );
}

/**
 * Open the app with the `name` IndexedDB database left at a newer version, so the
 * app's storage access fails. Returns the locator for the error toasts.
 */
export async function openWithUnreadableDatabase(
  page: Page,
  name: "ai-chat-config" | "chat-history",
) {
  await page.goto("/");
  await createNewerDatabase(page, name);
  await page.reload();
  return page.locator("[data-sonner-toast]");
}
