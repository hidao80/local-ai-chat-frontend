import { expect, type Page, type Request, type Route } from "@playwright/test";

/** Default LM Studio endpoint the app selects for the "lmstudio" provider. */
export const LM_STUDIO = "http://localhost:1234";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type NativeModel = {
  key: string;
  allowed_options?: string[];
  default?: string;
};

export type LmStudioMock = {
  /** Chat completion request bodies, in order. */
  chatBodies: Record<string, unknown>[];
  /** All requests that reached the mock server. */
  requests: Request[];
};

/**
 * Mock an LM Studio server at {@link LM_STUDIO} so tests never hit a real one.
 * - `GET /v1/models`: ids of `models`
 * - `GET /api/v1/models`: native capabilities (or 404 when `native` is false, like LM Studio < 0.4)
 * - `POST /v1/chat/completions`: returns `reply`, as SSE when `stream` is set
 *   (like LM Studio when the request asks for streaming). Replies wait for
 *   `hold` to resolve, so tests can act while a reply is pending; `holds[i]`
 *   (when given) holds only the i-th chat request instead. With `status`, it
 *   fails with that HTTP status and `reply` as the body instead.
 */
export async function mockLmStudio(
  page: Page,
  {
    models,
    native = true,
    reply = "ok",
    stream = false,
    hold,
    holds = [],
    status,
  }: {
    models: NativeModel[];
    native?: boolean;
    reply?: string;
    stream?: boolean;
    hold?: Promise<void>;
    holds?: Promise<void>[];
    status?: number;
  },
): Promise<LmStudioMock> {
  const mock: LmStudioMock = { chatBodies: [], requests: [] };
  await page.route(`${LM_STUDIO}/**`, async (route: Route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    mock.requests.push(request);
    const path = new URL(request.url()).pathname;
    if (path === "/v1/models") {
      return route.fulfill({
        headers: CORS_HEADERS,
        json: { data: models.map((m) => ({ id: m.key })) },
      });
    }
    if (path === "/api/v1/models") {
      if (!native) {
        return route.fulfill({ status: 404, headers: CORS_HEADERS, body: "" });
      }
      return route.fulfill({
        headers: CORS_HEADERS,
        json: {
          models: models.map((m) => ({
            type: "llm",
            key: m.key,
            capabilities: m.allowed_options
              ? {
                  reasoning: {
                    allowed_options: m.allowed_options,
                    default: m.default ?? m.allowed_options[0],
                  },
                }
              : {},
          })),
        },
      });
    }
    if (path === "/v1/chat/completions") {
      const index = mock.chatBodies.push(request.postDataJSON()) - 1;
      await (holds[index] ?? hold);
      if (status !== undefined) {
        return route.fulfill({ status, headers: CORS_HEADERS, body: reply });
      }
      if (stream) {
        return route.fulfill({
          headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" },
          body: toSse(reply),
        });
      }
      return route.fulfill({
        headers: CORS_HEADERS,
        json: {
          choices: [{ message: { content: reply } }],
          usage: { total_tokens: 10 },
        },
      });
    }
    return route.fulfill({ status: 404, headers: CORS_HEADERS, body: "" });
  });
  return mock;
}

/** Encode `reply` as an OpenAI-compatible SSE stream split into two deltas, with usage. */
function toSse(reply: string): string {
  const half = Math.ceil(reply.length / 2);
  const events = [
    { choices: [{ delta: { role: "assistant" } }] },
    { choices: [{ delta: { content: reply.slice(0, half) } }] },
    { choices: [{ delta: { content: reply.slice(half) } }] },
    {
      choices: [],
      usage: { prompt_tokens: 40, completion_tokens: 12, total_tokens: 52 },
    },
  ];
  const lines = [...events.map((e) => JSON.stringify(e)), "[DONE]"];
  return lines.map((data) => `data: ${data}\n\n`).join("");
}

/** Open the app and switch the provider to LM Studio (default endpoint {@link LM_STUDIO}). */
export async function openLmStudioSettings(page: Page) {
  await page.goto("/");
  await page.locator("#provider").selectOption("lmstudio");
  await expect(page.locator("#model option").first()).toBeAttached();
}

