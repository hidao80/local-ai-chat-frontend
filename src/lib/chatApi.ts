import { type ApiConfig, getAuthKey } from "./apiConfig";
import { getReasoningRequest, resolveReasoningSupport } from "./reasoning";

/** A message as sent to the LLM API (role and content only). */
export type ChatMessage = { role: string; content: string };

/** Everything needed to call the chat endpoint for the current config. */
export type ChatRequest = {
  url: string;
  init: RequestInit;
  /** Model name used for the request (also shown on the reply). */
  model: string;
  /** Reasoning setting shown on the reply (effort level or on/off). */
  reasoningLabel?: string;
};

/** Parsed reply plus what is needed to compute generation speed. */
export type ChatResult = {
  content: string;
  /** Tokens generated for the reply (excludes the prompt), when the server reports it. */
  completionTokens?: number;
  /** Seconds spent generating the reply, when known. */
  generationSeconds?: number;
};

const DEFAULT_MODEL: Record<ApiConfig["provider"], string> = {
  openai: "gpt-3.5-turbo",
  lmstudio: "gpt-3.5-turbo",
  gpt4all: "gpt-3.5-turbo",
  ollama: "llama2",
  llamacpp: "gpt-3.5-turbo",
};

/** The model a request will use: the configured one, or the provider default. */
export function resolveModel(config: ApiConfig): string {
  return config.model || DEFAULT_MODEL[config.provider];
}

/** Build the chat request for `config`. Streaming is requested where the provider supports it. */
export function buildChatRequest(
  config: ApiConfig,
  messages: ChatMessage[],
): ChatRequest {
  const model = resolveModel(config);
  let url: string;
  let body: Record<string, unknown>;
  let reasoningLabel: string | undefined;

  if (config.provider === "ollama") {
    // Ollama streams NDJSON and uses the "think" parameter
    const useThink =
      resolveReasoningSupport(config) === "effort" && config.reasoningEffort;
    reasoningLabel = useThink ? config.reasoningEffort : undefined;
    url = `${config.endpoint}/api/chat`;
    body = {
      model,
      messages,
      stream: true,
      ...(useThink ? { think: config.reasoningEffort } : {}),
    };
  } else if (config.provider === "gpt4all") {
    // GPT4ALL is reached through the dev proxy and supports neither streaming nor reasoning parameters
    url = "/api/gpt4all/v1/chat/completions";
    body = { model, messages };
  } else {
    // OpenAI-compatible servers stream SSE; include_usage adds token counts to the last chunk
    const reasoning = getReasoningRequest(config);
    reasoningLabel = reasoning.label;
    url = `${config.endpoint}/v1/chat/completions`;
    body = {
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...reasoning.params,
    };
  }

  const authKey = getAuthKey(config);
  return {
    url,
    model,
    reasoningLabel,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}),
      },
      body: JSON.stringify(body),
    },
  };
}

type OpenAIChunk = {
  choices?: { delta?: { content?: string }; message?: { content?: string } }[];
  usage?: { completion_tokens?: number };
  error?: unknown;
};

type OllamaChunk = {
  message?: { content?: string };
  done?: boolean;
  eval_count?: number;
  /** Nanoseconds spent generating `eval_count` tokens. */
  eval_duration?: number;
  error?: unknown;
};

/** Yield complete lines from a streamed body as they arrive. */
async function* readLines(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) yield line.replace(/\r$/, "");
    if (done) break;
  }
  if (buffer) yield buffer;
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : JSON.stringify(error);
}

/**
 * Read a chat response, calling `onDelta` with each new piece of text.
 * Handles SSE (OpenAI-compatible streaming), NDJSON (Ollama streaming) and plain
 * JSON (servers that ignore `stream`), picked by the response content type.
 * When streaming, generation time runs from the first received text to the end
 * of the stream, so prompt processing and network setup are not counted.
 * Without streaming it falls back to the whole request time from `startedAt`.
 */
export async function readChatResponse(
  res: Response,
  provider: ApiConfig["provider"],
  onDelta: (text: string) => void,
  {
    startedAt,
    now = () => performance.now(),
  }: { startedAt: number; now?: () => number },
): Promise<ChatResult> {
  const contentType = res.headers.get("content-type") ?? "";
  let content = "";
  let firstTextAt: number | undefined;
  const append = (text: string | undefined) => {
    if (!text) return;
    firstTextAt ??= now();
    content += text;
    onDelta(text);
  };
  const elapsedSinceFirstText = () =>
    firstTextAt === undefined ? undefined : (now() - firstTextAt) / 1000;

  if (res.body && contentType.includes("text/event-stream")) {
    let completionTokens: number | undefined;
    for await (const line of readLines(res.body)) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") break;
      const chunk = JSON.parse(data) as OpenAIChunk;
      if (chunk.error) throw new Error(errorMessage(chunk.error));
      append(chunk.choices?.[0]?.delta?.content);
      completionTokens = chunk.usage?.completion_tokens ?? completionTokens;
    }
    return {
      content,
      completionTokens,
      generationSeconds: elapsedSinceFirstText(),
    };
  }

  if (res.body && contentType.includes("ndjson")) {
    let final: OllamaChunk | undefined;
    for await (const line of readLines(res.body)) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line) as OllamaChunk;
      if (chunk.error) throw new Error(errorMessage(chunk.error));
      append(chunk.message?.content);
      if (chunk.done) final = chunk;
    }
    return {
      content,
      completionTokens: final?.eval_count,
      // Ollama measures generation itself, which is more precise than wall-clock time
      generationSeconds: final?.eval_duration
        ? final.eval_duration / 1e9
        : elapsedSinceFirstText(),
    };
  }

  // Non-streaming JSON: the whole reply arrives at once
  const data = await res.json();
  const requestSeconds = (now() - startedAt) / 1000;
  if (provider === "ollama") {
    const ollama = data as OllamaChunk;
    append(ollama.message?.content);
    return {
      content,
      completionTokens: ollama.eval_count,
      generationSeconds: ollama.eval_duration
        ? ollama.eval_duration / 1e9
        : requestSeconds,
    };
  }
  const openai = data as OpenAIChunk;
  append(openai.choices?.[0]?.message?.content);
  return {
    content,
    completionTokens: openai.usage?.completion_tokens,
    generationSeconds: requestSeconds,
  };
}

/** Tokens per second for a finished reply, or undefined when it cannot be measured. */
export function tokensPerSecond(result: ChatResult): number | undefined {
  const { completionTokens, generationSeconds } = result;
  if (!completionTokens || !generationSeconds || generationSeconds <= 0) {
    return undefined;
  }
  return completionTokens / generationSeconds;
}
