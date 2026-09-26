/** Connection settings for the configured LLM endpoint. */
export type ApiConfig = {
  endpoint: string;
  apiKey: string;
  provider: "openai" | "lmstudio" | "gpt4all" | "ollama" | "llamacpp";
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
  /** How the selected model's reasoning can be controlled, as detected from the model list. */
  reasoningSupport?: ReasoningSupport;
  /** User's ON/OFF choice for a "toggle" model; undefined keeps the model default. */
  reasoningEnabled?: boolean;
};

/**
 * - `effort`: selectable level (low/medium/high)
 * - `toggle`: can be switched on/off
 * - `fixed`: always reasons, not configurable
 * - `none`: no reasoning
 */
export type ReasoningSupport = "effort" | "toggle" | "fixed" | "none";