/** Model option labels as shown in the selector. */
export function modelOptionLabels(page: Page) {
  return page.locator("#model option").allInnerTexts();
}

/** Go to the chat view, send `text` and wait for the assistant reply to render. */
export async function sendChatMessage(page: Page, text: string) {
  const toChat = page.getByRole("button", { name: "To Chat →" });
  if (await toChat.isVisible()) await toChat.click();
  const response = page.waitForResponse(`${LM_STUDIO}/v1/chat/completions`);
  await page.getByPlaceholder("Type a message...").fill(text);
  await page.getByPlaceholder("Type a message...").press("Enter");
  await response;
}

/** Return to the settings view from the chat view. */
export async function backToSettings(page: Page) {
  await page
    .getByRole("button", { name: /Settings/ })
    .first()
    .click();
  await expect(page.locator("#provider")).toBeVisible();
}

/** Create an IndexedDB database at a newer version so the app's version-1 open fails with VersionError. */
async function createNewerDatabase(page: Page, name: string) {
  await page.evaluate(
    (dbName) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName, 2);
        req.onsuccess = () => {
          req.result.close();
          resolve();
        };
        req.onerror = () => reject(req.error);
      }),
    name,
  );
}

/**
 * Open the app with the `name` IndexedDB database left at a newer version, so the
 * app's storage access fails. Returns the locator for the error toasts.
 */
export async function openWithUnreadableDatabase(
  page: Page,
  name: "ai-chat-config" | "chat-history",
) {
  await page.goto("/");
  await createNewerDatabase(page, name);
  await page.reload();
  return page.locator("[data-sonner-toast]");
}

/** A promise plus the function that resolves it, for holding a mocked response. */
export function deferred() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/** The history entry whose title matches `title` (not the minimap's message buttons). */
export function sessionItem(page: Page, title: RegExp) {
  return page.locator('div[role="button"]', { hasText: title });
}

