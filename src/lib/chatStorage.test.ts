import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type ChatSession,
  deleteChatSession,
  loadAllChatSessions,
  loadChatSession,
  saveChatSession,
} from "./chatStorage";

function makeSession(id: string, updatedAt: number): ChatSession {
  return {
    id,
    title: `title-${id}`,
    messages: [{ role: "user", content: `hello ${id}`, timestamp: updatedAt }],
    createdAt: 0,
    updatedAt,
  };
}

describe("chatStorage", () => {
  beforeEach(() => {
    // Isolate the DB between tests
    globalThis.indexedDB = new IDBFactory();
  });

  it("saves and loads a session", async () => {
    const session = makeSession("a", 100);
    await saveChatSession(session);
    expect(await loadChatSession("a")).toEqual(session);
  });

  it("returns null for a missing session", async () => {
    expect(await loadChatSession("missing")).toBeNull();
  });

  it("overwrites a session with the same id", async () => {
    await saveChatSession(makeSession("a", 100));
    const updated = { ...makeSession("a", 200), title: "updated" };
    await saveChatSession(updated);
    expect(await loadChatSession("a")).toEqual(updated);
    expect(await loadAllChatSessions()).toHaveLength(1);
  });

  it("keeps the original createdAt when a session is saved again", async () => {
    await saveChatSession({ ...makeSession("a", 100), createdAt: 1000 });
    await saveChatSession({ ...makeSession("a", 200), createdAt: 5000 });

    const saved = await loadChatSession("a");
    expect(saved?.createdAt).toBe(1000);
    expect(saved?.updatedAt).toBe(200);
  });

  it("uses the given createdAt for a new session", async () => {
    await saveChatSession({ ...makeSession("new", 100), createdAt: 1234 });
    expect((await loadChatSession("new"))?.createdAt).toBe(1234);
  });

  it("returns an empty list when no sessions exist", async () => {
    expect(await loadAllChatSessions()).toEqual([]);
  });

  it("loads all sessions sorted by updatedAt descending", async () => {
    await saveChatSession(makeSession("old", 100));
    await saveChatSession(makeSession("newest", 300));
    await saveChatSession(makeSession("middle", 200));
    const ids = (await loadAllChatSessions()).map((s) => s.id);
    expect(ids).toEqual(["newest", "middle", "old"]);
  });

  it("deletes a session", async () => {
    await saveChatSession(makeSession("a", 100));
    await saveChatSession(makeSession("b", 200));
    await deleteChatSession("a");
    expect(await loadChatSession("a")).toBeNull();
    expect((await loadAllChatSessions()).map((s) => s.id)).toEqual(["b"]);
  });

  describe("error handling", () => {
    it("rejects every operation when the database cannot be opened", async () => {
      // Opening with a lower version than the existing DB fails with VersionError
      await new Promise<void>((resolve) => {
        const req = indexedDB.open("chat-history", 2);
        req.onsuccess = () => {
          req.result.close();
          resolve();
        };
      });
      const versionError = { name: "VersionError" };
      await expect(saveChatSession(makeSession("a", 1))).rejects.toMatchObject(
        versionError,
      );
      await expect(loadChatSession("a")).rejects.toMatchObject(versionError);
      await expect(loadAllChatSessions()).rejects.toMatchObject(versionError);
      await expect(deleteChatSession("a")).rejects.toMatchObject(versionError);
    });

    it("rejects a session without an id", async () => {
      const invalid = { ...makeSession("a", 1), id: undefined };
      await expect(
        saveChatSession(invalid as unknown as ChatSession),
      ).rejects.toMatchObject({ name: "DataError" });
      expect(await loadAllChatSessions()).toEqual([]);
    });
  });
});
