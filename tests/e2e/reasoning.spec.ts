import { expect, test } from "@playwright/test";
import {
  backToSettings,
  mockLmStudio,
  modelOptionLabels,
  openLmStudioSettings,
  sendChatMessage,
} from "./support/app";

// 実サーバー(LM Studio)で確認した allowed_options の組み合わせ
const MODELS = [
  { key: "google/gemma-4-e4b", allowed_options: ["off", "on"], default: "on" },
  {
    key: "acme/effort-model",
    allowed_options: ["low", "medium", "high"],
    default: "low",
  },
  {
    key: "qwen/qwen3-4b-thinking-2507",
    allowed_options: ["on"],
    default: "on",
  },
  { key: "google/gemma-3-12b" },
];

test.describe("LM Studio reasoning", () => {
  test("marks every reasoning-capable model with 🧠", async ({ page }) => {
    await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);

    await expect
      .poll(() => modelOptionLabels(page))
      .toEqual([
        "google/gemma-4-e4b 🧠",
        "acme/effort-model 🧠",
        "qwen/qwen3-4b-thinking-2507 🧠",
        "google/gemma-3-12b",
      ]);
  });

  test("shows the control that matches each model type", async ({ page }) => {
    await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);
    const model = page.locator("#model");
    const toggle = page.locator("#reasoningToggle");
    const effort = page.locator("#reasoningEffort");

    await model.selectOption("google/gemma-4-e4b");
    await expect(toggle).toHaveValue("on");
    await expect(effort).toHaveCount(0);

    await model.selectOption("acme/effort-model");
    await expect(effort).toBeVisible();
    await expect(toggle).toHaveCount(0);

    for (const id of ["qwen/qwen3-4b-thinking-2507", "google/gemma-3-12b"]) {
      await model.selectOption(id);
      await expect(toggle).toHaveCount(0);
      await expect(effort).toHaveCount(0);
    }
  });

  test("toggle model: sends the model default, then off/on", async ({
    page,
  }) => {
    const mock = await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);
    await page.locator("#model").selectOption("google/gemma-4-e4b");

    await sendChatMessage(page, "untouched");
    expect(mock.chatBodies.at(-1)).not.toHaveProperty("reasoning_effort");

    await backToSettings(page);
    await page.locator("#reasoningToggle").selectOption("off");
    await sendChatMessage(page, "off");
    expect(mock.chatBodies.at(-1)).toMatchObject({ reasoning_effort: "none" });
    await expect(
      page.getByText("AI (LM Studio: google/gemma-4-e4b/off)"),
    ).toBeVisible();

    await backToSettings(page);
    // 切り替えたON/OFFは設定画面に戻っても保持される
    await expect(page.locator("#reasoningToggle")).toHaveValue("off");
    await page.locator("#reasoningToggle").selectOption("on");
    await sendChatMessage(page, "on");
    expect(mock.chatBodies.at(-1)).toMatchObject({
      reasoning_effort: "medium",
    });
    await expect(
      page.getByText("AI (LM Studio: google/gemma-4-e4b/on)"),
    ).toBeVisible();
  });

  test("toggle resets to the model default when switching models", async ({
    page,
  }) => {
    await mockLmStudio(page, {
      models: [
        MODELS[0],
        {
          key: "acme/toggle-default-off",
          allowed_options: ["off", "on"],
          default: "off",
        },
      ],
    });
    await openLmStudioSettings(page);
    const toggle = page.locator("#reasoningToggle");

    await page.locator("#model").selectOption("google/gemma-4-e4b");
    await toggle.selectOption("off");
    await page.locator("#model").selectOption("acme/toggle-default-off");
    await expect(toggle).toHaveValue("off");
    await page.locator("#model").selectOption("google/gemma-4-e4b");
    await expect(toggle).toHaveValue("on");
  });

  test("effort model: sends the selected level", async ({ page }) => {
    const mock = await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);
    await page.locator("#model").selectOption("acme/effort-model");
    await page.locator("#reasoningEffort").selectOption("high");

    await sendChatMessage(page, "hello");

    expect(mock.chatBodies.at(-1)).toMatchObject({
      model: "acme/effort-model",
      reasoning_effort: "high",
    });
  });

  test("always-on model: sends no reasoning parameter", async ({ page }) => {
    const mock = await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);
    await page.locator("#model").selectOption("qwen/qwen3-4b-thinking-2507");

    await sendChatMessage(page, "hello");

    expect(mock.chatBodies.at(-1)).not.toHaveProperty("reasoning_effort");
  });

  test("falls back to name-based detection without the native API", async ({
    page,
  }) => {
    await mockLmStudio(page, {
      native: false,
      models: [{ key: "openai/gpt-oss-20b" }, { key: "google/gemma-4-e4b" }],
    });
    await openLmStudioSettings(page);

    await expect
      .poll(() => modelOptionLabels(page))
      .toEqual(["openai/gpt-oss-20b 🧠", "google/gemma-4-e4b"]);
  });
});
