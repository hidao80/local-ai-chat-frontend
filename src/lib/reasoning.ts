import type { ApiConfig, ReasoningSupport } from "./apiConfig";
import { isReasoningModel } from "./model";

/** Name-based guess used when the provider exposes no reasoning capability. */
export function guessReasoningSupport(
  modelName: string | undefined,
): ReasoningSupport {
  return isReasoningModel(modelName) ? "effort" : "none";
}

/** Detected reasoning support, or a name-based guess for configs saved before detection. */
export function resolveReasoningSupport(config: ApiConfig): ReasoningSupport {
  return config.reasoningSupport ?? guessReasoningSupport(config.model);
}

/** Whether to show the 🧠 mark: any model that can reason, including always-on ("fixed") ones. */
export function showsReasoningMark(support: ReasoningSupport): boolean {
  return support !== "none";
}

/** Reasoning fields for an OpenAI-compatible chat request, plus the label shown on the reply. */
export function getReasoningRequest(config: ApiConfig): {
  params: { reasoning_effort?: string };
  label?: string;
} {
  const support = resolveReasoningSupport(config);
  if (support === "effort" && config.reasoningEffort) {
    return {
      params: { reasoning_effort: config.reasoningEffort },
      label: config.reasoningEffort,
    };
  }
  if (support === "toggle" && config.reasoningEnabled !== undefined) {
    // LM Studio on/off models are disabled by "none" and enabled by any effort value
    // (the level itself is ignored; "on" is rejected with HTTP 400)
    return config.reasoningEnabled
      ? { params: { reasoning_effort: "medium" }, label: "on" }
      : { params: { reasoning_effort: "none" }, label: "off" };
  }
  return { params: {} };
}
