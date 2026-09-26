import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchLmStudioReasoning,
  findLmStudioReasoning,
  parseLmStudioReasoning,
} from "./lmstudio";

/** Shape of LM Studio's native `GET /api/v1/models` (trimmed to used fields, taken from a real server). */
const nativeModels = {
  models: [
    {
      type: "llm",
      key: "openai/gpt-oss-20b",
      variants: ["openai/gpt-oss-20b@mxfp4"],
      selected_variant: "openai/gpt-oss-20b@mxfp4",
      capabilities: {
        reasoning: {
          allowed_options: ["low", "medium", "high"],
          default: "low",
        },
      },
    },
    {
      type: "llm",
      key: "google/gemma-4-e4b",
      variants: ["google/gemma-4-e4b@q4_k_m"],
      selected_variant: "google/gemma-4-e4b@q4_k_m",
      capabilities: {
        reasoning: { allowed_options: ["off", "on"], default: "on" },
      },
    },
    {
      type: "llm",
      key: "acme/toggle-default-off",
      capabilities: {
        reasoning: { allowed_options: ["off", "on"], default: "off" },
      },
    },
    {
      type: "llm",
      key: "qwen/qwen3-4b-thinking-2507",
      capabilities: {
        reasoning: { allowed_options: ["on"], default: "on" },
      },
    },
    {
      type: "llm",
      key: "google/gemma-3-12b",
      capabilities: { vision: true, trained_for_tool_use: false },
    },
    { type: "embedding", key: "text-embedding-nomic-embed-text-v1.5" },
  ],
};

describe("parseLmStudioReasoning", () => {
  const parsed = parseLmStudioReasoning(nativeModels);

  it("classifies low/medium/high options as effort", () => {
    expect(parsed.get("openai/gpt-oss-20b")).toEqual({
      support: "effort",
      defaultOn: true,
    });
  });

  it("classifies off/on options as toggle with the model default", () => {
    expect(parsed.get("google/gemma-4-e4b")).toEqual({
      support: "toggle",
      defaultOn: true,
    });
    expect(parsed.get("acme/toggle-default-off")).toEqual({
      support: "toggle",
      defaultOn: false,
    });
  });

  it("classifies on-only options as fixed", () => {
    expect(parsed.get("qwen/qwen3-4b-thinking-2507")?.support).toBe("fixed");
  });

  it("registers variant ids alongside the key", () => {
    expect(parsed.get("google/gemma-4-e4b@q4_k_m")?.support).toBe("toggle");
  });

  it("omits models without a reasoning config", () => {
    expect(parsed.has("google/gemma-3-12b")).toBe(false);
    expect(parsed.has("text-embedding-nomic-embed-text-v1.5")).toBe(false);
  });

  it("omits off-only models", () => {
    const data = {
      models: [
        { key: "x", capabilities: { reasoning: { allowed_options: ["off"] } } },
      ],
    };
    expect(parseLmStudioReasoning(data).size).toBe(0);
  });

  it.each([
    ["null", null],
    ["a non-object", "oops"],
    ["missing models", {}],
    ["non-array models", { models: {} }],
    ["null entries", { models: [null] }],
    [
      "non-array allowed_options",
      {
        models: [
          { key: "x", capabilities: { reasoning: { allowed_options: "low" } } },
        ],
      },
    ],
    [
      "non-string ids",
      {
        models: [
          { key: 1, capabilities: { reasoning: { allowed_options: ["low"] } } },
        ],
      },
    ],
  ])("returns an empty map for %s", (_, data) => {
    expect(parseLmStudioReasoning(data).size).toBe(0);
  });
});

describe("findLmStudioReasoning", () => {
  const parsed = parseLmStudioReasoning(nativeModels);

  it("matches plain keys and variant ids", () => {
    expect(findLmStudioReasoning(parsed, "google/gemma-4-e4b")?.support).toBe(
      "toggle",
    );
    expect(
      findLmStudioReasoning(parsed, "openai/gpt-oss-20b@mxfp4")?.support,
    ).toBe("effort");
  });

  it("matches an unlisted variant by its base key", () => {
    expect(
      findLmStudioReasoning(parsed, "google/gemma-4-e4b@q8_0")?.support,
    ).toBe("toggle");
  });

  it("returns undefined for unknown models", () => {
    expect(findLmStudioReasoning(parsed, "google/gemma-3-12b")).toBeUndefined();
    expect(
      findLmStudioReasoning(new Map(), "openai/gpt-oss-20b"),
    ).toBeUndefined();
  });
});

describe("fetchLmStudioReasoning", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the native models endpoint and parses the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(nativeModels));
    vi.stubGlobal("fetch", fetchMock);

    const parsed = await fetchLmStudioReasoning("http://localhost:1234", "");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:1234/api/v1/models",
      { headers: {} },
    );
    expect(parsed.get("google/gemma-4-e4b")?.support).toBe("toggle");
  });

  it("sends the API key only when one is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(nativeModels));
    vi.stubGlobal("fetch", fetchMock);

    await fetchLmStudioReasoning("http://localhost:1234", "token");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:1234/api/v1/models",
      { headers: { Authorization: "Bearer token" } },
    );
  });

  it("returns an empty map when the endpoint is missing (LM Studio < 0.4)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 })),
    );
    expect(
      (await fetchLmStudioReasoning("http://localhost:1234", "")).size,
    ).toBe(0);
  });

  it("returns an empty map on network or parse errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("CORS")));
    expect(
      (await fetchLmStudioReasoning("http://localhost:1234", "")).size,
    ).toBe(0);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    expect(
      (await fetchLmStudioReasoning("http://localhost:1234", "")).size,
    ).toBe(0);
  });
});
