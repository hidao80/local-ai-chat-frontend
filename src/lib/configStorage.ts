import type { ApiConfig } from "../components/ChatAndSettings";

export type StoredConfig = ApiConfig & {
  systemPrompts?: Record<string, string>;
  lang?: string;
  dark?: boolean;
};

const DB_NAME = "ai-chat-config";
const STORE_NAME = "config";

/** Persist the app config (API settings, system prompts, language, theme) to IndexedDB. */
export function saveConfigToDB(config: StoredConfig) {
  const req = window.indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    req.result.createObjectStore(STORE_NAME);
  };
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(config, "main");
    tx.oncomplete = () => db.close();
  };
}

/** Load the persisted app config from IndexedDB and pass it to the callback if present. */
export function loadConfigFromDB(callback: (c: StoredConfig) => void) {
  const req = window.indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    req.result.createObjectStore(STORE_NAME);
  };
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction(STORE_NAME, "readonly");
    const getReq = tx.objectStore(STORE_NAME).get("main");
    getReq.onsuccess = () => {
      if (getReq.result) callback(getReq.result);
      db.close();
    };
  };
}
