import { expect, test } from "@playwright/test";
import {
  LM_STUDIO,
  mockLmStudio,
  openLmStudioSettings,
  sendChatMessage,
} from "./support/app";

const MODELS = [{ key: "google/gemma-3-12b" }];

test.describe("Chat flow", () => {
  test("requests streaming and renders the streamed reply", async ({
    page,
  }) => {
    const mock = await mockLmStudio(page, {
      models: MODELS,
      stream: true,
      reply: "Hello **streamed** world",
    });
    await openLmStudioSettings(page);

    await sendChatMessage(page, "hi");

    await expect(page.locator("strong", { hasText: "streamed" })).toBeVisible();
    await expect(page.getByText("Hello streamed world")).toBeVisible();
    expect(mock.chatBodies[0]).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
    });
  });

  test("keeps a pending reply in the session it was asked in (B1)", async ({
    page,
  }) => {
    let release = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await mockLmStudio(page, {
      models: MODELS,
      stream: true,
      reply: "answer for first",
      hold,
    });
    await openLmStudioSettings(page);
    await page.getByRole("button", { name: "To Chat →" }).click();

    const input = page.getByPlaceholder("Type a message...");
    const replied = page.waitForResponse(`${LM_STUDIO}/v1/chat/completions`);
    await input.fill("first question");
    await input.press("Enter");
    // Switch to a new chat while the reply is still pending
    await page.getByRole("button", { name: "+ New Chat" }).click();
    await expect(page.getByText("No messages yet")).toBeVisible();

    release();
    await replied;
    await page.waitForTimeout(300);

    // The new chat stays empty
    await expect(page.getByText("answer for first")).toHaveCount(0);
    await expect(page.getByText("No messages yet")).toBeVisible();

    // The reply was saved to the original session
    await page.getByRole("button", { name: /first question/ }).click();
    await expect(page.getByText("answer for first")).toBeVisible();
  });

  test("does not send on the Enter that confirms IME input (B3)", async ({
    page,
  }) => {
    const mock = await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);
    await page.getByRole("button", { name: "To Chat →" }).click();
    const input = page.getByPlaceholder("Type a message...");
    await input.fill("にほんご");

    await input.dispatchEvent("keydown", {
      key: "Enter",
      code: "Enter",
      isComposing: true,
      bubbles: true,
    });
    await page.waitForTimeout(300);
    expect(mock.chatBodies).toHaveLength(0);
    await expect(input).toHaveValue("にほんご");

    const replied = page.waitForResponse(`${LM_STUDIO}/v1/chat/completions`);
    await input.press("Enter");
    await replied;
    expect(mock.chatBodies).toHaveLength(1);
  });

  test("updates the history list without reloading all sessions", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const counter = window as unknown as { __getAllCalls: number };
      counter.__getAllCalls = 0;
      const original = IDBObjectStore.prototype.getAll;
      IDBObjectStore.prototype.getAll = function (...args) {
        counter.__getAllCalls++;
        return original.apply(this, args);
      };
    });
    await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);
    const getAllCalls = () =>
      page.evaluate(
        () => (window as unknown as { __getAllCalls: number }).__getAllCalls,
      );
    await page.getByRole("button", { name: "To Chat →" }).click();
    await expect(page.getByText("No messages yet")).toBeVisible();
    // Initial load (React StrictMode runs it twice in development)
    const afterInitialLoad = await getAllCalls();

    await sendChatMessage(page, "one");
    await sendChatMessage(page, "two");

    await expect(page.getByRole("button", { name: /^one / })).toBeVisible();
    // Saving updates the list in place instead of reading every session again
    expect(await getAllCalls()).toBe(afterInitialLoad);
  });
});
