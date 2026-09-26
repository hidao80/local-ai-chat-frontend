import { describe, expect, it } from "vitest";
import type { ApiConfig } from "./apiConfig";
import {
  buildChatRequest,
  type ChatResult,
  readChatResponse,
  resolveModel,
  tokensPerSecond,
} from "./chatApi";

const MESSAGES = [{ role: "user", content: "hi" }];

function config(overrides: Partial<ApiConfig>): ApiConfig {
  return {
    endpoint: "http://localhost:1234",
    provider: "lmstudio",
    ...overrides,
  };
}

function bodyOf(request: ReturnType<typeof buildChatRequest>) {
  return JSON.parse(request.init.body as string);
}

/** A response whose body arrives in the given chunks, like a real stream. */
function streamed(chunks: string[], contentType: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": contentType } });
}

/** A clock that advances by `step` on every read. */
function fakeClock(step = 1000) {
  let t = 0;
  return () => {
    t += step;
    return t;
  };
}

describe("buildChatRequest", () => {
  it("streams OpenAI-compatible requests with usage and reasoning params", () => {
    const request = buildChatRequest(
      config({
        model: "openai/gpt-oss-20b",
        reasoningSupport: "effort",
        reasoningEffort: "high",
      }),
      MESSAGES,
    );
    expect(request.url).toBe("http://localhost:1234/v1/chat/completions");
    expect(bodyOf(request)).toEqual({
      model: "openai/gpt-oss-20b",
      messages: MESSAGES,
      stream: true,
      stream_options: { include_usage: true },
      reasoning_effort: "high",
    });
    expect(request.reasoningLabel).toBe("high");
  });

  it("streams Ollama requests and maps effort to think", () => {
    const request = buildChatRequest(
      config({
        provider: "ollama",
        endpoint: "http://localhost:11434",
        model: "gpt-oss:20b",
        reasoningEffort: "low",
      }),
      MESSAGES,
    );
    expect(request.url).toBe("http://localhost:11434/api/chat");
    expect(bodyOf(request)).toEqual({
      model: "gpt-oss:20b",
      messages: MESSAGES,
      stream: true,
      think: "low",
    });
  });

  it("keeps GPT4ALL on the dev proxy without streaming", () => {
    const request = buildChatRequest(config({ provider: "gpt4all" }), MESSAGES);
    expect(request.url).toBe("/api/gpt4all/v1/chat/completions");
    expect(bodyOf(request)).toEqual({
      model: "gpt-3.5-turbo",
      messages: MESSAGES,
    });
  });

  it("adds the Authorization header only when a key is sent", () => {
    const withKey = buildChatRequest(
      config({ apiKeys: { lmstudio: "secret" } }),
      MESSAGES,
    );
    expect(withKey.init.headers).toMatchObject({
      Authorization: "Bearer secret",
    });
    const sendingOff = buildChatRequest(
      config({
        apiKeys: { lmstudio: "secret" },
        sendApiKey: { lmstudio: false },
      }),
      MESSAGES,
    );
    expect(sendingOff.init.headers).not.toHaveProperty("Authorization");
  });

  it("falls back to the provider's default model", () => {
    expect(resolveModel(config({ provider: "ollama" }))).toBe("llama2");
    expect(resolveModel(config({}))).toBe("gpt-3.5-turbo");
  });
});

describe("readChatResponse", () => {
  it("reads OpenAI-compatible SSE, including chunks split mid-line", async () => {
    const deltas: string[] = [];
    const res = streamed(
      [
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choi',
        'ces":[{"delta":{"content":"lo"}}]}\r\n\r\n',
        'data: {"choices":[],"usage":{"prompt_tokens":50,"completion_tokens":20,"total_tokens":70}}\n\n',
        "data: [DONE]\n\n",
      ],
      "text/event-stream; charset=utf-8",
    );

    const result = await readChatResponse(
      res,
      "lmstudio",
      (d) => deltas.push(d),
      {
        startedAt: 0,
        now: fakeClock(),
      },
    );

    expect(deltas).toEqual(["Hel", "lo"]);
    expect(result.content).toBe("Hello");
    // Counts only the generated tokens, not the prompt
    expect(result.completionTokens).toBe(20);
    expect(result.generationSeconds).toBeGreaterThan(0);
  });

  it("throws on an error event in the SSE stream", async () => {
    const res = streamed(
      ['data: {"error":{"message":"model crashed"}}\n\n'],
      "text/event-stream",
    );
    await expect(
      readChatResponse(res, "openai", () => {}, { startedAt: 0 }),
    ).rejects.toThrow("model crashed");
  });

  it("reads Ollama NDJSON and uses its own generation timing", async () => {
    const deltas: string[] = [];
    const res = streamed(
      [
        '{"message":{"role":"assistant","content":"Hi"},"done":false}\n',
        '{"message":{"role":"assistant","content":" there"},"done":false}\n',
        '{"message":{"role":"assistant","content":""},"done":true,"eval_count":30,"eval_duration":2000000000}\n',
      ],
      "application/x-ndjson",
    );

    const result = await readChatResponse(
      res,
      "ollama",
      (d) => deltas.push(d),
      {
        startedAt: 0,
      },
    );

    expect(deltas).toEqual(["Hi", " there"]);
    expect(result).toEqual({
      content: "Hi there",
      completionTokens: 30,
      generationSeconds: 2,
    });
  });

  it("reads a plain JSON reply from servers that ignore stream", async () => {
    const res = Response.json({
      choices: [{ message: { content: "whole reply" } }],
      usage: { completion_tokens: 12, total_tokens: 40 },
    });
    const deltas: string[] = [];

    const result = await readChatResponse(
      res,
      "gpt4all",
      (d) => deltas.push(d),
      {
        startedAt: 0,
        now: () => 3000,
      },
    );

    expect(deltas).toEqual(["whole reply"]);
    expect(result).toEqual({
      content: "whole reply",
      completionTokens: 12,
      generationSeconds: 3,
    });
  });

  it("reads a non-streaming Ollama reply", async () => {
    const res = Response.json({
      message: { content: "ok" },
      eval_count: 8,
      eval_duration: 500000000,
    });
    const result = await readChatResponse(res, "ollama", () => {}, {
      startedAt: 0,
    });
    expect(result).toEqual({
      content: "ok",
      completionTokens: 8,
      generationSeconds: 0.5,
    });
  });
});

describe("tokensPerSecond", () => {
  it.each<[ChatResult, number | undefined]>([
    [{ content: "", completionTokens: 20, generationSeconds: 2 }, 10],
    [{ content: "", completionTokens: 20 }, undefined],
    [{ content: "", generationSeconds: 2 }, undefined],
    [{ content: "", completionTokens: 20, generationSeconds: 0 }, undefined],
  ])("%o -> %s", (result, expected) => {
    expect(tokensPerSecond(result)).toBe(expected);
  });
});
