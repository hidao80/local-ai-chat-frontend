# Quint models

[Quint](https://quint-lang.org/) models of two parts of the app:

- [Chat session concurrency](#chat-session-concurrency) — `chat.qnt`, `chat_test.qnt`
- [Settings and config persistence](#settings-and-config-persistence) — `settings.qnt`, `settings_test.qnt`

The specs are the ground truth for this behaviour: when the code they ground changes, update the spec first and re-run it; never edit a spec to match broken code.

```sh
bun install               # installs @informalsystems/quint (devDependency)
bun run quint:typecheck   # type-check all files
bun run quint:test        # deterministic scenarios (all must pass)
bun run quint:run         # random simulation: invariants expected to hold + all witnesses
bun run quint:run:unordered  # every invariant with IndexedDB completions in any order (see below)
```

`quint:run:unordered` (`specs/quint/check-unordered.mjs`) checks each invariant of `chat_unordered` and `settings_unordered` (`FIFO_DB = false`) separately, prints `ok` / `VIOLATED` per invariant with the seed of a violating run, and exits 1 if any is violated. Replay a violation with `bunx quint run specs/quint/<spec>.qnt --main=<instance> --max-steps=25 --invariant=<name> --seed=<seed>`. CI runs it too. Every invariant holds because `runInStore` serializes the requests to one database (`SERIALIZED_DB`); without that (`chat_unserialized`, `settings_unserialized`) `noResurrection` and `historyOnlyExtends` (chat) and `optOutHonoured`, `persistedMatchesMemory` and `noKeysStoredAfterOptOut` (settings) are violated, all by an older write to the same key completing after a newer write or delete.

`quint run` / `quint test` use Quint's Rust evaluator, which Quint downloads on first use. CI runs the three scripts in the `quint` job of `.github/workflows/test.yml`.

## Chat session concurrency

A model of how `<Chat>` sends a prompt, streams the reply, switches/loads/deletes sessions, and persists them to IndexedDB — including the case where the user opens Settings while a reply is still being generated (`<Chat>` stays mounted and hidden since the F2 fix; it used to be unmounted).

`chat.qnt` holds the spec (`module chat`) and nine instance modules: `chat_fifo`, `chat_fifo_nomount` and `chat_unordered` model the current code, `chat_noguard` is a mutation, `chat_resurrect` models the code before the F1 fix, `chat_remount` the code before the F2 fix, `chat_stale_load` the code before the F3 fix and `chat_click_time_current` the code before the F4 fix and `chat_unserialized` the code before IndexedDB requests were serialized. `chat_test.qnt` has five test modules: `chat_test` (happy path and the fixed F1–F5 behaviour), `chat_resurrect_test` (F1 before its fix), `chat_remount_test` (F2/F5 before their fix), `chat_stale_load_test` (F3 before its fix) and `chat_click_time_current_test` (F4 before its fix).

Other invariants and instances can be run directly, e.g.:

```sh
bunx quint run specs/quint/chat.qnt --main=chat_fifo_nomount --max-steps 25 --invariant historyOnlyExtends
bunx quint run specs/quint/chat.qnt --main=chat_noguard --max-steps 25 --invariant noCrossTalk   # mutation: must be violated
```

### Source correspondence

| Model | Code |
|---|---|
| `send` | `sendMessage()` up to `await fetch` (`src/components/Chat.tsx`) |
| `delta(r)` | `readChatResponse` onDelta → `show()` |
| `finish(r)` | reply done or failed → `show` + `persistSession` + `setPendingSessionId(null)` |
| `clickLoad` / `Load` completion | `loadSession`: request / `showSession` after the `await` |
| `clickDelete` / `Delete` completion | `deleteSession`; `wasCurrent` is the render-closure value at click time; `ui.deleting` is `deletedSessionIdsRef` |
| `Save` completion | `saveChatSession` (get + put in one transaction) → `setChatSessions` |
| `mount` / `LoadAll` | `<Chat>` initial state + `loadAllChatSessions` |
| `unmount` / `reveal` | `src/App.tsx` shows Settings / the chat again; `<Chat>` stays mounted in a `hidden` wrapper, so its state and in-flight work are kept (`KEEP_MOUNTED`). Without `KEEP_MOUNTED`, `unmount` drops the instance and setState of the old one is a no-op |
| `ui.epoch` | identity of the React instance (models stale closures) |
| IndexedDB ops | `src/lib/chatStorage.ts`, `src/lib/idb.ts` (`runInStore`) |

### Modelling decisions

- **Scope**: chat sending/streaming/session switching/deletion/Settings round trip and IndexedDB persistence. Settings and config storage, Markdown rendering and request building are out of scope.
- **Shape**: one tab, one JS thread; concurrency is only async completions interleaving with user events, so plain Quint (shared state), not Choreo.
- **Granularity**: one action per `await` boundary. `loadSession` and `deleteSession` are split into request and completion (F3/F4 are only visible with this split). The get + put in `saveChatSession` share one transaction, so one action.
- **Abstraction**: message text, titles, timestamps and HTTP error details are dropped (an error reply is a `Reply`). Session ids are a counter; `Msg.id` is a ghost identifying the send.

#### Assumptions (`const`)

| const | Meaning | Note |
|---|---|---|
| `FIFO_DB` | the browser completes IndexedDB requests in issue order | Not guaranteed (`runInStore` opens a new connection per request); `chat_unordered` drops it |
| `SERIALIZED_DB` | `runInStore` queues the requests to one database and starts each after the previous one finished, so they complete in issue order regardless of `FIFO_DB` | `true` = current code; `false` (`chat_unserialized`) = before |
| `TIMEOUTS` | `runInStore` gives up a request that does not finish within 5 s: the transaction is aborted (no effect), the promise rejects with `TimeoutError`, the caller shows an error toast (ghost `storageFailed`) and the queue moves on (`dbTimeout`) | `true` in every instance. Also needs the duplicate-delete guard in `deleteSession`: a second delete of a session already being deleted is ignored, otherwise its failure would un-record the session while the first delete succeeds |
| `ALLOW_REMOUNT` | user may switch to Settings and back | `chat_fifo_nomount` isolates single-mount races |
| `SHOW_GUARD` | session check in `show()` | mutation knob; `false` must break `noCrossTalk` |
| `KEEP_MOUNTED` | `<Chat>` is hidden, not unmounted, while Settings is shown | `true` = current code (F2 fix); `false` (`chat_remount`) = the code before it |
| `CURRENT_AT_COMPLETION` | `deleteSession` decides after the delete whether the deleted session is still shown (`currentSessionIdRef`) | `true` = current code (F4 fix); `false` (`chat_click_time_current`) = the click-time closure value |
| `FRESH_LOAD` | `loadSession` shows the history this view last saved for the session (`latestMessagesRef`) instead of an older IndexedDB snapshot | `true` = current code (F3 fix); `false` (`chat_stale_load`) = the code before it |
| `SKIP_DELETED` | `persistSession` skips a session the user deleted (`deletedSessionIdsRef`, recorded before the delete is issued) | `true` = current code (F1 fix); `false` (`chat_resurrect`, `chat_remount`) = the code before it |
| `MAX_SENDS`, `MAX_SESSIONS` | bounds (3 / 3; `chat_test` uses `MAX_SESSIONS = 4`) | once the session budget is used up the model can stop with no enabled action; this is the bound, not an app deadlock |

### Results (sampled `quint run --max-steps 25 --max-samples 20000`)

| Invariant | `chat_fifo` | `chat_fifo_nomount` | `chat_unordered` | `chat_noguard` (mutation) | `chat_resurrect` (before F1 fix) | `chat_remount` (before F2 fix) | `chat_stale_load` (before F3 fix) | `chat_click_time_current` (before F4 fix) |
|---|---|---|---|---|---|---|---|---|
| `noCrossTalk` — the screen shows only the viewed session | ok | ok | ok | violated (expected) | ok | ok | ok | ok |
| `dbWellFormed` — stored history never mixes sessions or partial replies | ok | ok | ok | violated | ok | ok | ok | ok |
| `singleInFlight` — at most one reply generated at a time | ok | ok | ok | ok | ok | violated | ok | ok |
| `sidebarMatchesDb` — when idle, the sidebar lists exactly the stored sessions | ok | ok | ok | ok | ok | violated | ok | ok |
| `noResurrection` — a deleted session never comes back | ok | ok | ok | ok | violated | violated | ok | ok |
| `historyOnlyExtends` — a save never drops stored messages | ok | ok | ok | violated | ok | violated | violated | ok |
| `deleteKeepsOtherView` — a delete only moves the view away from the deleted session | ok | ok | ok | ok | ok | ok | ok | violated |

`holds` (= every row) is what `bun run quint:run` checks; the "before the fix" instances violate it. The F1 and F3 fixes depend on writes completing in issue order; `runInStore` guarantees that by serializing requests, so they hold in `chat_unordered` too, and only fail in `chat_unserialized`. Results are from random sampling, not exhaustive model checking (`quint verify`). The witnesses `wRemount` and `wTwoInFlight` are only reachable in `chat_remount`, and `wSaveResurrects` only without the F1 fix or without FIFO. The witness `wDeleteLeavesOtherView` is only reachable in `chat_click_time_current`.

### Known findings

| Id | Severity (estimate) | Scenario (`chat_test.qnt`) | Summary |
|---|---|---|---|
| F2 | fixed | `settingsRoundTripKeepsPendingTest` (was `remountOverwritesHistoryTest`) | Opening Settings during generation resets `pendingSessionId` (the fetch is not aborted). Back in the chat the session shows no reply and no typing indicator, so the user resends; the two replies then overwrite each other's history |
| F1 | fixed | `deleteDuringReplyStaysDeletedTest` (was `deleteDuringReplyResurrectsTest`) | Deleting a session while its reply is generated: the final `persistSession` writes it back to IndexedDB and the sidebar (confirmed as a bug: a deleted session must stay deleted) |
| F3 | fixed | `loadAfterReplyShowsLatestTest` (was `loadRaceLosesReplyTest`) | A reply finishing while `loadSession` is in flight: the load shows the stale history, and the next send overwrites the reply |
| F5 | fixed | `settingsRoundTripSidebarMatchesTest` (was `remountStaleSidebarTest`) | After a remount, a session resurrected by F1 is in IndexedDB but missing from the sidebar |
| F4 | fixed | `lateDeleteKeepsNewChatTest` (was `deleteMovesAwayFromNewChatTest`) | `deleteSession` compares against the session shown at click time; a New Chat + send before the delete commits is moved away to another empty session |

F2 was fixed by keeping `<Chat>` mounted (hidden) while Settings is shown, so `pendingSessionId`, the view and the sidebar survive the round trip; this also fixed F5. F4 was fixed by reading `currentSessionIdRef` after the delete instead of the click-time `currentSessionId`. F3 was fixed by remembering the messages this view last saved per session (`latestMessagesRef`) and showing them when a load returns an older snapshot. F1 was fixed by recording a deleted session's id before the delete is issued and skipping `persistSession` for it, so neither the pending reply nor a message sent in the deleting window saves it again (such a message is dropped along with the session). When a fix lands, flip the matching scenario's expectation in `chat_test.qnt` and add the invariant to `holds` so `bun run quint:run` guards it.

### Not covered

- Config and API key storage (see [Settings and config persistence](#settings-and-config-persistence)), Markdown rendering/XSS, request/response parsing.
- Several tabs sharing the same IndexedDB.
- IndexedDB failures (`notifyStorageError` path).
- Message contents, titles and `updatedAt` ordering (the sidebar is compared as a set of ids).
- Liveness properties.

## Browser reproductions and fixing findings

Every finding below is fixed, and each has a regular regression test that fails without its fix:

| Finding | Regression test |
|---|---|
| S1, S7 | `api-key.spec.ts`: "ignores a model list that arrives after the provider changed", "does not send the API key while it is still being typed (S7)" |
| S4, S6, S8 | `security-settings.spec.ts`: "shows the Settings form only once the stored config has loaded (S4)", "removes a stored key as soon as saving is turned off (S6)", "waits for the stored config before anything can save over it (S8)" |
| F1–F5 | `chat-flow.spec.ts`: one test per finding, named with its id |

Races in an IndexedDB window use the `installIdbGate` helpers in `tests/e2e/support/app.ts`, which hold a transaction's completion until the test releases it; helpers shared by these tests are in `tests/e2e/support/findings.ts`.

For a new finding: reproduce it in the browser first as a `test.fail` test (it passes while the bug exists and fails once it is fixed), then fix it spec-first: keep the old behaviour as a counter-check instance (like `settings_no_cancel` for S1), flip the Quint scenario and add its invariant to `holds`, fix the code, and turn the browser test into a regular regression test. Fix one finding per commit, most severe first.

## Settings and config persistence

A model of the Settings form and config persistence: provider selection, endpoint draft + commit (blur/Enter), API key, the per-provider "send API key" switch, "save API keys", the model-list fetch that Settings runs after every config change, `loadConfigFromDB` on start, and `saveConfigToDB` on leaving Settings / toggling language or theme.

`settings.qnt` holds the spec (`module settings`) and ten instance modules: `settings_returning` (a config is already stored) and `settings_first` (nothing stored) model the current code; `settings_no_cancel` models the code before the S1 fix; `settings_no_forget` the code before the S6 fix; `settings_save_before_load` the code before the S8 fix; `settings_edit_before_load` the code before the S4 fix; `settings_key_per_keystroke` the code before the S7 fix; `settings_unordered` lets the browser complete IndexedDB requests in any order and `settings_unserialized` additionally drops the serialization in `runInStore` (`quint:run:unordered`); `settings_leak_mutation` is a deliberately broken native request (see below). `settings_test.qnt` has seven test modules: `settings_test` (happy path, the fixed S1–S3/S5/S7 behaviour), `settings_no_cancel_test` (S1–S3/S5 before their fix), `settings_returning_test` (fixed S4/S6/S8), `settings_no_forget_test` (S6 before its fix), `settings_save_before_load_test` (S8 before its fix) `settings_edit_before_load_test` (S4 before its fix) and `settings_key_per_keystroke_test` (S7 before its fix).

### Source correspondence

| Model | Code |
|---|---|
| `init` / `LoadCfg` completion | `App` initial state (Settings shown, OpenAI default) + `loadConfigFromDB` → `setConfig(prev => ({ ...prev, ...loaded }))` (`src/App.tsx`) |
| `selectProvider` | provider `<select>` onChange: default endpoint, model reset (`src/components/Settings.tsx`) |
| `typeEndpoint` / `commitEndpoint` | `endpointDraft` onChange / `commitEndpoint` on blur or Enter |
| `setKey` / `setSend` / `setSaveKeys` | `setApiKey` / `setSendApiKey` / `saveApiKeys` checkbox (`src/lib/apiConfig.ts`) |
| `runModelEffect` | the model-list `useEffect` (deps include `config` and `authKey`); skipped for OpenAI without a key |
| `fetchDone` (LM Studio, first stage) | `/v1/models` resolved → `fetchLmStudioReasoning(config.endpoint, authKey)` with the closure's values |
| `fetchDone` (final) | `setConfig({ ...config, model, ... })` with the effect's closure `config` when the selected model differs |
| `activeFetch` / `fetchCancelled` | the effect's cleanup sets `cancelled` on every config change and on unmount; a cancelled run returns before its follow-up request and any state update |
| `fetchFail` | `catch`: error message, no `setConfig` |
| `leaveSettings` / `toggleTheme` | `handleToggle` / `toggleLang` / `toggleDark` → `saveConfigToDB` |
| `SaveCfg` | `saveConfigToDB` → `toPersisted` drops `apiKeys` when `saveApiKeys` is false (`src/lib/configStorage.ts`) |
| `chatSend` | a chat request: `Authorization` from `getAuthKey(config)` to `config.endpoint` |

### Modelling decisions

- **Shape**: one tab, one JS thread; plain Quint with a single `Sys` record (config, view, endpoint draft, in-flight fetches, IndexedDB queue and store, ghost flags).
- **Granularity**: one action per `await`. The LM Studio model fetch has two requests (`/v1/models`, then the native `/api/v1/models`), so two stages.
- **Abstraction**: two providers — OpenAI (needs a key) and LM Studio (two-stage fetch, ignores keys). Endpoints (`10` OpenAI default, `11` LM Studio default, `12` custom, `13` half-typed host) and keys (`0` = empty, `3` = half-typed) are small ints. A model list from endpoint `e` selects model `e`. Any fetch may succeed or fail — real OpenAI rejects invalid keys, so OpenAI scenarios assume a valid key (e.g. pasted). Reasoning support, system prompts, language and theme are not modelled (toggling them is "save now").
- **Ghost intent**: `userCfg` is the config as last set by the user (or the initial load); properties compare against it to tell user changes from writes made by async completions.

#### Assumptions (`const`)

| const | Meaning |
|---|---|
| `MAX_FETCHES` | bound on model-list fetches issued (later config changes issue none) |
| `FIFO_DB` / `SERIALIZED_DB` | as for `chat.qnt`: the browser's completion order, and the serialization in `runInStore` that makes it irrelevant |
| `HAS_STORED` | whether an earlier visit stored a config (LM Studio, key `1`, keys saved) |
| `FORGET_ON_OPT_OUT` | `true` = current code: unchecking "save API keys" calls `forgetStoredApiKeys` (drops the stored keys, records `saveApiKeys: false`); `false` = the code before the S6 fix |
| `NAV_AFTER_LOAD` | `true` = current code: the nav buttons that save the config (To Chat, language, theme) are disabled until the startup load has finished (`configLoaded`); `false` = the code before the S8 fix |
| `FORM_AFTER_LOAD` | `true` = current code: Settings is only rendered once the startup load has finished (`configLoaded`), so nothing can be edited before it; `false` = the code before the S4 fix |
| `KEY_ON_COMMIT` | `true` = current code: the API key input commits on blur/Enter like the endpoint (`typeKey` only changes the draft); `false` = the code before the S7 fix |
| `TIMEOUTS` | as for `chat.qnt`. A timed-out startup load still sets `configLoaded` (defaults stay); a timed-out save or `forgetStoredApiKeys` leaves storage behind memory until the next save completes, so `optOutHonoured`, `noKeysStoredAfterOptOut` and `persistedMatchesMemory` are only required while `storageFailed` (a timeout with no save completed since) is false |
| `CANCEL_STALE` | `true` = current code (the effect cleanup cancels superseded runs); `false` = the code before the S1 fix |
| `LEAK_MUTATION` | mutation knob: the LM Studio native request uses the current key with the closure's endpoint; `keyStaysWithItsEndpoint` must fail |

### Results (sampled `quint run --max-steps 20 --max-samples 20000`)

| Invariant | `settings_returning` | `settings_first` | `settings_no_cancel` (before the fix) |
|---|---|---|---|
| `persistedRespectsOwnFlag` — a record written with "save API keys" off holds no keys | ok | ok | ok |
| `keyStaysWithItsEndpoint` — a key only goes to a provider + endpoint it was configured with | ok | ok | ok |
| `fetchOnlyChangesModel` — the model-list fetch never changes user settings | ok | ok | violated |
| `keySentOnlyAsUserAllows` — a key is sent only to the provider/endpoint/key the user's settings allow | ok | ok | violated |
| `optOutHonoured` — after leaving Settings, keys are stored only if the user opted in | ok | ok | violated |
| `loadKeepsUserEdits` — the initial load never overwrites user edits | ok | ok | violated |
| `persistedMatchesMemory` — in Chat with nothing in flight, IndexedDB holds the in-memory config | ok | ok | violated |
| `noKeysStoredAfterOptOut` — once pending writes complete, no key is stored while "save API keys" is off | ok | ok | violated |
| `noPartialKeySent` — no request carries a half-typed key | ok | ok | violated |

`holds` (= every row) is what `bun run quint:run` checks; `settings_key_per_keystroke`, `settings_edit_before_load`, `settings_save_before_load`, `settings_no_forget`, `settings_no_cancel` and `settings_leak_mutation` violate it, so the properties can fail. Because `keyStaysWithItsEndpoint` held even before the fix, S1 and S3 were violations of the user's current settings, not key leaks: no key reached a provider/endpoint it was never configured with. All witnesses but `wFetchDoneStale` are reached; that one is only reachable before the fix. "Endpoint drafts are never requested" holds by construction (requests read `config.endpoint`, which only `commitEndpoint`, provider selection, the load and fetch completions write), so it has no invariant; note that a blur commits a half-typed host as well (witness `wCommitPartial`).

### Known findings

S7 was fixed by giving the API key input a draft committed on blur/Enter, like the endpoint (a blur in the middle of typing still commits what is there). S4 was fixed by rendering Settings only once the startup load has finished (`configLoaded`), which also keeps the model-list effect from running against the defaults. S8 was fixed by disabling the nav buttons that save the config until the startup load has finished (`configLoaded` in `App.tsx`, also set when the load fails). S6 was fixed by `forgetStoredApiKeys` (`configStorage.ts`), called when "save API keys" is unchecked: it drops the stored keys and records `saveApiKeys: false` in one transaction, without saving the rest of the unsaved form. S1 was fixed by cancelling superseded runs of the model-list effect (a cleanup flag in `Settings.tsx`), which also fixes S2, S3 and S5. The "fixed" scenarios show the current behaviour, the `settings_no_cancel_test` ones ("was") the old one. `tests/e2e/api-key.spec.ts` ("ignores a model list that arrives after the provider changed") reproduces S1 in a browser and fails without the fix.

| Id | Severity (estimate) | Scenario (`settings_test.qnt`) | Summary |
|---|---|---|---|
| S1 | fixed | `providerSwitchKeptTest` (was `providerSwitchRevertedTest`) | The model-list effect has no cancellation and calls `setConfig({ ...config, model })` with the `config` captured when it started. A list that arrives after the user changed provider, endpoint, key, "send API key" or "save API keys" writes the old values back. The window is the fetch latency while the model is unset or not in the list (after a provider switch, first load) |
| S2 | fixed | `saveKeysOptOutKeptTest` (was `saveKeysOptOutRevertedTest`) | Consequence of S1: unchecking "save API keys" is undone (the checkbox shows checked again), and leaving Settings stores the key |
| S3 | fixed | `sendKeyOffNotSentTest` (was `sendKeyOffStillSentTest`) | Unchecking "send API key" does not stop an LM Studio fetch already in flight: its native request still carries the key (to the same endpoint), and by S1 its completion turns sending back on |
| S4 | fixed | `editsWaitForLoadTest` (was `loadOverwritesEditsTest`) | Settings is shown and editable before `loadConfigFromDB` resolves; the stored config is then spread over the edits (window: the IndexedDB read at start) |
| S5 | fixed | `modelNotSelectedAfterLeaveTest` (was `modelSelectedAfterLeaveNotSavedTest`) | A model auto-selected after leaving Settings is only in memory until the next save; it is re-selected on the next visit |
| S6 | fixed | `optOutRemovesStoredKeyTest` (was `optOutKeepsStoredKeyUntilSaveTest`) | Unchecking "save API keys" does not remove an already stored key until the next save (leaving Settings, language or theme toggle); closing the tab while still in Settings keeps it stored. Confirmed as a bug: a key the user opted out of storing must not stay on disk; `noKeysStoredAfterOptOut` is violated |
| S7 | fixed | `keySentOnlyWhenCommittedTest` (was `partialKeySentTest`) | Every API key keystroke changes `config`, so the model-list effect sends a request carrying each partial key (to the configured endpoint; for a cloud provider, a run of failed-auth requests with key fragments). The endpoint input avoids the same pattern by committing on blur/Enter. Confirmed as a bug; `noPartialKeySent` is violated |
| S8 | fixed | `leaveAfterLoadKeepsStoredTest` (was `leaveBeforeLoadSavesDefaultsTest`) | Leaving Settings before `loadConfigFromDB` resolves saves the default config, which replaces the stored one after the load has applied it in memory (window: the IndexedDB read at start). Previously hidden behind S5 |

### Not covered

- Model selection by the user, reasoning effort/toggle, system prompts, language and theme values.
- Ollama, GPT4ALL (dev proxy) and llama.cpp; legacy `apiKey` migration (`migrateApiKey`).
- The insecure-endpoint warning (`isInsecureRemoteEndpoint`) and endpoint trimming.
- IndexedDB failures (`notifyStorageError` path) and several tabs.
