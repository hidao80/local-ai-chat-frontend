import type { ReasoningSupport } from "./apiConfig";

/** Reasoning settings that select an effort level (as opposed to plain "on"/"off"). */
const EFFORT_OPTIONS = new Set(["low", "medium", "high"]);

/** Reasoning capability of one LM Studio model. */
export type LmStudioReasoning = {
  support: ReasoningSupport;
  /** Whether reasoning is on when the request does not specify it. */
  defaultOn: boolean;
};

type NativeModel = {
  key?: unknown;
  variants?: unknown;
  selected_variant?: unknown;
  capabilities?: {
    reasoning?: { allowed_options?: unknown; default?: unknown };
  };
};

/** Classify `capabilities.reasoning.allowed_options` of LM Studio's native API. */
function classifyOptions(options: unknown[]): ReasoningSupport {
  if (options.some((o) => EFFORT_OPTIONS.has(o as string))) return "effort";
  if (options.includes("on")) {
    return options.includes("off") ? "toggle" : "fixed";
  }
  return "none";
}

/**
 * Map model ids to their reasoning capability from LM Studio's native
 * `GET /api/v1/models` response. Models without a reasoning config are omitted.
 * Variant ids (`key@quant`) are included so either form matches.
 */
export function parseLmStudioReasoning(
  data: unknown,
): Map<string, LmStudioReasoning> {
  const result = new Map<string, LmStudioReasoning>();
  const models = (data as { models?: unknown } | null)?.models;
  if (!Array.isArray(models)) return result;
  for (const model of models as NativeModel[]) {
    const reasoning = model?.capabilities?.reasoning;
    const options = reasoning?.allowed_options;
    if (!Array.isArray(options)) continue;
    const support = classifyOptions(options);
    if (support === "none") continue;
    const info: LmStudioReasoning = {
      support,
      defaultOn: reasoning?.default !== "off",
    };
    const variants = Array.isArray(model.variants) ? model.variants : [];
    for (const id of [model.key, model.selected_variant, ...variants]) {
      if (typeof id === "string") result.set(id, info);
    }
  }
  return result;
}

/** Look up `modelId` (as listed by `/v1/models`), falling back to its base key. */
export function findLmStudioReasoning(
  reasoningById: Map<string, LmStudioReasoning>,
  modelId: string,
): LmStudioReasoning | undefined {
  return reasoningById.get(modelId) ?? reasoningById.get(modelId.split("@")[0]);
}

/**
 * Fetch per-model reasoning capability from LM Studio's native API.
 * Returns an empty map when the API is unavailable (LM Studio < 0.4, CORS, etc.)
 * so callers can fall back to name-based detection.
 */
export async function fetchLmStudioReasoning(
  endpoint: string,
  apiKey: string,
): Promise<Map<string, LmStudioReasoning>> {
  try {
    const res = await fetch(`${endpoint}/api/v1/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) return new Map();
    return parseLmStudioReasoning(await res.json());
  } catch {
    return new Map();
  }
}
