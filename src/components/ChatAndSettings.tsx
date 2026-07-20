import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { marked } from "marked";

export type ApiConfig = {
  endpoint: string;
  apiKey: string;
  provider: "openai" | "lmstudio" | "gpt4all" | "ollama" | "llamacpp";
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
};

// reasoning modelかどうかを判定する関数
function isReasoningModel(modelName: string | undefined): boolean {
  if (!modelName) return false;
  const lowerName = modelName.toLowerCase();
  // o1系、reasoning、gpt-ossなどのパターンをチェック
  return (
    lowerName.includes("o1") ||
    lowerName.includes("reasoning") ||
    lowerName.includes("gpt-oss") ||
    lowerName.includes("deepseek-r1")
  );
}

type ModelInfo = {
  id: string;
  supportsReasoning: boolean;
};

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

  const copySystemPromptToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(systemPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  // プロバイダーまたはエンドポイントが変更されたときにモデル一覧を取得
  useEffect(() => {
    if (!config.endpoint) return;

    // OpenAIは認証が必要なプロバイダーで、APIキーが未設定ならスキップ
    const requiresAuth = config.provider === "openai";
    if (requiresAuth && !config.apiKey) {
      setAvailableModels([]);
      return;
    }

    async function fetchModels() {
      setLoadingModels(true);
      setModelsError("");
      try {
        // 各プロバイダのエンドポイント
        let endpoint: string;
        if (config.provider === "ollama") {
          endpoint = `${config.endpoint}/api/tags`;
        } else if (config.provider === "gpt4all") {
          // GPT4ALLはプロクシ経由で接続（CORS対応）
          endpoint = "/api/gpt4all/v1/models";
        } else {
          // OpenAI、LM Studioは直接接続
          endpoint = `${config.endpoint}/v1/models`;
        }

        const res = await fetch(endpoint, {
          headers: {
            ...(config.apiKey
              ? { Authorization: `Bearer ${config.apiKey}` }
              : {}),
          },
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
        }

        const data = await res.json();

        // プロバイダーに応じてモデル一覧を解析し、reasoning対応を判定
        let modelInfos: ModelInfo[];
        if (config.provider === "ollama") {
          const modelNames =
            data.models?.map((m: { name: string }) => m.name) || [];
          // Ollamaの場合、各モデルの詳細を取得してreasoning対応を判定
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
                  // modelfileやparametersに"reasoning"が含まれるか、モデル名で判定
                  const modelfile = detail.modelfile?.toLowerCase() || "";
                  const parameters = JSON.stringify(
                    detail.parameters || {},
                  ).toLowerCase();
                  const supportsReasoning =
                    modelfile.includes("reasoning") ||
                    parameters.includes("reasoning") ||
                    isReasoningModel(name);
                  return { id: name, supportsReasoning };
                }
              } catch {
                // エラー時はモデル名から判定
              }
              return { id: name, supportsReasoning: isReasoningModel(name) };
            }),
          );
        } else {
          // OpenAI互換の場合、モデル名から判定（APIに詳細情報がない場合が多い）
          const modelIds = data.data?.map((m: { id: string }) => m.id) || [];
          modelInfos = modelIds.map((id: string) => ({
            id,
            supportsReasoning: isReasoningModel(id),
          }));
        }

        setAvailableModels(modelInfos);

        // 現在のモデルが一覧にない、または未設定の場合は最初のモデルを選択
        const modelIds = modelInfos.map((m) => m.id);
        if (
          modelInfos.length > 0 &&
          (!config.model || !modelIds.includes(config.model))
        ) {
          setConfig({ ...config, model: modelInfos[0].id });
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
    config.apiKey,
    config.model,
    config,
    setConfig,
  ]);

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
                // プロバイダーごとのデフォルトエンドポイント
                const defaultEndpoints: Record<ApiConfig["provider"], string> =
                  {
                    openai: "https://api.openai.com",
                    lmstudio: "http://localhost:1234",
                    gpt4all: "http://localhost:4891",
                    ollama: "http://localhost:11434",
                    llamacpp: "http://localhost:8080",
                  };
                setConfig({
                  ...config,
                  provider: newProvider,
                  endpoint: defaultEndpoints[newProvider],
                  model: undefined,
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
              value={config.endpoint}
              onChange={(e) =>
                setConfig({ ...config, endpoint: e.target.value })
              }
              placeholder="https://api.openai.com"
            />
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
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300"
              htmlFor="model"
            >
              {t("model") || "Model"}
            </label>
            {loadingModels ? (
              <div className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
                {t("loadingModels") || "モデルを読み込んでいます..."}
              </div>
            ) : modelsError ? (
              <div className="w-full rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-red-600 text-sm dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
                {t("modelsError") || "モデル取得エラー"}: {modelsError}
              </div>
            ) : availableModels.length > 0 ? (
              <select
                id="model"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:ring-blue-900"
                value={config.model || ""}
                onChange={(e) =>
                  setConfig({ ...config, model: e.target.value })
                }
              >
                {availableModels.map((modelInfo) => (
                  <option key={modelInfo.id} value={modelInfo.id}>
                    {modelInfo.id}
                    {modelInfo.supportsReasoning ? " 🧠" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
                {t("noModels") || "モデルが見つかりません"}
              </div>
            )}
          </div>

          {availableModels.find((m) => m.id === config.model && config.provider !== "gpt4all")
            ?.supportsReasoning && (
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

function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  // Portalを使用してbody直下にレンダリング（ビューポート中央に表示）
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
          {title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            {t("cancel") || "キャンセル"}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition"
          >
            {t("delete") || "削除"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ChatSidebar({
  sessions,
  currentSessionId,
  onLoadSession,
  onNewChat,
  onDeleteSession,
  isOpen,
  onClose,
}: {
  sessions: ChatSession[];
  currentSessionId: string;
  onLoadSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleDeleteClick = (sessionId: string) => {
    setDeleteTargetId(sessionId);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      onDeleteSession(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteTargetId(null);
  };

  return (
    <>
      {/* 削除確認モーダル */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title={t("deleteConfirmTitle") || "チャットを削除しますか？"}
        message={t("deleteConfirmMessage") || "この操作は取り消せません"}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* モバイル用オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* サイドバー */}
      <div
        className={`fixed lg:static top-0 left-0 h-full w-64 bg-slate-50 border-r border-slate-200 dark:bg-slate-900 dark:border-slate-700 flex flex-col z-50 transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* ヘッダー */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">
            {t("chatHistory") || "チャット履歴"}
          </h2>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {/* 新規チャットボタン */}
        <div className="p-4">
          <button
            onClick={onNewChat}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition"
          >
            + {t("newChat") || "新規チャット"}
          </button>
        </div>

        {/* チャット一覧 */}
        <div className="flex-1 overflow-y-auto px-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative mb-2 rounded-xl p-3 cursor-pointer transition ${
                session.id === currentSessionId
                  ? "bg-blue-100 dark:bg-blue-900/30"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              onClick={() => onLoadSession(session.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {session.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(session.id);
                  }}
                  className="flex-shrink-0 opacity-40 group-hover:opacity-100 hover:scale-110 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 text-lg"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-8">
              {t("noHistory") || "履歴がありません"}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function Minimap({
  messages,
  scrollContainerRef,
  messageRefs,
}: {
  messages: Message[];
  scrollContainerRef: { current: HTMLDivElement | null };
  messageRefs: { current: (HTMLDivElement | null)[] };
}) {
  const { t } = useTranslation();
  const [scroll, setScroll] = useState({ ratio: 0, viewSize: 1 });

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const update = () => {
      const canScroll = el.scrollHeight - el.clientHeight;
      setScroll({
        ratio: canScroll > 0 ? el.scrollTop / canScroll : 0,
        viewSize: el.scrollHeight > 0 ? el.clientHeight / el.scrollHeight : 1,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [scrollContainerRef]);

  const onClickMessage = (i: number) => {
    messageRefs.current[i]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <div className="relative w-5 bg-slate-50 border-l border-slate-200 overflow-hidden h-full dark:bg-slate-800 dark:border-slate-700">
      <div className="absolute inset-0 flex flex-col gap-[2px]">
        {messages.map((m, i) => (
          <button
            key={i}
            onClick={() => onClickMessage(i)}
            title={`${m.role === "user" ? t("you") : t("ai")}: ${m.content.slice(0, 40)}`}
            className={`flex-1 cursor-pointer transition-opacity hover:opacity-100 opacity-60 border-none outline-none
                            ${m.role === "user" ? "bg-blue-400" : "bg-slate-300 dark:bg-slate-600"}`}
            style={{ minHeight: "2px" }}
          />
        ))}
      </div>
      {scroll.viewSize < 1 && (
        <div
          className="absolute left-0 right-0 border-2 border-blue-500 rounded pointer-events-none"
          style={{
            top: `${scroll.ratio * (1 - scroll.viewSize) * 100}%`,
            height: `${scroll.viewSize * 100}%`,
          }}
        />
      )}
    </div>
  );
}

type Message = {
  role: string;
  content: string;
  model?: string;
  provider?: ApiConfig["provider"];
  reasoningEffort?: string;
  tokensPerSecond?: number;
  timestamp?: number;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

// IndexedDBの操作関数
const CHAT_DB_NAME = "chat-history";
const CHAT_STORE_NAME = "sessions";
const CHAT_DB_VERSION = 1;

function openChatDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CHAT_DB_NAME, CHAT_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CHAT_STORE_NAME)) {
        db.createObjectStore(CHAT_STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveChatSession(session: ChatSession): Promise<void> {
  const db = await openChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE_NAME, "readwrite");
    tx.objectStore(CHAT_STORE_NAME).put(session);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function loadChatSession(id: string): Promise<ChatSession | null> {
  const db = await openChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE_NAME, "readonly");
    const req = tx.objectStore(CHAT_STORE_NAME).get(id);
    req.onsuccess = () => {
      db.close();
      resolve(req.result || null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function loadAllChatSessions(): Promise<ChatSession[]> {
  const db = await openChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE_NAME, "readonly");
    const req = tx.objectStore(CHAT_STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      const sessions = req.result as ChatSession[];
      // 更新日時の降順でソート
      sessions.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(sessions);
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteChatSession(id: string): Promise<void> {
  const db = await openChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE_NAME, "readwrite");
    tx.objectStore(CHAT_STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export function Chat({
  config,
  systemPrompt,
}: {
  config: ApiConfig;
  systemPrompt: string;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string>(
    () => `session-${Date.now()}`,
  );
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // チャット履歴を読み込む
  useEffect(() => {
    loadAllChatSessions().then(setChatSessions).catch(console.error);
  }, []);

  // メッセージが変更されたら保存
  useEffect(() => {
    if (messages.length === 0) return;
    const title =
      messages.find((m) => m.role === "user")?.content.slice(0, 50) ||
      "New Chat";
    const session: ChatSession = {
      id: currentSessionId,
      title,
      messages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveChatSession(session)
      .then(() => {
        // 履歴リストを更新
        loadAllChatSessions().then(setChatSessions).catch(console.error);
      })
      .catch(console.error);
  }, [messages, currentSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const check = () => {
      setAtBottom(el.scrollHeight - el.clientHeight - el.scrollTop < 40);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, []);

  const loadSession = async (sessionId: string) => {
    const session = await loadChatSession(sessionId);
    if (session) {
      setCurrentSessionId(session.id);
      setMessages(session.messages);
    }
  };

  const createNewChat = () => {
    const newSessionId = `session-${Date.now()}`;
    setCurrentSessionId(newSessionId);
    setMessages([]);
  };

  const deleteSession = async (sessionId: string) => {
    await deleteChatSession(sessionId);
    const sessions = await loadAllChatSessions();
    setChatSessions(sessions);
    if (sessionId === currentSessionId) {
      createNewChat();
    }
  };

  const copyToClipboard = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex(null), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  async function sendMessage() {
    if (!input || loading) return;
    const userInput = input;
    setInput("");
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userInput, timestamp: Date.now() },
    ]);

    const startTime = Date.now();

    try {
      // 各プロバイダのエンドポイント
      let endpoint: string;
      if (config.provider === "ollama") {
        endpoint = `${config.endpoint}/api/chat`;
      } else if (config.provider === "gpt4all") {
        // GPT4ALLはプロクシ経由で接続（CORS対応）
        endpoint = "/api/gpt4all/v1/chat/completions";
      } else {
        // OpenAI、LM Studioは直接接続
        endpoint = `${config.endpoint}/v1/chat/completions`;
      }

      // APIに送信するメッセージ（role と content のみ）
      const apiMessages = [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userInput },
      ];

      // プロバイダーに応じてリクエストボディを構築
      const shouldUseReasoning = isReasoningModel(config.model);
      let requestBody: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        stream?: boolean;
        think?: string;
        reasoning_effort?: string;
      };

      if (config.provider === "ollama") {
        // Ollamaは"think"パラメータを使用
        requestBody = {
          model: config.model || "llama2",
          messages: apiMessages,
          stream: false,
          ...(shouldUseReasoning && config.reasoningEffort
            ? { think: config.reasoningEffort }
            : {}),
        };
      } else if (config.provider === "gpt4all") {
        // GPT4ALLはreasoningパラメータをサポートしていない
        requestBody = {
          model: config.model || "gpt-3.5-turbo",
          messages: apiMessages,
        };
      } else {
        // OpenAI / LM Studio は"reasoning_effort"パラメータを使用
        requestBody = {
          model: config.model || "gpt-3.5-turbo",
          messages: apiMessages,
          ...(shouldUseReasoning && config.reasoningEffort
            ? { reasoning_effort: config.reasoningEffort }
            : {}),
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
        body: JSON.stringify(requestBody),
      });

      const endTime = Date.now();
      const elapsedSeconds = (endTime - startTime) / 1000;

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();

      // プロバイダーに応じてレスポンスを解析
      const aiMsg =
        config.provider === "ollama"
          ? data.message?.content || "(no response)"
          : data.choices?.[0]?.message?.content || "(no response)";

      // トークン数を取得（プロバイダーによって異なる）
      let totalTokens: number | undefined;
      if (config.provider === "ollama") {
        // Ollamaの場合、eval_countがレスポンストークン数
        totalTokens = data.eval_count;
      } else {
        // OpenAI互換の場合、usageからtotal_tokensを取得
        totalTokens = data.usage?.total_tokens;
      }

      // token/sを計算
      const tokensPerSecond =
        totalTokens && elapsedSeconds > 0
          ? totalTokens / elapsedSeconds
          : undefined;

      const usedModel =
        config.model ||
        (config.provider === "ollama" ? "llama2" : "gpt-3.5-turbo");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: aiMsg,
          model: usedModel,
          provider: config.provider,
          reasoningEffort:
            shouldUseReasoning && config.reasoningEffort
              ? config.reasoningEffort
              : undefined,
          tokensPerSecond,
          timestamp: endTime,
        },
      ]);
    } catch (e) {
      const usedModel =
        config.model ||
        (config.provider === "ollama" ? "llama2" : "gpt-3.5-turbo");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("error") + String(e),
          model: usedModel,
          provider: config.provider,
          timestamp: Date.now(),
        },
      ]);
    }
    setLoading(false);
  }

  const minimapTarget = document.getElementById("minimap-portal");

  return (
    <div className="flex flex-1 relative overflow-hidden">
      {/* サイドバー */}
      <ChatSidebar
        sessions={chatSessions}
        currentSessionId={currentSessionId}
        onLoadSession={loadSession}
        onNewChat={createNewChat}
        onDeleteSession={deleteSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* メインチャットエリア */}
      <div className="flex flex-col flex-1 relative">
        <div className="border-b border-slate-100 px-4 py-3 flex items-center gap-3 dark:border-slate-700">
          {/* ハンバーガーメニュー（モバイル） */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ☰
          </button>
          <p className="text-sm text-slate-500 dark:text-slate-400 flex-1 text-center lg:text-left">
            {t("hint")}
          </p>
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0"
        >
          {messages.length === 0 && !loading && (
            <div className="flex items-center justify-center pt-16">
              <p className="text-slate-400 text-sm">{t("empty")}</p>
            </div>
          )}
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const isCopied = copiedMessageIndex === i;
            // プロバイダー名の表示用マッピング
            const providerNames: Record<string, string> = {
              openai: "OpenAI",
              lmstudio: "LM Studio",
              gpt4all: "GPT4ALL",
              ollama: "Ollama",
              llamacpp: "llama.cpp",
            };
            const msgProviderName =
              (m.provider ? providerNames[m.provider] : null) ??
              providerNames[config.provider] ??
              config.provider;

            return (
              <div
                key={i}
                ref={(el) => {
                  messageRefs.current[i] = el;
                }}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`group relative max-w-[80%] px-4 py-2.5 rounded-2xl shadow-sm ${
                    isUser
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-sm dark:bg-slate-700 dark:text-slate-100"
                  }`}
                >
                  {/* コピーボタン */}
                  <button
                    onClick={() => copyToClipboard(m.content, i)}
                    className={`absolute -top-2 -right-2 w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-md transition-all duration-200 ${
                      isUser
                        ? "bg-blue-500 hover:bg-blue-600 text-white"
                        : "bg-white hover:bg-slate-50 text-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-slate-200"
                    } opacity-0 group-hover:opacity-100 active:scale-95`}
                    title={isCopied ? "Copied!" : "Copy message"}
                  >
                    {isCopied ? "✓" : "📋"}
                  </button>

                  <div
                    className={`text-xs font-semibold mb-0.5 ${isUser ? "text-blue-200" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    {isUser
                      ? t("you")
                      : `${t("ai")}${m.model ? ` (${msgProviderName}: ${m.model}${m.reasoningEffort ? `/${m.reasoningEffort}` : ""})` : ""}`}
                  </div>
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    <span
                      dangerouslySetInnerHTML={{
                        __html: marked.parse(m.content) as string,
                      }}
                    />
                  </div>
                  {!isUser && (m.tokensPerSecond || m.timestamp) && (
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-2 pt-2 border-t border-slate-200 dark:border-slate-600 flex gap-3">
                      {m.tokensPerSecond && (
                        <span>{m.tokensPerSecond.toFixed(1)} token/s</span>
                      )}
                      {m.timestamp && (
                        <span>{new Date(m.timestamp).toLocaleString()}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm inline-flex gap-1 dark:bg-slate-700">
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {!atBottom && (
          <button
            onClick={() =>
              scrollRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            title={t("scrollToLatest")}
            className="absolute bottom-40 right-40 z-10 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center shadow-lg transition"
          >
            ↓
          </button>
        )}

        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-5 py-1.5 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition dark:bg-slate-700 dark:border-slate-600 dark:focus-within:ring-blue-900">
            <input
              type="text"
              className="flex-1 min-w-0 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm py-1.5 dark:text-slate-100 dark:placeholder-slate-500"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              placeholder={t("placeholder")}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input}
              className="shrink-0 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ⇧
            </button>
          </div>
        </div>

        {messages.length > 0 &&
          minimapTarget &&
          createPortal(
            <Minimap
              messages={messages}
              scrollContainerRef={scrollContainerRef}
              messageRefs={messageRefs}
            />,
            minimapTarget,
          )}
      </div>
    </div>
  );
}
