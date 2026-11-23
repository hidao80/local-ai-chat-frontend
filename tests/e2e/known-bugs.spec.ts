import { expect, test } from "@playwright/test";
import {
  armIdbGate,
  deleteSession,
  installIdbGate,
  mockLmStudio,
  openLmStudioSettings,
  releaseIdbGate,
  sendChatMessage,
  waitForIdbGate,
} from "./support/app";
import { FIRST, MODELS, REPLY, settle } from "./support/findings";

/**
 * Open findings of the Quint models (specs/quint/README.md), reproduced in the
 * browser. Each test states the correct behaviour and is marked `test.fail`
 * while the bug exists: it passes as long as it fails. Fixing the bug makes it
 * pass unexpectedly, which fails the run — then remove `.fail`, together with
 * flipping the matching Quint scenario.
 */

test.describe("Known bugs from the Quint models (expected to fail until fixed)", () => {
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
