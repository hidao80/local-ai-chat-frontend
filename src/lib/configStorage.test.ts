import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadConfigFromDB,
  type StoredConfig,
  saveConfigToDB,
} from "./configStorage";

const DB_NAME = "ai-chat-config";

const config: StoredConfig = {
  endpoint: "http://localhost:11434",
  apiKey: "",
  provider: "ollama",
  model: "llama3",
  reasoningEffort: "medium",
  systemPrompts: { "ollama-llama3": "You are helpful." },
  lang: "ja",
  dark: true,
};

/** Create the config DB at the given version without any object store. */
function createEmptyDB(version: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Make the next object store call abort its transaction instead of running. */
function abortOn(method: "get" | "put") {
  vi.spyOn(IDBObjectStore.prototype, method).mockImplementation(function (
    this: IDBObjectStore,
  ) {
    this.transaction.abort();
    return {} as IDBRequest;
  });
}

describe("configStorage", () => {
  beforeEach(() => {
    // テスト間でDBを分離する
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("happy path", () => {
    it("saves and loads the config", async () => {
      await saveConfigToDB(config);
      expect(await loadConfigFromDB()).toEqual(config);
    });

    it("overwrites the previously saved config", async () => {
      await saveConfigToDB(config);
      const updated: StoredConfig = { ...config, lang: "en", dark: false };
      await saveConfigToDB(updated);
      expect(await loadConfigFromDB()).toEqual(updated);
    });

    it("returns null when nothing is stored", async () => {
      expect(await loadConfigFromDB()).toBeNull();
    });
  });

  describe("error handling", () => {
    it("rejects when the database cannot be opened", async () => {
      // 既存DBより低いバージョンでのopenは VersionError になる
      await createEmptyDB(2);
      await expect(saveConfigToDB(config)).rejects.toMatchObject({
        name: "VersionError",
      });
      await expect(loadConfigFromDB()).rejects.toMatchObject({
        name: "VersionError",
      });
    });

    it("rejects and closes the DB when the object store is missing", async () => {
      await createEmptyDB(1);
      const close = vi.spyOn(IDBDatabase.prototype, "close");
      await expect(saveConfigToDB(config)).rejects.toMatchObject({
        name: "NotFoundError",
      });
      await expect(loadConfigFromDB()).rejects.toMatchObject({
        name: "NotFoundError",
      });
      expect(close).toHaveBeenCalledTimes(2);
    });

    it("rejects when the config cannot be cloned", async () => {
      const unclonable = {
        ...config,
        callback: () => {},
      } as unknown as StoredConfig;
      await expect(saveConfigToDB(unclonable)).rejects.toMatchObject({
        name: "DataCloneError",
      });
      // 失敗した保存は既存データに影響しない
      expect(await loadConfigFromDB()).toBeNull();
    });

    it("rejects and closes the DB when the save transaction aborts", async () => {
      abortOn("put");
      const close = vi.spyOn(IDBDatabase.prototype, "close");
      await expect(saveConfigToDB(config)).rejects.toThrow(
        "IndexedDB transaction aborted",
      );
      expect(close).toHaveBeenCalledTimes(1);
    });

    it("rejects and closes the DB when the load transaction aborts", async () => {
      await saveConfigToDB(config);
      abortOn("get");
      const close = vi.spyOn(IDBDatabase.prototype, "close");
      await expect(loadConfigFromDB()).rejects.toThrow(
        "IndexedDB transaction aborted",
      );
      expect(close).toHaveBeenCalledTimes(1);
    });
  });
});
