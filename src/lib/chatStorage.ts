import type { ApiConfig } from "../components/ChatAndSettings";

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

/** Persist (create or update) a chat session in IndexedDB. */
export async function saveChatSession(session: ChatSession): Promise<void> {
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

/** Load a single chat session by id, or null if it doesn't exist. */
export async function loadChatSession(id: string): Promise<ChatSession | null> {
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

/** Load all chat sessions, sorted most-recently-updated first. */
export async function loadAllChatSessions(): Promise<ChatSession[]> {
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

/** Delete a chat session from IndexedDB by id. */
export async function deleteChatSession(id: string): Promise<void> {
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
