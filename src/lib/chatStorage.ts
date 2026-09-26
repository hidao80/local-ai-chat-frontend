import type { ApiConfig } from "./apiConfig";
import { openDatabase, runInStore } from "./idb";

export type Message = {
  role: string;
  content: string;
  model?: string;
  provider?: ApiConfig["provider"];
  reasoningEffort?: string;
  tokensPerSecond?: number;
  timestamp?: number;
};

export type ChatSession = {
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

/** Open (and lazily create) the `chat-history` IndexedDB database. */
function openChatDB(): Promise<IDBDatabase> {
  return openDatabase(CHAT_DB_NAME, CHAT_DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(CHAT_STORE_NAME)) {
      db.createObjectStore(CHAT_STORE_NAME, { keyPath: "id" });
    }
  });
}

/** Persist (create or update) a chat session in IndexedDB. */
export async function saveChatSession(session: ChatSession): Promise<void> {
  await runInStore(openChatDB, CHAT_STORE_NAME, "readwrite", (store) =>
    store.put(session),
  );
}

/** Load a single chat session by id, or null if it doesn't exist. */
export async function loadChatSession(id: string): Promise<ChatSession | null> {
  const session = await runInStore<ChatSession | undefined>(
    openChatDB,
    CHAT_STORE_NAME,
    "readonly",
    (store) => store.get(id),
  );
  return session || null;
}

/** Load all chat sessions, sorted most-recently-updated first. */
export async function loadAllChatSessions(): Promise<ChatSession[]> {
  const sessions = await runInStore<ChatSession[]>(
    openChatDB,
    CHAT_STORE_NAME,
    "readonly",
    (store) => store.getAll(),
  );
  // 更新日時の降順でソート
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Delete a chat session from IndexedDB by id. */
export async function deleteChatSession(id: string): Promise<void> {
  await runInStore(openChatDB, CHAT_STORE_NAME, "readwrite", (store) =>
    store.delete(id),
  );
}
