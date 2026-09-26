import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type ApiConfig,
  getApiKey,
  getAuthKey,
  isInsecureRemoteEndpoint,
  isSendingApiKey,
  type ReasoningSupport,
  setApiKey,
  setSendApiKey,
} from "../lib/apiConfig";
import {
  fetchLmStudioReasoning,
  findLmStudioReasoning,
  type LmStudioReasoning,
} from "../lib/lmstudio";
import { guessReasoningSupport, showsReasoningMark } from "../lib/reasoning";

type ModelInfo = {
  id: string;
  reasoning: ReasoningSupport;
  /** Whether a "toggle" model reasons by default. */
  reasoningDefaultOn?: boolean;
};

/** Settings view: provider/endpoint/API key/model selection and per-model system prompt editing. */
export function Settings({
  config,
  setConfig,
  systemPrompt,
  setSystemPrompt,
}: {
  config: ApiConfig;
  setConfig: (c: ApiConfig) => void;
  systemPrompt: string;
  setSystemPrompt: (s: string) => void;
}) {
  const { t } = useTranslation();
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  // Apply the endpoint only when committed (blur/Enter) so partially typed URLs are never requested with the API key
  const [endpointDraft, setEndpointDraft] = useState(config.endpoint);

  // Reflect endpoint changes from provider switches or config loading in the input
  useEffect(() => {
    setEndpointDraft(config.endpoint);
  }, [config.endpoint]);

  const commitEndpoint = () => {
    const endpoint = endpointDraft.trim();
    setEndpointDraft(endpoint);
    if (endpoint !== config.endpoint) setConfig({ ...config, endpoint });
  };

  // API key to send (the selected provider's key, or empty when sending is off)
  const authKey = getAuthKey(config);

  const copySystemPromptToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(systemPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  // Fetch the model list when the provider or endpoint changes
  useEffect(() => {
    if (!config.endpoint) return;

    // OpenAI requires authentication, so skip when no API key is set
    const requiresAuth = config.provider === "openai";
    if (requiresAuth && !authKey) {
      setAvailableModels([]);
      return;
    }

    async function fetchModels() {
      setLoadingModels(true);
      setModelsError("");
      try {
        // Endpoint for each provider
        let endpoint: string;
        if (config.provider === "ollama") {
          endpoint = `${config.endpoint}/api/tags`;
        } else if (config.provider === "gpt4all") {
          // GPT4ALL is reached through the proxy (it has no CORS support)
          endpoint = "/api/gpt4all/v1/models";
        } else {
          // OpenAI and LM Studio are reached directly
          endpoint = `${config.endpoint}/v1/models`;
        }

        const res = await fetch(endpoint, {
          headers: {
            ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}),
          },
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
        }

        const data = await res.json();

        // Parse the model list per provider and detect reasoning support
        let modelInfos: ModelInfo[];
        if (config.provider === "ollama") {
          const modelNames =
            data.models?.map((m: { name: string }) => m.name) || [];
          // For Ollama, fetch each model's details to detect reasoning support
          modelInfos = await Promise.all(
            modelNames.map(async (name: string) => {
              try {
                const detailRes = await fetch(`${config.endpoint}/api/show`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name }),
                });
                if (detailRes.ok) {
                  const detail = await detailRes.json();
                  // Detect from "reasoning" in the modelfile or parameters, or from the model name
                  const modelfile = detail.modelfile?.toLowerCase() || "";
                  const parameters = JSON.stringify(
                    detail.parameters || {},
                  ).toLowerCase();
                  const reasoning: ReasoningSupport =
                    modelfile.includes("reasoning") ||
                    parameters.includes("reasoning")
                      ? "effort"
                      : guessReasoningSupport(name);
                  return { id: name, reasoning };
                }
              } catch {
                // On error, fall back to the model name
              }
              return { id: name, reasoning: guessReasoningSupport(name) };
            }),
          );
        } else {
          // For OpenAI-compatible APIs, detect from the model name (they rarely expose details)
          const modelIds = data.data?.map((m: { id: string }) => m.id) || [];
          // LM Studio's native API exposes each model's reasoning setting (effort / on-off)
          const lmStudioReasoning =
            config.provider === "lmstudio"
              ? await fetchLmStudioReasoning(config.endpoint, authKey)
              : new Map<string, LmStudioReasoning>();
          modelInfos = modelIds.map((id: string) => {
            const info = findLmStudioReasoning(lmStudioReasoning, id);
            return {
              id,
              reasoning: info?.support ?? guessReasoningSupport(id),
              reasoningDefaultOn: info?.defaultOn,
            };
          });
        }

        setAvailableModels(modelInfos);

        // Select the first model when the current one is unset or not in the list
        const selected =
          modelInfos.find((m) => m.id === config.model) ?? modelInfos[0];
        if (
          selected &&
          (selected.id !== config.model ||
            selected.reasoning !== config.reasoningSupport)
        ) {
          setConfig({
            ...config,
            model: selected.id,
            reasoningSupport: selected.reasoning,
            // Reset the on/off choice to the model default when the model changes
            reasoningEnabled:
              selected.id === config.model
                ? config.reasoningEnabled
                : undefined,
          });
        }
      } catch (e) {
        setModelsError(String(e));
        setAvailableModels([]);
      } finally {
        setLoadingModels(false);
      }
    }

    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.provider,
    config.endpoint,
    authKey,
    config.model,
    config,
    setConfig,
  ]);

  // GPT4ALL does not support reasoning parameters, so no reasoning control is shown
  const selectedModel =
    config.provider === "gpt4all"
      ? undefined
      : availableModels.find((m) => m.id === config.model);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {t("settingsTitle")}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {t("settingsDesc")}
          </p>
        </div>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4 dark:bg-slate-800 dark:border-slate-700"
        >
          <div>
            <label
              className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300"
              htmlFor="provider"
            >
              {t("provider")}
            </label>
            <select
              id="provider"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:ring-blue-900"
              value={config.provider}
              onChange={(e) => {
                const newProvider = e.target.value as ApiConfig["provider"];
                // Default endpoint for each provider
                const defaultEndpoints: Record<ApiConfig["provider"], string> =
                  {
                    openai: "https://api.openai.com",
                    lmstudio: "http://localhost:1234",
                    gpt4all: "http://localhost:4891",
                    ollama: "http://localhost:11434",
                    llamacpp: "http://localhost:8080",
                  };
                // API keys are kept per provider, so only the new provider's own key is used
                setConfig({
                  ...config,
                  provider: newProvider,
                  endpoint: defaultEndpoints[newProvider],
                  model: undefined,
                  reasoningSupport: undefined,
                  reasoningEnabled: undefined,
                });
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="lmstudio">LM Studio</option>
              <option value="gpt4all">GPT4ALL</option>
              <option value="ollama">Ollama</option>
              <option value="llamacpp">llama.cpp</option>
            </select>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300"
              htmlFor="endpoint"
            >
              {t("endpoint")}
            </label>
            <input
              id="endpoint"
              type="text"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition placeholder-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-blue-900"
              value={endpointDraft}
              onChange={(e) => setEndpointDraft(e.target.value)}
              onBlur={commitEndpoint}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEndpoint();
              }}
              placeholder="https://api.openai.com"
            />
            {isInsecureRemoteEndpoint(config.endpoint) && (
              <p
                id="endpointWarning"
                role="alert"
                className="mt-1.5 text-sm text-amber-700 dark:text-amber-400"
              >
                {t("insecureEndpointWarning")}
              </p>
            )}
          </div>

          <div>
            <label
              className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300"
              htmlFor="apikey"
            >
              {t("apiKey")}
            </label>
            <input
              id="apikey"
              type="password"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition placeholder-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-blue-900"
              value={getApiKey(config)}
              onChange={(e) => setConfig(setApiKey(config, e.target.value))}
              placeholder="sk-..."
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                id="sendApiKey"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                checked={isSendingApiKey(config)}
                onChange={(e) =>
                  setConfig(setSendApiKey(config, e.target.checked))
                }
              />
              {t("sendApiKey")}
            </label>
            <label className="mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                id="saveApiKeys"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                checked={config.saveApiKeys !== false}
                onChange={(e) =>
                  setConfig({ ...config, saveApiKeys: e.target.checked })
                }
              />
              {t("saveApiKeys")}
            </label>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300"
              htmlFor="model"
            >
              {t("model")}
            </label>
            {loadingModels ? (
              <div className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
                {t("loadingModels")}
              </div>
            ) : modelsError ? (
              <div className="w-full rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-red-600 text-sm dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
                {t("modelsError")}: {modelsError}
              </div>
            ) : availableModels.length > 0 ? (
              <select
                id="model"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:ring-blue-900"
                value={config.model || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    model: e.target.value,
                    reasoningSupport: availableModels.find(
                      (m) => m.id === e.target.value,
                    )?.reasoning,
                    reasoningEnabled: undefined,
                  })
                }
              >
                {availableModels.map((modelInfo) => (
                  <option key={modelInfo.id} value={modelInfo.id}>
                    {modelInfo.id}
                    {showsReasoningMark(modelInfo.reasoning) ? " 🧠" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
                {t("noModels")}
              </div>
            )}
          </div>

          {selectedModel?.reasoning === "toggle" && (
            <div>
              <label
                className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300"
                htmlFor="reasoningToggle"
              >
                {t("reasoningToggle")}
              </label>
              <select
                id="reasoningToggle"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:ring-blue-900"
                value={
                  (config.reasoningEnabled ??
                  selectedModel.reasoningDefaultOn ??
                  true)
                    ? "on"
                    : "off"
                }
                onChange={(e) =>
                  setConfig({
                    ...config,
                    reasoningEnabled: e.target.value === "on",
                  })
                }
              >
                <option value="on">{t("reasoningOn")}</option>
                <option value="off">{t("reasoningOff")}</option>
              </select>
            </div>
          )}

          {selectedModel?.reasoning === "effort" && (
            <div>
              <label
                className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300"
                htmlFor="reasoningEffort"
              >
                {t("reasoningEffort")}
              </label>
              <select
                id="reasoningEffort"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:ring-blue-900"
                value={config.reasoningEffort || "medium"}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    reasoningEffort: e.target
                      .value as ApiConfig["reasoningEffort"],
                  })
                }
              >
                <option value="low">{t("reasoningLow")}</option>
                <option value="medium">{t("reasoningMedium")}</option>
                <option value="high">{t("reasoningHigh")}</option>
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
                htmlFor="systemprompt"
              >
                {t("systemPrompt")}
              </label>
              <button
                type="button"
                onClick={copySystemPromptToClipboard}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-all duration-200 flex items-center gap-1.5"
                title={t("copySystemPrompt")}
                disabled={!systemPrompt}
              >
                {copiedPrompt ? "✓" : "📋"}{" "}
                {copiedPrompt ? "Copied!" : t("copySystemPrompt")}
              </button>
            </div>
            <textarea
              id="systemprompt"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition placeholder-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-blue-900 resize-none"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t("systemPromptPlaceholder")}
              rows={3}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
