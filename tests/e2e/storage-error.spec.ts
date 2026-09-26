import { expect, test } from "@playwright/test";
import { createNewerDatabase } from "./support/app";

const VERSION_HINT =
  "This data was saved by a newer version of the app. Open it in the latest version.";

test.describe("Storage error toast", () => {
  test("shows a toast when settings cannot be loaded", async ({ page }) => {
    await page.goto("/");
    await createNewerDatabase(page, "ai-chat-config");
    await page.reload();

    const toast = page.locator("[data-sonner-toast]");
    await expect(toast).toContainText("Couldn't load settings");
    await expect(toast).toContainText(VERSION_HINT);
    // 画面右下に表示される
    const box = await toast.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport).toBeTruthy();
    if (box && viewport) {
      expect(box.x + box.width / 2).toBeGreaterThan(viewport.width / 2);
      expect(box.y + box.height / 2).toBeGreaterThan(viewport.height / 2);
    }
  });

  test("shows a toast when chat history cannot be loaded", async ({ page }) => {
    await page.goto("/");
    await createNewerDatabase(page, "chat-history");
    await page.reload();

    await page.getByRole("button", { name: "To Chat →" }).click();

    const toast = page.locator("[data-sonner-toast]");
    await expect(toast).toContainText("Couldn't load chat history");
    await expect(toast).toContainText(VERSION_HINT);
  });

  test("the toast can be dismissed", async ({ page }) => {
    await page.goto("/");
    await createNewerDatabase(page, "ai-chat-config");
    await page.reload();

    const toast = page.locator("[data-sonner-toast]");
    await expect(toast).toBeVisible();
    await page.getByRole("button", { name: "Close notification" }).click();
    await expect(toast).toHaveCount(0);
  });
});
