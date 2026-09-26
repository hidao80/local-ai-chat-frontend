import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadConfigFromDB,
  type StoredConfig,
  saveConfigToDB,
} from "./configStorage";

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

describe("configStorage", () => {
  beforeEach(() => {
    // テスト間でDBを分離する
    globalThis.indexedDB = new IDBFactory();
  });

  it("saves and loads the config", async () => {
    saveConfigToDB(config);
    // saveConfigToDBは完了を通知しないため、読み出せるまでポーリングする
    await vi.waitFor(async () => {
      const loaded = await new Promise<StoredConfig | undefined>((resolve) => {
        const timer = setTimeout(() => resolve(undefined), 50);
        loadConfigFromDB((c) => {
          clearTimeout(timer);
          resolve(c);
        });
      });
      expect(loaded).toEqual(config);
    });
  });

  it("does not invoke the callback when nothing is stored", async () => {
    const callback = vi.fn();
    loadConfigFromDB(callback);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(callback).not.toHaveBeenCalled();
  });
});
