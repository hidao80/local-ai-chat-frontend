import type { ApiConfig } from "./apiConfig";
import { openDatabase, runInStore } from "./idb";

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
  return openDatabase(DB_NAME, 1, (db) => {
    db.createObjectStore(STORE_NAME);
  });
}

/** Persist the app config (API settings, system prompts, language, theme) to IndexedDB. */
export async function saveConfigToDB(config: StoredConfig): Promise<void> {
  await runInStore(openConfigDB, STORE_NAME, "readwrite", (store) =>
    store.put(config, CONFIG_KEY),
  );
}

/** Load the persisted app config from IndexedDB, or null if nothing is stored. */
export async function loadConfigFromDB(): Promise<StoredConfig | null> {
  const result = await runInStore<StoredConfig | undefined>(
    openConfigDB,
    STORE_NAME,
    "readonly",
    (store) => store.get(CONFIG_KEY),
  );
  return result ?? null;
}
