import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { ApiConfig } from "../lib/apiConfig";
import {
  buildChatRequest,
  type ChatMessage,
  readChatResponse,
  tokensPerSecond,
} from "../lib/chatApi";
import {
  type ChatSession,
  deleteChatSession,
  loadAllChatSessions,
  loadChatSession,
  type Message,
  saveChatSession,
} from "../lib/chatStorage";
import { renderMarkdown } from "../lib/markdown";
import { notifyStorageError } from "../lib/notifyStorageError";
import { ChatSidebar } from "./ChatSidebar";
import { Minimap } from "./Minimap";

/** Chat view: message list, session sidebar, minimap, and the send/stream loop against the configured LLM endpoint. */
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
  // Session whose reply is being generated; null when idle
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string>(
    () => `session-${Date.now()}`,
  );
  // Read by in-flight requests to know whether their session is still on screen
  const currentSessionIdRef = useRef(currentSessionId);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load chat history
  useEffect(() => {
    loadAllChatSessions()
      .then(setChatSessions)
      .catch((e) => notifyStorageError("chatLoadFailed", e));
  }, []);

  /** Show another session (or a new, empty one) in the chat view. */
  const showSession = (sessionId: string, sessionMessages: Message[]) => {
    currentSessionIdRef.current = sessionId;
    setCurrentSessionId(sessionId);
    setMessages(sessionMessages);
  };

  /**
   * Save a session and update the history list in place, instead of reloading
   * every session from IndexedDB after each save.
   */
  const persistSession = (sessionId: string, sessionMessages: Message[]) => {
    const now = Date.now();
    const session: ChatSession = {
      id: sessionId,
      title:
        sessionMessages.find((m) => m.role === "user")?.content.slice(0, 50) ||
        "New Chat",
      messages: sessionMessages,
      createdAt: now,
      updatedAt: now,
    };
    saveChatSession(session)
      .then(() =>
        setChatSessions((prev) => {
          const existing = prev.find((s) => s.id === sessionId);
          // The saved session is the most recently updated, so it goes first
          return [
            { ...session, createdAt: existing?.createdAt ?? session.createdAt },
            ...prev.filter((s) => s.id !== sessionId),
          ];
        }),
      )
      .catch((e) => notifyStorageError("chatSaveFailed", e));
  };

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
    let session: ChatSession | null;
    try {
      session = await loadChatSession(sessionId);
    } catch (e) {
      notifyStorageError("chatLoadFailed", e);
      return;
    }
    if (session) {
      showSession(session.id, session.messages);
    }
  };

  const createNewChat = () => {
    showSession(`session-${Date.now()}`, []);
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
    } catch (e) {
      notifyStorageError("chatDeleteFailed", e);
      return;
    }
    if (sessionId === currentSessionId) {
      createNewChat();
    }
    setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
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
    if (!input || pendingSessionId) return;
    // The reply belongs to the session it was asked in, even if the user switches away
    const sessionId = currentSessionIdRef.current;
    const conversation: Message[] = [
      ...messages,
      { role: "user", content: input, timestamp: Date.now() },
    ];
    setInput("");
    setPendingSessionId(sessionId);
    setMessages(conversation);
    persistSession(sessionId, conversation);

    // Only touch the screen while this session is the one being viewed
    const show = (sessionMessages: Message[]) => {
      if (currentSessionIdRef.current === sessionId) {
        setMessages(sessionMessages);
      }
    };

    const apiMessages: ChatMessage[] = [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      ...conversation.map((m) => ({ role: m.role, content: m.content })),
    ];
    const request = buildChatRequest(config, apiMessages);
    const replyBase = {
      role: "assistant",
      model: request.model,
      provider: config.provider,
    };

    let reply: Message;
    try {
      const startedAt = performance.now();
      const res = await fetch(request.url, request.init);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      let streamedText = "";
      const result = await readChatResponse(
        res,
        config.provider,
        (delta) => {
          streamedText += delta;
          show([...conversation, { ...replyBase, content: streamedText }]);
        },
        { startedAt },
      );
      reply = {
        ...replyBase,
        content: result.content || "(no response)",
        reasoningEffort: request.reasoningLabel,
        tokensPerSecond: tokensPerSecond(result),
        timestamp: Date.now(),
      };
    } catch (e) {
      reply = {
        ...replyBase,
        content: t("error") + String(e),
        timestamp: Date.now(),
      };
    }

    const finished = [...conversation, reply];
    show(finished);
    persistSession(sessionId, finished);
    setPendingSessionId(null);
  }

  // The typing indicator shows until the first streamed text of this session's reply arrives
  const waitingForReply =
    pendingSessionId === currentSessionId && messages.at(-1)?.role === "user";

  const minimapTarget = document.getElementById("minimap-portal");

  return (
    <div className="flex flex-1 relative overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        sessions={chatSessions}
        currentSessionId={currentSessionId}
        onLoadSession={loadSession}
        onNewChat={createNewChat}
        onDeleteSession={deleteSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 relative">
        <div className="border-b border-slate-100 px-4 py-3 flex items-center gap-3 dark:border-slate-700">
          {/* Hamburger menu (mobile) */}
          <button
            type="button"
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
          {messages.length === 0 && !waitingForReply && (
            <div className="flex items-center justify-center pt-16">
              <p className="text-slate-400 text-sm">{t("empty")}</p>
            </div>
          )}
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const isCopied = copiedMessageIndex === i;
            // Display names for providers
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
                // biome-ignore lint/suspicious/noArrayIndexKey: Message has no unique id; the list is append-only (no reorder/delete), so index is stable here.
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
                  {/* Copy button */}
                  <button
                    type="button"
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
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized via DOMPurify.sanitize() inside renderMarkdown() before rendering.
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(m.content),
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
          {waitingForReply && (
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
            type="button"
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
              disabled={pendingSessionId !== null}
              onKeyDown={(e) => {
                // Enter that confirms an IME conversion (e.g. Japanese input) must not send;
                // Safari reports it only through keyCode 229
                if (
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  sendMessage();
                }
              }}
              placeholder={t("placeholder")}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={pendingSessionId !== null || !input}
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
