/** Open an IndexedDB database, running `upgrade` when it is created or upgraded. */
export function openDatabase(
  name: string,
  version: number,
  upgrade: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(name, version);
    req.onupgradeneeded = () => upgrade(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Run one request against an object store in its own transaction.
 * Resolves with the request result once the transaction commits; rejects on
 * open failure, synchronous exceptions, or abort. The DB is always closed.
 */
export async function runInStore<T>(
  open: () => Promise<IDBDatabase>,
  storeName: string,
  mode: IDBTransactionMode,
  operate: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, mode);
      const req = operate(tx.objectStore(storeName));
      tx.oncomplete = () => {
        db.close();
        resolve(req.result);
      };
      // リクエスト失敗時もトランザクションは abort されるため onabort で一括処理
      tx.onabort = () => {
        db.close();
        // 明示的な abort() では tx.error が null になる
        reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      };
    } catch (e) {
      // transaction()/put() などは同期的に例外を投げうる（ストア欠落、DataCloneError など）
      db.close();
      reject(e);
    }
  });
}
