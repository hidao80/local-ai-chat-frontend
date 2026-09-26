import type { ApiConfig } from "./apiConfig";

export type StoredConfig = ApiConfig & {
  systemPrompts?: Record<string, string>;
  lang?: string;
  dark?: boolean;
};

const DB_NAME = "ai-chat-config";
const STORE_NAME = "config";
const CONFIG_KEY = "main";

/** Open (and lazily create) the `ai-chat-config` IndexedDB database. */
function openConfigDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Error for an aborted transaction; `tx.error` is null when aborted explicitly. */
function abortError(tx: IDBTransaction): Error {
  return tx.error ?? new Error("IndexedDB transaction aborted");
}

/** Persist the app config (API settings, system prompts, language, theme) to IndexedDB. */
export async function saveConfigToDB(config: StoredConfig): Promise<void> {
  const db = await openConfigDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(config, CONFIG_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      // リクエスト失敗時もトランザクションは abort されるため onabort で一括処理
      tx.onabort = () => {
        db.close();
        reject(abortError(tx));
      };
    } catch (e) {
      // transaction()/put() は同期的に例外を投げうる（ストア欠落、DataCloneError など）
      db.close();
      reject(e);
    }
  });
}

/** Load the persisted app config from IndexedDB, or null if nothing is stored. */
export async function loadConfigFromDB(): Promise<StoredConfig | null> {
  const db = await openConfigDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const getReq = tx.objectStore(STORE_NAME).get(CONFIG_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve((getReq.result as StoredConfig | undefined) ?? null);
      };
      tx.onabort = () => {
        db.close();
        reject(abortError(tx));
      };
    } catch (e) {
      db.close();
      reject(e);
    }
  });
}
