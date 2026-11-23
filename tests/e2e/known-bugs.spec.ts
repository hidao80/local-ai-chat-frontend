import { expect, type Page, type Response, test } from "@playwright/test";
import {
  armIdbGate,
  armIdbGateOnNextLoad,
  backToSettings,
  deferred,
  deleteSession,
  installIdbGate,
  LM_STUDIO,
  mockLmStudio,
  openLmStudioSettings,
  releaseIdbGate,
  sendChatMessage,
  sessionItem,
  storedSessionTitles,
  waitForIdbGate,
} from "./support/app";

/**
 * Open findings of the Quint models (specs/quint/README.md), reproduced in the
 * browser. Each test states the correct behaviour and is marked `test.fail`
 * while the bug exists: it passes as long as it fails. Fixing the bug makes it
 * pass unexpectedly, which fails the run — then remove `.fail`, together with
 * flipping the matching Quint scenario.
 */

const MODELS = [{ key: "google/gemma-3-12b" }];
const CHAT_URL = `${LM_STUDIO}/v1/chat/completions`;
const REPLY = "late answer";
const FIRST = /first question/;

/** Go to the chat view. */
async function toChat(page: Page) {
  await page.getByRole("button", { name: "To Chat →" }).click();
}

/** Type `text` and send it without waiting for the reply. */
async function startSending(page: Page, text: string) {
  const input = page.getByPlaceholder("Type a message...");
  await input.fill(text);
  await input.press("Enter");
}

/** Wait for a reply to be processed and saved after its response arrived. */
async function settle(page: Page) {
  await page.waitForTimeout(300);
}

/**
 * Mock LM Studio with one hold per chat request, go to the chat view and send
 * "first question". Returns the (still pending) wait for its reply's response.
 */
async function askFirstQuestion(
  page: Page,
  holds: ReturnType<typeof deferred>[],
) {
  await mockLmStudio(page, {
    models: MODELS,
    reply: REPLY,
    holds: holds.map((h) => h.promise),
  });
  await openLmStudioSettings(page);
  await toChat(page);
  const replied = page.waitForResponse(CHAT_URL);
  await startSending(page, "first question");
  await expect(sessionItem(page, FIRST)).toBeVisible();
  // Wrapped, so awaiting this helper does not wait for the held reply
  return { replied };
}

/** Delete the "first question" session, then let its pending reply finish. */
async function deleteThenFinishReply(
  page: Page,
  reply: ReturnType<typeof deferred>,
  replied: Promise<Response>,
) {
  await deleteSession(page, FIRST);
  await expect(sessionItem(page, FIRST)).toHaveCount(0);
  reply.release();
  await replied;
  await settle(page);
}

/** Reload, go to the chat view and open the session titled `title`. */
async function reopenAfterReload(page: Page, title: RegExp) {
  await page.reload();
  await toChat(page);
  await sessionItem(page, title).click();
}

/** Save an LM Studio config with `apiKey` (by leaving Settings) and come back to Settings. */
async function storeLmStudioKey(page: Page, apiKey: string) {
  await mockLmStudio(page, { models: MODELS });
  await openLmStudioSettings(page);
  await page.locator("#apikey").fill(apiKey);
  await toChat(page);
  await backToSettings(page);
}

/**
 * Reload with the startup config load held (gate id 0): Settings still shows
 * the defaults (OpenAI). Needs {@link installIdbGate}.
 */
async function reloadWithConfigLoadHeld(page: Page) {
  await armIdbGateOnNextLoad(page, "ai-chat-config", "readonly");
  await page.reload();
  await waitForIdbGate(page, 0);
  await expect(page.locator("#provider")).toHaveValue("openai");
}

/** Answer OpenAI model-list requests locally (the default provider before the config loads). */
async function mockOpenAi(page: Page) {
  await page.route("https://api.openai.com/**", (route) =>
    route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
      json: { data: [] },
    }),
  );
}

