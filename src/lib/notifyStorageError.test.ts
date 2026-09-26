import i18n from "i18next";
import { toast } from "sonner";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "../i18n";
import { notifyStorageError } from "./notifyStorageError";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("notifyStorageError", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("shows a translated error toast with a resolution hint", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new DOMException("disk full", "QuotaExceededError");

    notifyStorageError("chatSaveFailed", error);

    expect(toast.error).toHaveBeenCalledWith("Couldn't save chat", {
      id: "chatSaveFailed",
      description:
        "Storage is full. Delete old chats or free up space on your device.",
      duration: 8000,
    });
    expect(log).toHaveBeenCalledWith(error);
  });

  it("follows the current language", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await i18n.changeLanguage("ja");

    notifyStorageError("chatDeleteFailed", new Error("unexpected"));

    expect(toast.error).toHaveBeenCalledWith(
      "チャットを削除できませんでした",
      expect.objectContaining({
        description: "ページを再読み込みして、もう一度お試しください。",
      }),
    );
    await i18n.changeLanguage("en");
  });

  it("does not show the raw error message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    notifyStorageError("configLoadFailed", new Error("secret internal detail"));

    const [title, options] = vi.mocked(toast.error).mock.calls[0];
    expect(JSON.stringify([title, options])).not.toContain(
      "secret internal detail",
    );
  });
});
