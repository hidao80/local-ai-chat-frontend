import type { ApiConfig, ReasoningSupport } from "./apiConfig";
import { isReasoningModel } from "./model";

/** Detected reasoning support, or a name-based guess for configs saved before detection. */
export function resolveReasoningSupport(config: ApiConfig): ReasoningSupport {
  return (
    config.reasoningSupport ??
    (isReasoningModel(config.model) ? "effort" : "none")
  );
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
    // LM Studio の on/off 型モデルは "none" で無効化され、effort 値の指定で有効化される
    // （レベル自体は無視される。"on" は 400 エラーになる）
    return config.reasoningEnabled
      ? { params: { reasoning_effort: "medium" }, label: "on" }
      : { params: { reasoning_effort: "none" }, label: "off" };
  }
  return { params: {} };
}
