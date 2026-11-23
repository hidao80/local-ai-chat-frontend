import { expect, test } from "@playwright/test";
import {
  armIdbGate,
  deferred,
  deleteSession,
  installIdbGate,
  mockLmStudio,
  openLmStudioSettings,
  releaseIdbGate,
  sendChatMessage,
  sessionItem,
  waitForIdbGate,
} from "./support/app";
import {
  askFirstQuestion,
  FIRST,
  MODELS,
  REPLY,
  reopenAfterReload,
  settle,
} from "./support/findings";

/**
 * Open findings of the Quint models (specs/quint/README.md), reproduced in the
 * browser. Each test states the correct behaviour and is marked `test.fail`
 * while the bug exists: it passes as long as it fails. Fixing the bug makes it
 * pass unexpectedly, which fails the run — then remove `.fail`, together with
 * flipping the matching Quint scenario.
 */

test.describe("Known bugs from the Quint models (expected to fail until fixed)", () => {
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
