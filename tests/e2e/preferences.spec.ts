import { expect, type Page, test } from "@playwright/test";
import {
  deferred,
  LM_STUDIO,
  mockLmStudio,
  openLmStudioSettings,
  sendChatMessage,
  sessionItem,
  storedConfig,
  storedSessionTitles,
} from "./support/app";

const MODEL_A = "google/gemma-3-12b";
const MODEL_B = "qwen/qwen3-8b";
const MODELS = [{ key: MODEL_A }, { key: MODEL_B }];

/** Wait until the stored config satisfies `check`, so a reload reads the new value. */
async function waitForStoredConfig(
  page: Page,
  check: (config: Record<string, unknown> | undefined) => boolean,
) {
  await expect.poll(async () => check(await storedConfig(page))).toBe(true);
}

test.describe("System prompt", () => {
  test("is sent first and kept per model across reloads", async ({ page }) => {
    const mock = await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);
    const prompt = page.locator("#systemprompt");
    await expect(page.locator("#model")).toHaveValue(MODEL_A);

    await prompt.fill("Answer like a pirate.");
    // Each provider/model pair has its own prompt
    await page.locator("#model").selectOption(MODEL_B);
    await expect(prompt).toHaveValue("");
    await page.locator("#model").selectOption(MODEL_A);
    await expect(prompt).toHaveValue("Answer like a pirate.");

    await sendChatMessage(page, "hello");
    expect(mock.chatBodies[0].messages).toEqual([
      { role: "system", content: "Answer like a pirate." },
      { role: "user", content: "hello" },
    ]);

    await waitForStoredConfig(
      page,
      (c) =>
        (c?.systemPrompts as Record<string, string> | undefined)?.[
          `lmstudio-${MODEL_A}`
        ] === "Answer like a pirate.",
    );
    await page.reload();
    await expect(prompt).toHaveValue("Answer like a pirate.");
  });

  test("sends no system message when the prompt is empty", async ({ page }) => {
    const mock = await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);

    await sendChatMessage(page, "hello");

    expect(mock.chatBodies[0].messages).toEqual([
      { role: "user", content: "hello" },
    ]);
  });
});

test.describe("Display preferences", () => {
  test.beforeEach(async ({ page }) => {
    await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);
  });

  test("switches the UI language and keeps it after reload", async ({
    page,
  }) => {
    const toggle = page.getByRole("button", { name: "JA", exact: true });
    await expect(toggle).toBeEnabled();

    await toggle.click();
    await expect(
      page.getByRole("button", { name: "チャット画面へ →" }),
    ).toBeVisible();
    await expect(page.locator("label[for='systemprompt']")).toHaveText(
      "システムプロンプト",
    );

    await waitForStoredConfig(page, (c) => c?.lang === "ja");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "EN", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "チャット画面へ →" }),
    ).toBeVisible();
  });

  test("toggles dark mode and keeps it after reload", async ({ page }) => {
    const html = page.locator("html");
    const toggle = page.getByRole("button", { name: "☽" });
    await expect(toggle).toBeEnabled();
    await expect(html).not.toHaveClass(/\bdark\b/);

    await toggle.click();
    await expect(html).toHaveClass(/\bdark\b/);

    await waitForStoredConfig(page, (c) => c?.dark === true);
    await page.reload();
    await expect(html).toHaveClass(/\bdark\b/);
    await page.getByRole("button", { name: "☀" }).click();
    await expect(html).not.toHaveClass(/\bdark\b/);
  });
});

test.describe("Chat errors", () => {
  test("shows the HTTP status and body when the server fails", async ({
    page,
  }) => {
    await mockLmStudio(page, {
      models: MODELS,
      status: 500,
      reply: "model crashed",
    });
    await openLmStudioSettings(page);

    await sendChatMessage(page, "hello");

    // "Error: " appears once, not again from Error#toString()
    await expect(
      page.getByText("Error: HTTP 500: model crashed", { exact: true }),
    ).toBeVisible();
    // The message box is usable again for the next question
    await expect(page.getByPlaceholder("Type a message...")).toBeEnabled();
  });

  test("shows the error when the server cannot be reached", async ({
    page,
  }) => {
    await mockLmStudio(page, { models: MODELS });
    await openLmStudioSettings(page);
    await page.getByRole("button", { name: "To Chat →" }).click();
    await page.route("http://localhost:1234/v1/chat/completions", (route) =>
      route.abort("connectionrefused"),
    );

    await page.getByPlaceholder("Type a message...").fill("hello");
    await page.getByPlaceholder("Type a message...").press("Enter");

    // Chromium's fetch rejects with TypeError("Failed to fetch")
    await expect(
      page.getByText("Error: Failed to fetch", { exact: true }),
    ).toBeVisible();
  });
});

test("shows a model list error without a second Error prefix", async ({
  page,
}) => {
  await mockLmStudio(page, { models: MODELS });
  await page.route(`${LM_STUDIO}/v1/models`, (route) =>
    route.fulfill({
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "boom",
    }),
  );
  await page.goto("/");
  await page.locator("#provider").selectOption("lmstudio");

  await expect(
    page.getByText("Error loading models: HTTP 500: boom", { exact: true }),
  ).toBeVisible();
});

test.describe("Chat history sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await mockLmStudio(page, { models: MODELS, reply: "first answer" });
    await openLmStudioSettings(page);
    await sendChatMessage(page, "first question");
    await expect(page.getByText("first answer")).toBeVisible();
  });

  test("starts a new chat and reopens an earlier one", async ({ page }) => {
    await page.getByRole("button", { name: "+ New Chat" }).click();
    await expect(page.getByText("No messages yet")).toBeVisible();
    await expect(page.getByText("first answer")).toBeHidden();

    await sessionItem(page, /first question/).click();
    await expect(page.getByText("first answer")).toBeVisible();
  });

  // The backdrop and the dialog button are both labelled "Cancel"; the backdrop comes first
  for (const [label, pick] of [
    ["the Cancel button", "last"],
    ["a click on the backdrop", "first"],
  ] as const) {
    test(`keeps the session when the delete is cancelled by ${label}`, async ({
      page,
    }) => {
      const item = sessionItem(page, /first question/);
      await item.getByRole("button", { name: "🗑" }).click();
      await page
        .getByRole("button", { name: "Cancel", exact: true })
        [pick]()
        .click({ position: { x: 5, y: 5 } });

      await expect(
        page.getByRole("button", { name: "Delete", exact: true }),
      ).toBeHidden();
      await expect(item).toBeVisible();
      await expect(page.getByText("first answer")).toBeVisible();
      expect(await storedSessionTitles(page)).toHaveLength(1);
    });
  }
});

test("disables sending while a reply is pending", async ({ page }) => {
  const { promise, release } = deferred();
  const mock = await mockLmStudio(page, {
    models: MODELS,
    reply: "pending answer",
    hold: promise,
  });
  await openLmStudioSettings(page);
  await page.getByRole("button", { name: "To Chat →" }).click();
  const input = page.getByPlaceholder("Type a message...");

  await input.fill("hello");
  await input.press("Enter");
  await expect(input).toBeDisabled();
  await expect(page.getByRole("button", { name: "⇧" })).toBeDisabled();

  release();
  await expect(page.getByText("pending answer")).toBeVisible();
  await expect(input).toBeEnabled();
  expect(mock.chatBodies).toHaveLength(1);
});