/** Delete the history entry matching `title` through its confirmation dialog. */
export async function deleteSession(page: Page, title: RegExp) {
  await sessionItem(page, title).getByRole("button", { name: "🗑" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
}

type IdbGateMode = "readonly" | "readwrite";
type IdbGateApi = {
  arm: (db: string, mode: IdbGateMode) => number;
  hit: (id: number) => boolean;
  release: (id: number) => void;
  hang: (db: string | null) => void;
};
type GateWindow = { __idbGate: IdbGateApi };

/** localStorage key (test-only) holding gates to arm when the next page load starts. */
const IDB_GATE_ON_LOAD = "__e2eIdbGateOnLoad";
/** localStorage key (test-only) naming a database whose opens hang on the next page load. */
const IDB_HANG_ON_LOAD = "__e2eIdbHangOnLoad";

/**
 * Let tests delay IndexedDB completions. An armed gate catches every
 * transaction of `mode` on database `db` until it is released: the requests run
 * at once (so they read or write the store as usual), but each transaction's
 * `complete` handler —
 * where `runInStore` resolves — only runs after {@link releaseIdbGate}. This
 * opens the window between an IndexedDB operation and the app reacting to it.
 * It can also make the opens of a database hang (see {@link hangIdbOpens}).
 * Call before the first `page.goto`.
 */
export async function installIdbGate(page: Page) {
  await page.addInitScript(
    ([onLoadKey, hangKey]) => {
      type Gate = {
        db: string;
        mode: string;
        hit: boolean;
        released: boolean;
        waiters: (() => void)[];
      };
      const gates: Gate[] = [];
      const arm = (db: string, mode: string) =>
        gates.push({ db, mode, hit: false, released: false, waiters: [] }) - 1;
      const onLoad = localStorage.getItem(onLoadKey);
      localStorage.removeItem(onLoadKey);
      for (const { db, mode } of JSON.parse(onLoad ?? "[]")) arm(db, mode);
      let hung = localStorage.getItem(hangKey);
      localStorage.removeItem(hangKey);

      (window as unknown as GateWindow).__idbGate = {
        arm,
        hit: (id) => gates[id].hit,
        release: (id) => {
          const gate = gates[id];
          gate.released = true;
          for (const run of gate.waiters.splice(0)) run();
        },
        hang: (db) => {
          hung = db;
        },
      };

      const open = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (
        this: IDBFactory,
        ...args: Parameters<IDBFactory["open"]>
      ) {
        // A request whose events never fire, as when another tab blocks the open
        if (args[0] === hung) return {} as IDBOpenDBRequest;
        return open.apply(this, args);
      };

      const transaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (
        this: IDBDatabase,
        ...args: Parameters<IDBDatabase["transaction"]>
      ) {
        const tx = transaction.apply(this, args);
        const mode = args[1] ?? "readonly";
        // Every matching transaction until release (React StrictMode runs effects twice in dev)
        const gate = gates.find(
          (g) => !g.released && g.db === this.name && g.mode === mode,
        );
        if (!gate) return tx;
        gate.hit = true;
        // Keep the app's oncomplete handler away from the real event and call it after release
        let onComplete: ((ev: Event) => void) | null = null;
        Object.defineProperty(tx, "oncomplete", {
          configurable: true,
          get: () => onComplete,
          set: (handler) => {
            onComplete = handler;
          },
        });
        tx.addEventListener("complete", (ev) => {
          const run = () => onComplete?.call(tx, ev);
          if (gate.released) run();
          else gate.waiters.push(run);
        });
        return tx;
      };
    },
    [IDB_GATE_ON_LOAD, IDB_HANG_ON_LOAD] as const,
  );
}

/** Arm a gate for the `mode` transactions on `db` (see {@link installIdbGate}); returns its id. */
export function armIdbGate(page: Page, db: string, mode: IdbGateMode) {
  return page.evaluate(
    ([d, m]) => (window as unknown as GateWindow).__idbGate.arm(d, m),
    [db, mode] as const,
  );
}

/**
 * Arm a gate that is already active when the next page load starts, for the
 * IndexedDB access the app makes on startup. Its id on that page is 0.
 */
export async function armIdbGateOnNextLoad(
  page: Page,
  db: string,
  mode: IdbGateMode,
) {
  await page.evaluate(
    ([key, d, m]) =>
      localStorage.setItem(key, JSON.stringify([{ db: d, mode: m }])),
    [IDB_GATE_ON_LOAD, db, mode] as const,
  );
}

/** Wait until the gate has caught its transaction. */
export async function waitForIdbGate(page: Page, id: number) {
  await expect
    .poll(() =>
      page.evaluate(
        (i) => (window as unknown as GateWindow).__idbGate.hit(i),
        id,
      ),
    )
    .toBe(true);
}

/** Let the gated transaction's completion reach the app. */
export async function releaseIdbGate(page: Page, id: number) {
  await page.evaluate(
    (i) => (window as unknown as GateWindow).__idbGate.release(i),
    id,
  );
}

/**
 * Make every open of database `db` hang from now on (`null`: open normally
 * again), so `runInStore` gives up after its timeout. Needs `installIdbGate`.
 */
export async function hangIdbOpens(page: Page, db: string | null) {
  await page.evaluate(
    (d) => (window as unknown as GateWindow).__idbGate.hang(d),
    db,
  );
}

/**
 * Reload with every open of database `db` hanging on that page load; later
 * page loads open it normally. Needs `installIdbGate`.
 */
export async function reloadWithIdbOpenHung(page: Page, db: string) {
  await page.evaluate(([key, d]) => localStorage.setItem(key, d), [
    IDB_HANG_ON_LOAD,
    db,
  ] as const);
  await page.reload();
}

/** Titles of the sessions stored in the `chat-history` IndexedDB database. */
export function storedSessionTitles(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open("chat-history");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db
            .transaction("sessions", "readonly")
            .objectStore("sessions")
            .getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            db.close();
            resolve(all.result.map((s: { title: string }) => s.title));
          };
        };
      }),
  );
}

/** The config record stored in the `ai-chat-config` IndexedDB database, or undefined. */
export function storedConfig(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const open = indexedDB.open("ai-chat-config");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db
            .transaction("config", "readonly")
            .objectStore("config")
            .get("main");
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
        };
      }),
  );
}
