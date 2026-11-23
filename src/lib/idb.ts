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
 * Create `name` in an upgrade callback unless it already exists, so the same
 * upgrade also works when a later version bump reopens an existing database.
 */
export function ensureObjectStore(
  db: IDBDatabase,
  name: string,
  options?: IDBObjectStoreParameters,
) {
  if (!db.objectStoreNames.contains(name)) {
    db.createObjectStore(name, options);
  }
}

/** How long a request (open + transaction) may take before it is given up. */
const REQUEST_TIMEOUT_MS = 5_000;

/** The last queued request per database (keyed by its `open` function). */
const queues = new WeakMap<() => Promise<IDBDatabase>, Promise<unknown>>();

/**
 * Run one request against an object store in its own transaction.
 * Resolves with the request result once the transaction commits; rejects on
 * open failure, synchronous exceptions, or abort. The DB is always closed.
 *
 * Requests to the same database run one at a time in call order, so they
 * complete in that order: each opens its own connection, and without the
 * queue an older write could land after a newer write or delete of the same
 * key (Quint models, `SERIALIZED_DB`). A failed request does not stop the queue.
 *
 * A request that does not finish within `timeoutMs` (e.g. the open is blocked
 * by another tab) is given up without effect: its transaction is aborted, and
 * it rejects with a `TimeoutError` DOMException so the queue moves on (Quint
 * models, `TIMEOUTS`).
 */
export function runInStore<T>(
  open: () => Promise<IDBDatabase>,
  storeName: string,
  mode: IDBTransactionMode,
  operate: (store: IDBObjectStore) => IDBRequest<T>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const run = () => runInStoreNow(open, storeName, mode, operate, timeoutMs);
  const previous = queues.get(open) ?? Promise.resolve();
  const result = previous.then(run, run);
  queues.set(open, result);
  return result;
}

const timeoutError = () =>
  new DOMException("IndexedDB request timed out", "TimeoutError");

function runInStoreNow<T>(
  open: () => Promise<IDBDatabase>,
  storeName: string,
  mode: IDBTransactionMode,
  operate: (store: IDBObjectStore) => IDBRequest<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    let tx: IDBTransaction | undefined;
    const timer = setTimeout(() => {
      if (!tx) {
        // Still opening: give up now, and close the connection if it opens later
        timedOut = true;
        reject(timeoutError());
        return;
      }
      try {
        tx.abort();
        timedOut = true;
      } catch {
        // Already finished: oncomplete/onabort settles the promise
      }
    }, timeoutMs);
    open().then(
      (db) => {
        if (timedOut) {
          db.close();
          return;
        }
        try {
          tx = db.transaction(storeName, mode);
          const req = operate(tx.objectStore(storeName));
          tx.oncomplete = () => {
            clearTimeout(timer);
            db.close();
            resolve(req.result);
          };
          // A failed request also aborts the transaction, so onabort handles every failure
          tx.onabort = () => {
            clearTimeout(timer);
            db.close();
            if (timedOut) {
              reject(timeoutError());
              return;
            }
            // tx.error is null after an explicit abort()
            reject(tx?.error ?? new Error("IndexedDB transaction aborted"));
          };
        } catch (e) {
          // transaction()/put() etc. can throw synchronously (missing store, DataCloneError, ...)
          clearTimeout(timer);
          db.close();
          reject(e);
        }
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
