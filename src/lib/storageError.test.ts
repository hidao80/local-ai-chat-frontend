import { describe, expect, it } from "vitest";
import en from "../locales/en.json";
import ja from "../locales/ja.json";
import {
  getStorageErrorMessageKey,
  type StorageErrorMessageKey,
} from "./storageError";

describe("getStorageErrorMessageKey", () => {
  it.each([
    ["SecurityError", "storageErrorBlocked"],
    ["InvalidAccessError", "storageErrorBlocked"],
    ["InvalidStateError", "storageErrorBlocked"],
    ["QuotaExceededError", "storageErrorQuota"],
    ["VersionError", "storageErrorVersion"],
    ["NotFoundError", "storageErrorCorrupted"],
    ["UnknownError", "storageErrorCorrupted"],
    ["DataCloneError", "storageErrorUnknown"],
  ])("maps DOMException %s to %s", (name, key) => {
    expect(getStorageErrorMessageKey(new DOMException("x", name))).toBe(key);
  });

  it.each([
    ["a plain Error", new Error("boom")],
    ["an aborted transaction", new Error("IndexedDB transaction aborted")],
    ["null", null],
    ["a string", "VersionError"],
    ["an object with a non-string name", { name: 42 }],
    ["an inherited property name", { name: "toString" }],
  ])("falls back to storageErrorUnknown for %s", (_, error) => {
    expect(getStorageErrorMessageKey(error)).toBe("storageErrorUnknown");
  });
});

describe("storage error messages", () => {
  const keys: StorageErrorMessageKey[] = [
    "storageErrorBlocked",
    "storageErrorQuota",
    "storageErrorVersion",
    "storageErrorCorrupted",
    "storageErrorUnknown",
  ];

  it.each([
    ["en", en],
    ["ja", ja],
  ])("has every message key in the %s locale", (_, locale) => {
    const messages: Record<string, string> = locale;
    const toastKeys = [
      "configSaveFailed",
      "configLoadFailed",
      "chatSaveFailed",
      "chatLoadFailed",
      "chatDeleteFailed",
      "notifications",
      "closeNotification",
    ];
    for (const key of [...keys, ...toastKeys]) {
      expect(messages[key], key).toBeTruthy();
    }
  });

  it("defines the same keys in en and ja", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });
});
