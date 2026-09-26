type Provider = "openai" | "lmstudio" | "gpt4all" | "ollama" | "llamacpp";

/** Connection settings for the configured LLM endpoint. */
export type ApiConfig = {
  endpoint: string;
  provider: Provider;
  /** API keys per provider. A key is only ever sent while its own provider is selected. */
  apiKeys?: Partial<Record<Provider, string>>;
  /** Per-provider switch for sending the API key; unset means "send". */
  sendApiKey?: Partial<Record<Provider, boolean>>;
  /** Whether API keys are persisted to IndexedDB; unset means "save". Keys are stored unencrypted. */
  saveApiKeys?: boolean;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
  /** How the selected model's reasoning can be controlled, as detected from the model list. */
  reasoningSupport?: ReasoningSupport;
  /** User's ON/OFF choice for a "toggle" model; undefined keeps the model default. */
  reasoningEnabled?: boolean;
};

/** The API key saved for the selected provider (shown in the settings form). */
export function getApiKey(config: ApiConfig): string {
  return config.apiKeys?.[config.provider] ?? "";
}

/** Whether the selected provider's API key may be sent. */
export function isSendingApiKey(config: ApiConfig): boolean {
  return config.sendApiKey?.[config.provider] ?? true;
}

/** The API key to put in the Authorization header, or "" when none should be sent. */
export function getAuthKey(config: ApiConfig): string {
  return isSendingApiKey(config) ? getApiKey(config) : "";
}

/** Save `apiKey` for the selected provider, leaving other providers' keys untouched. */
export function setApiKey(config: ApiConfig, apiKey: string): ApiConfig {
  return {
    ...config,
    apiKeys: { ...config.apiKeys, [config.provider]: apiKey },
  };
}

/** Turn sending the API key on/off for the selected provider. */
export function setSendApiKey(config: ApiConfig, send: boolean): ApiConfig {
  return {
    ...config,
    sendApiKey: { ...config.sendApiKey, [config.provider]: send },
  };
}

/** Hosts that never leave this device, where plain http is acceptable. */
function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^127(\.\d{1,3}){3}$/.test(hostname) ||
    hostname === "[::1]"
  );
}

/**
 * Whether `endpoint` sends messages and the API key unencrypted over a network:
 * an `http:` URL whose host is not this device. Unparsable input is not flagged.
 */
export function isInsecureRemoteEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "http:" && !isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Move a key saved in the legacy single `apiKey` field to its provider's slot.
 * The legacy key belonged to the provider it was saved with.
 */
export function migrateApiKey(
  stored: ApiConfig & { apiKey?: string },
): ApiConfig {
  const { apiKey, ...config } = stored;
  if (!apiKey || config.apiKeys?.[config.provider] !== undefined) return config;
  return setApiKey(config, apiKey);
}

/**
 * - `effort`: selectable level (low/medium/high)
 * - `toggle`: can be switched on/off
 * - `fixed`: always reasons, not configurable
 * - `none`: no reasoning
 */
export type ReasoningSupport = "effort" | "toggle" | "fixed" | "none";
