import { expect, type Page, type Response } from "@playwright/test";
import {
  type deferred,
  deleteSession,
  LM_STUDIO,
  mockLmStudio,
  openLmStudioSettings,
  sessionItem,
} from "./app";

/** Helpers shared by the tests that reproduce Quint findings (known-bugs, chat-flow). */

export const MODELS = [{ key: "google/gemma-3-12b" }];
const CHAT_URL = `${LM_STUDIO}/v1/chat/completions`;
export const REPLY = "late answer";
export const FIRST = /first question/;

/** Go to the chat view. */
export async function toChat(page: Page) {
  await page.getByRole("button", { name: "To Chat →" }).click();
}

/** Type `text` and send it without waiting for the reply. */
async function startSending(page: Page, text: string) {
  const input = page.getByPlaceholder("Type a message...");
  await input.fill(text);
  await input.press("Enter");
}

/** Wait for a reply to be processed and saved after its response arrived. */
export async function settle(page: Page) {
  await page.waitForTimeout(300);
}

/**
 * Mock LM Studio with one hold per chat request, go to the chat view and send
 * "first question". Returns the (still pending) wait for its reply's response.
 */
export async function askFirstQuestion(
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
export async function deleteThenFinishReply(
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
export async function reopenAfterReload(page: Page, title: RegExp) {
  await page.reload();
  await toChat(page);
  await sessionItem(page, title).click();
}
