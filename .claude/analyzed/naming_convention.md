---
name: analyzed-naming-convention
description: Observed naming conventions for variables, IndexedDB stores/fields, functions, and components.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Naming Convention

## Table of Contents

- [Variables](#variables)
- [IndexedDB Store Names ("Table" Equivalent)](#indexeddb-store-names-table-equivalent)
- [Record Fields ("Column" Equivalent)](#record-fields-column-equivalent)
- [Functions](#functions)
- [Components / Types ("Class" Equivalent)](#components--types-class-equivalent)
- [Inconsistencies Observed](#inconsistencies-observed)

---

## Variables

`camelCase` throughout — `config`, `showSettings`, `systemPrompts`, `currentSessionId`, `atBottom`. State setters follow React convention `set` + PascalCase noun (`setConfig`, `setLoadingModels`). Matches `.claude/rules/code-style.md`.

## IndexedDB Store Names ("Table" Equivalent)

| DB | Store | Naming pattern |
|---|---|---|
| `ai-chat-config` | `config` | Singular, lowercase |
| `chat-history` | `sessions` | Plural, lowercase |

DB names use `kebab-case` (`ai-chat-config`, `chat-history`); store names are single lowercase words. No prefix/namespace convention (no `app_` or similar). See [[databases]].

## Record Fields ("Column" Equivalent)

`camelCase` for all fields — `endpoint`, `apiKey`, `reasoningEffort`, `createdAt`, `updatedAt`, `tokensPerSecond`. Timestamp fields consistently suffixed `At` and stored as `number` (Unix ms), not `Date` objects or ISO strings.

## Functions

`camelCase`, verb-first: `saveChatSession`, `loadChatSession`, `loadAllChatSessions`, `deleteChatSession`, `saveConfigToDB`, `loadConfigFromDB`, `toggleLang`, `toggleDark`, `handleToggle`, `isReasoningModel` (boolean predicate, `is` prefix), `copyToClipboard`, `sendMessage`.

Event handlers inline in JSX use `handle` or `on` + description (`handleToggle`, `handleDeleteClick`, `handleConfirmDelete`, `onLoadSession` as a prop name vs. `loadSession` as the implementation).

## Components / Types ("Class" Equivalent)

- **Components**: `PascalCase` function declarations — `App`, `Settings`, `Chat`, `ChatSidebar`, `ConfirmModal`, `Minimap`. Matches `.claude/rules/code-style.md` ("Functional components only").
- **Types**: `PascalCase` — `ApiConfig`, `Message`, `ChatSession`, `ModelInfo`, `StoredConfig`. Defined as inline object type literals per prop, not separate named `Props` interfaces (per `.claude/rules/code-style.md`).
- **DB/store name constants**: `UPPER_SNAKE_CASE` — `CHAT_DB_NAME`, `CHAT_STORE_NAME`, `CHAT_DB_VERSION`, `DB_NAME`, `STORE_NAME` (the latter two in `App.tsx`, module-scoped, not exported — same names reused independently in each file, no shared constants module).

## Inconsistencies Observed

- `App.tsx`'s IndexedDB constants (`DB_NAME`, `STORE_NAME`) shadow the generic pattern also used with different values in `ChatAndSettings.tsx` (`CHAT_DB_NAME`, `CHAT_STORE_NAME`) — no naming collision at runtime (separate modules), but the asymmetric prefixing (`CHAT_*` vs. unprefixed) is inconsistent. See [[utilities]].
- Config IndexedDB helpers (`App.tsx`) use callback style (`loadConfigFromDB(callback)`); Chat IndexedDB helpers (`ChatAndSettings.tsx`) use `Promise`-returning style (`async function loadChatSession()`) — same problem domain, two different async conventions. See [[utilities]].

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
