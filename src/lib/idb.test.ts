import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureObjectStore, openDatabase, runInStore } from "./idb";

const DB_NAME = "idb-test";
const STORE_NAME = "items";

function openTestDB(): Promise<IDBDatabase> {
  return openDatabase(DB_NAME, 1, (db) => {
    db.createObjectStore(STORE_NAME);
  });
}

describe("idb", () => {
  beforeEach(() => {
    // Isolate the DB between tests
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("openDatabase", () => {
    it("runs upgrade only when the database is created", async () => {
      const upgrade = vi.fn((db: IDBDatabase) => {
        db.createObjectStore(STORE_NAME);
      });
      (await openDatabase(DB_NAME, 1, upgrade)).close();
      (await openDatabase(DB_NAME, 1, upgrade)).close();
      expect(upgrade).toHaveBeenCalledTimes(1);
    });

    it("rejects with VersionError when opening an older version", async () => {
      (await openDatabase(DB_NAME, 2, () => {})).close();
      await expect(openDatabase(DB_NAME, 1, () => {})).rejects.toMatchObject({
        name: "VersionError",
      });
    });
  });

  describe("ensureObjectStore", () => {
    it("creates the store once and tolerates later upgrades", async () => {
      const upgrade = (db: IDBDatabase) =>
        ensureObjectStore(db, STORE_NAME, { keyPath: "id" });
      (await openDatabase(DB_NAME, 1, upgrade)).close();
      // A later version bump runs the same upgrade against an existing store
      const db = await openDatabase(DB_NAME, 2, upgrade);
      expect([...db.objectStoreNames]).toEqual([STORE_NAME]);
      db.close();
    });

    it("fails without the check when the store already exists", async () => {
      const upgrade = (db: IDBDatabase) => {
        db.createObjectStore(STORE_NAME);
      };
      (await openDatabase(DB_NAME, 1, upgrade)).close();
      await expect(openDatabase(DB_NAME, 2, upgrade)).rejects.toBeDefined();
    });
  });

  describe("runInStore", () => {
    it("resolves with the request result after commit", async () => {
      await runInStore(openTestDB, STORE_NAME, "readwrite", (store) =>
        store.put("value", "key"),
      );
      const value = await runInStore(
        openTestDB,
        STORE_NAME,
        "readonly",
        (store) => store.get("key"),
      );
      expect(value).toBe("value");
    });

    it("propagates open failures without touching the store", async () => {
      const operate = vi.fn();
      const failure = new Error("open failed");
      await expect(
        runInStore(
          () => Promise.reject(failure),
          STORE_NAME,
          "readonly",
          operate,
        ),
      ).rejects.toBe(failure);
      expect(operate).not.toHaveBeenCalled();
    });

    it("rejects and closes the DB on a synchronous exception", async () => {
      const close = vi.spyOn(IDBDatabase.prototype, "close");
      await expect(
        runInStore(openTestDB, "missing-store", "readonly", (store) =>
          store.get("key"),
        ),
      ).rejects.toMatchObject({ name: "NotFoundError" });
      expect(close).toHaveBeenCalledTimes(1);
    });

    it("rejects with the request error when a request fails", async () => {
      await runInStore(openTestDB, STORE_NAME, "readwrite", (store) =>
        store.add("first", "key"),
      );
      const close = vi.spyOn(IDBDatabase.prototype, "close");
      await expect(
        runInStore(openTestDB, STORE_NAME, "readwrite", (store) =>
          store.add("duplicate", "key"),
        ),
      ).rejects.toMatchObject({ name: "ConstraintError" });
      expect(close).toHaveBeenCalledTimes(1);
    });

    it("rejects with a fallback error on an explicit abort", async () => {
      vi.spyOn(IDBObjectStore.prototype, "get").mockImplementation(function (
        this: IDBObjectStore,
      ) {
        this.transaction.abort();
        return {} as IDBRequest;
      });
      await expect(
        runInStore(openTestDB, STORE_NAME, "readonly", (store) =>
          store.get("key"),
        ),
      ).rejects.toThrow("IndexedDB transaction aborted");
    });
  });
});