test.describe("Known bugs from the Quint models (expected to fail until fixed)", () => {
  test.fail(
    "F2: no message is lost after a Settings round trip during a reply",
    async ({ page }) => {
      const first = deferred();
      const second = deferred();
      const { replied: firstReplied } = await askFirstQuestion(page, [
        first,
        second,
      ]);

      // Opening Settings unmounts the chat while the reply is still pending
      await backToSettings(page);
      await toChat(page);
      await sessionItem(page, FIRST).click();
      const input = page.getByPlaceholder("Type a message...");
      const sentSecond = await input.isEnabled();
      if (sentSecond) {
        const secondReplied = page.waitForResponse(CHAT_URL);
        await startSending(page, "second question");
        second.release();
        await secondReplied;
        await settle(page);
      }
      first.release();
      await firstReplied;
      await settle(page);

      await reopenAfterReload(page, FIRST);
      await expect(page.getByText(REPLY)).toHaveCount(sentSecond ? 2 : 1);
      if (sentSecond) {
        await expect(page.getByText("second question")).toBeVisible();
      }
    },
  );

  test.fail(
    "F1: a session deleted while its reply is pending stays deleted",
    async ({ page }) => {
      const first = deferred();
      const { replied } = await askFirstQuestion(page, [first]);

      await deleteThenFinishReply(page, first, replied);

      await expect(sessionItem(page, FIRST)).toHaveCount(0);
      expect(await storedSessionTitles(page)).toEqual([]);
    },
  );

  test.fail(
    'S6: turning off "save API keys" removes the stored key',
    async ({ page }) => {
      await storeLmStudioKey(page, "stored-key");
      await page.locator("#saveApiKeys").uncheck();

      // Reload without leaving Settings (no save happens in between)
      await page.reload();
      await expect(page.locator("#provider")).toHaveValue("lmstudio");
      await expect(page.locator("#apikey")).toHaveValue("");
    },
  );

  test.fail(
    "S8: leaving Settings before the config loads keeps the stored config",
    async ({ page }) => {
      await installIdbGate(page);
      await storeLmStudioKey(page, "stored-key");
      await reloadWithConfigLoadHeld(page);
      // Leaving saves what is shown
      await toChat(page);
      await releaseIdbGate(page, 0);
      await settle(page);

      await page.reload();
      await expect(page.locator("#provider")).toHaveValue("lmstudio");
      await expect(page.locator("#apikey")).toHaveValue("stored-key");
    },
  );

  test.fail(
    "S4: a setting edited before the config loads is kept",
    async ({ page }) => {
      await installIdbGate(page);
      await mockOpenAi(page);
      await storeLmStudioKey(page, "stored-key");
      await reloadWithConfigLoadHeld(page);
      // The user enters an OpenAI key
      const apiKey = page.locator("#apikey");
      const typed = await apiKey.isEditable();
      if (typed) await apiKey.fill("typed-early");
      await releaseIdbGate(page, 0);
      await expect(page.locator("#provider")).toHaveValue("lmstudio");

      await page.locator("#provider").selectOption("openai");
      await expect(apiKey).toHaveValue(typed ? "typed-early" : "");
    },
  );

  test.fail(
    "S7: the API key is not sent while it is still being typed",
    async ({ page }) => {
      const mock = await mockLmStudio(page, { models: MODELS });
      await openLmStudioSettings(page);
      const apiKey = page.locator("#apikey");
      await apiKey.pressSequentially("lm-secret");
      await apiKey.press("Tab");
      await expect(apiKey).toHaveValue("lm-secret");
      await settle(page);

      const sentKeys = await Promise.all(
        mock.requests.map((r) => r.headerValue("authorization")),
      );
      expect(sentKeys).toContain("Bearer lm-secret");
      expect(
        sentKeys.filter((k) => k !== null && k !== "Bearer lm-secret"),
      ).toEqual([]);
    },
  );

  test.fail(
    "F3: a reply that finishes while its session loads is not lost",
    async ({ page }) => {
      await installIdbGate(page);
      const first = deferred();
      const { replied: firstReplied } = await askFirstQuestion(page, [first]);
      await page.getByRole("button", { name: "+ New Chat" }).click();

      // Open the pending session; hold the load's completion
      const load = await armIdbGate(page, "chat-history", "readonly");
      await sessionItem(page, FIRST).click();
      await waitForIdbGate(page, load);
      // The reply finishes and is saved while the load is still in flight
      first.release();
      await firstReplied;
      await settle(page);
      await releaseIdbGate(page, load);

      await sendChatMessage(page, "second question");
      await settle(page);
      await reopenAfterReload(page, FIRST);
      await expect(page.getByText("second question")).toBeVisible();
      await expect(page.getByText(REPLY)).toHaveCount(2);
    },
  );

  test.fail(
    "F5: after a remount, the sidebar lists the same sessions as storage",
    async ({ page }) => {
      const first = deferred();
      const { replied } = await askFirstQuestion(page, [first]);

      // Remount the chat, then delete the session whose reply is still pending
      await backToSettings(page);
      await toChat(page);
      await deleteThenFinishReply(page, first, replied);

      await expect(sessionItem(page, FIRST)).toHaveCount(
        (await storedSessionTitles(page)).filter((t) => FIRST.test(t)).length,
      );
    },
  );

  test.fail(
    "F4: a delete that completes late does not move away from a new chat",
    async ({ page }) => {
      await installIdbGate(page);
      await mockLmStudio(page, { models: MODELS, reply: REPLY });
      await openLmStudioSettings(page);
      await sendChatMessage(page, "first question");
      await expect(page.getByText(REPLY)).toBeVisible();
      await settle(page); // let the reply's save finish before arming the gate

      // Delete the current session; hold the delete's completion
      const removal = await armIdbGate(page, "chat-history", "readwrite");
      await deleteSession(page, FIRST);
      await waitForIdbGate(page, removal);
      await page.getByRole("button", { name: "+ New Chat" }).click();
      await sendChatMessage(page, "next question");
      await expect(page.getByText(REPLY)).toBeVisible();

      await releaseIdbGate(page, removal);
      await settle(page);
      await expect(page.getByText("No messages yet")).toHaveCount(0);
      await expect(page.getByText(REPLY)).toBeVisible();
    },
  );
});
