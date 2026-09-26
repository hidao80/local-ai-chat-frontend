import { describe, expect, it } from "vitest";
import {
  type ApiConfig,
  getApiKey,
  getAuthKey,
  isInsecureRemoteEndpoint,
  isSendingApiKey,
  migrateApiKey,
  setApiKey,
  setSendApiKey,
} from "./apiConfig";

const config: ApiConfig = {
  endpoint: "https://api.openai.com",
  provider: "openai",
  apiKeys: { openai: "sk-openai", lmstudio: "lm-token" },
};

describe("API keys per provider", () => {
  it("returns the key of the selected provider only", () => {
    expect(getApiKey(config)).toBe("sk-openai");
    expect(getApiKey({ ...config, provider: "lmstudio" })).toBe("lm-token");
    expect(getApiKey({ ...config, provider: "ollama" })).toBe("");
  });

  it("keeps each provider's key when switching providers", () => {
    const switched = { ...config, provider: "ollama" as const };
    const withOllamaKey = setApiKey(switched, "ollama-key");
    expect(getApiKey(withOllamaKey)).toBe("ollama-key");
    expect(getApiKey({ ...withOllamaKey, provider: "openai" })).toBe(
      "sk-openai",
    );
  });

  it("does not mutate the original config", () => {
    setApiKey(config, "changed");
    setSendApiKey(config, false);
    expect(config.apiKeys?.openai).toBe("sk-openai");
    expect(config.sendApiKey).toBeUndefined();
  });
});

describe("sending the API key", () => {
  it("sends the key by default", () => {
    expect(isSendingApiKey(config)).toBe(true);
    expect(getAuthKey(config)).toBe("sk-openai");
  });

  it("does not send the key when turned off, but keeps it", () => {
    const off = setSendApiKey(config, false);
    expect(isSendingApiKey(off)).toBe(false);
    expect(getAuthKey(off)).toBe("");
    expect(getApiKey(off)).toBe("sk-openai");
  });

  it("controls sending per provider", () => {
    const off = setSendApiKey(config, false);
    const lmstudio = { ...off, provider: "lmstudio" as const };
    expect(getAuthKey(lmstudio)).toBe("lm-token");
  });

  it("sends nothing when the selected provider has no key", () => {
    expect(getAuthKey({ ...config, provider: "ollama" })).toBe("");
  });
});

describe("migrateApiKey", () => {
  it("moves a legacy key to the provider it was saved with", () => {
    const migrated = migrateApiKey({
      endpoint: "http://localhost:1234",
      provider: "lmstudio",
      apiKey: "legacy",
    });
    expect(migrated).toEqual({
      endpoint: "http://localhost:1234",
      provider: "lmstudio",
      apiKeys: { lmstudio: "legacy" },
    });
    expect(migrated).not.toHaveProperty("apiKey");
  });

  it("drops an empty legacy key", () => {
    expect(
      migrateApiKey({ endpoint: "x", provider: "openai", apiKey: "" }),
    ).toEqual({ endpoint: "x", provider: "openai" });
  });

  it("does not overwrite an existing per-provider key", () => {
    expect(getApiKey(migrateApiKey({ ...config, apiKey: "legacy" }))).toBe(
      "sk-openai",
    );
  });
});

describe("isInsecureRemoteEndpoint", () => {
  it.each([
    "http://192.168.0.101:1234",
    "http://llm.example.com",
    "http://10.0.0.5:11434",
  ])("flags plain http to another host: %s", (endpoint) => {
    expect(isInsecureRemoteEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "https://api.openai.com",
    "https://192.168.0.101:1234",
    "http://localhost:1234",
    "http://LOCALHOST:1234",
    "http://app.localhost:8080",
    "http://127.0.0.1:11434",
    "http://127.10.0.1",
    "http://[::1]:8080",
    "not a url",
    "",
  ])("does not flag %s", (endpoint) => {
    expect(isInsecureRemoteEndpoint(endpoint)).toBe(false);
  });
});
