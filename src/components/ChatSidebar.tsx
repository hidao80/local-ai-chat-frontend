import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatSession } from "../lib/chatStorage";
import { ConfirmModal } from "./ConfirmModal";

/** Sidebar listing saved chat sessions, with new-chat and delete-with-confirmation actions. */
export function ChatSidebar({
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
      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title={t("deleteConfirmTitle")}
        message={t("deleteConfirmMessage")}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Overlay for mobile */}
      {isOpen && (
        <button
          type="button"
          aria-label={t("chatHistory")}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden border-0 p-0 cursor-default"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static top-0 left-0 h-full w-64 bg-slate-50 border-r border-slate-200 dark:bg-slate-900 dark:border-slate-700 flex flex-col z-50 transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">
            {t("chatHistory")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {/* New chat button */}
        <div className="p-4">
          <button
            type="button"
            onClick={onNewChat}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition"
          >
            + {t("newChat")}
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-2">
          {sessions.map((session) => (
            // biome-ignore lint/a11y/useSemanticElements: cannot use <button> here — it already contains a nested delete <button>, and buttons cannot be nested per HTML spec.
            <div
              key={session.id}
              className={`group relative mb-2 rounded-xl p-3 cursor-pointer transition ${
                session.id === currentSessionId
                  ? "bg-blue-100 dark:bg-blue-900/30"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              role="button"
              tabIndex={0}
              onClick={() => onLoadSession(session.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  onLoadSession(session.id);
              }}
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
                  type="button"
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
              {t("noHistory")}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
