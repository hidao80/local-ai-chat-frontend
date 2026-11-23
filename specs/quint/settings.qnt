// -*- mode: Bluespec; -*-
/**
 * Settings / config persistence model for local-ai-chat-frontend.
 *
 * Grounds (see README.md for the correspondence map):
 *   src/App.tsx               config state, loadConfigFromDB on mount,
 *                             saveConfigToDB on leaving Settings / toggleLang / toggleDark
 *   src/components/Settings.tsx  provider select, endpoint draft + commit (blur/Enter),
 *                             API key, sendApiKey, saveApiKeys, model-list fetch effect
 *   src/lib/apiConfig.ts      getAuthKey / setApiKey / setSendApiKey
 *   src/lib/configStorage.ts  toPersisted (drops apiKeys when saveApiKeys is false)
 *
 * One browser tab, one JS thread. Concurrency comes from async completions
 * (model-list fetches, IndexedDB requests) interleaving with user events.
 * Each `await` boundary is an action boundary.
 *
 * Abstractions: two providers (OpenAI needs a key, LM Studio does a second
 * native request), endpoints and keys are small ints, a model list fetched
 * from endpoint e selects model e. Reasoning support, system prompts, theme
 * and language are not modelled (lang/theme toggles are just "save now").
 */
module settings {
  // ---------------------------------------------------------------------------
  // Assumptions (constants)
  // ---------------------------------------------------------------------------

  /** Model-list fetches the model issues; later config changes issue none (bound). */
  const MAX_FETCHES: int
  /** IndexedDB requests complete in issue order (see chat.qnt for why this is an assumption). */
  const FIFO_DB: bool
  /** Whether a config was stored by an earlier visit. */
  const HAS_STORED: bool
  /** Mutation knob: true makes the LM Studio native request use the current key with the closure's endpoint. */
  const LEAK_MUTATION: bool

  // ---------------------------------------------------------------------------
  // Types and constants of the domain
  // ---------------------------------------------------------------------------

  type Provider = OpenAI | LmStudio

  /** ApiConfig. Endpoints and keys are opaque ints; key 0 = empty, model -1 = undefined. */
  type Config = {
    provider: Provider,
    endpoint: int,
    apiKeys: Provider -> int,
    send: Provider -> bool,     // sendApiKey (unset = true)
    saveKeys: bool,             // saveApiKeys (unset = true)
    model: int,
  }

  /** The record in the `ai-chat-config` store. `hasKeys` = false: apiKeys was dropped. */
  type Stored = { cfg: Config, hasKeys: bool }

  /** A model-list fetch: the effect's closure snapshot of `config`. */
  type Stage = ModelList | LmNative
  type Fetch = { id: int, cfg: Config, stage: Stage }

  type DbOp = SaveCfg(Stored) | LoadCfg

  /** A key as configured together with its provider and endpoint. */
  type Pairing = { p: Provider, e: int, k: int }

  type Sys = {
    config: Config,
    settingsShown: bool,        // App showSettings (Settings mounted)
    draft: int,                 // Settings endpointDraft
    fetches: Set[Fetch],        // in flight
    fetchCount: int,
    queue: List[DbOp],          // issued, not yet completed IDB requests
    hasStored: bool,
    stored: Stored,
    // ghost state, read only by properties
    userCfg: Config,            // config as last set by the user (or by the initial load)
    userEdited: bool,           // the user changed a setting before the load completed
    staleRevert: bool,          // a fetch completion changed a field other than `model`
    badKeySend: bool,           // a key was sent where the user's settings do not allow it
    loadClobber: bool,          // the initial load overwrote settings the user had edited
    paired: Set[Pairing],       // every (provider, endpoint, key) the user or the load configured
    keyLeak: bool,              // a key was sent to a (provider, endpoint) it was never configured with
  }

  pure val PROVIDERS = Set(OpenAI, LmStudio)
  pure def defaultEndpoint(p: Provider): int = if (p == OpenAI) 10 else 11
  pure val CUSTOM_ENDPOINT = 12
  pure val PARTIAL_ENDPOINT = 13    // a half-typed host
  pure val ENDPOINTS = Set(10, 11, CUSTOM_ENDPOINT, PARTIAL_ENDPOINT)
  pure val KEYS = Set(0, 1, 2)

  pure val DEFAULT_CONFIG: Config = {
    provider: OpenAI,
    endpoint: 10,
    apiKeys: PROVIDERS.mapBy(_ => 0),
    send: PROVIDERS.mapBy(_ => true),
    saveKeys: true,
    model: -1,
  }

  /** What an earlier visit left in IndexedDB. */
  pure val PREVIOUS: Stored = {
    cfg: { ...DEFAULT_CONFIG, provider: LmStudio, endpoint: 11, apiKeys: Map(OpenAI -> 0, LmStudio -> 1) },
    hasKeys: true,
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  var s: Sys
  var last: str   // name of the last action (for witnesses)

  // ---------------------------------------------------------------------------
  // Functional layer
  // ---------------------------------------------------------------------------

  /** getAuthKey: the selected provider's key, or 0 when sending is off. */
  pure def authKey(c: Config): int =
    if (c.send.get(c.provider)) c.apiKeys.get(c.provider) else 0

  /** Fields the user controls (everything but the auto-selected model). */
  pure def userFields(c: Config): Config = { ...c, model: 0 }

  /** configStorage.toPersisted. */
  pure def toPersisted(c: Config): Stored =
    if (c.saveKeys) { cfg: c, hasKeys: true }
    else { cfg: { ...c, apiKeys: PROVIDERS.mapBy(_ => 0) }, hasKeys: false }

  /** Whether the user's settings allow sending key `k` of provider `p` to endpoint `e`. */
  pure def allowedBy(u: Config, e: int, p: Provider, k: int): bool =
    u.provider == p and u.endpoint == e and u.send.get(p) and u.apiKeys.get(p) == k

  /** The pairing a config sets up for its selected provider. */
  pure def pairingOf(c: Config): Pairing = { p: c.provider, e: c.endpoint, k: c.apiKeys.get(c.provider) }

  /** Record a request carrying key `k` (0 = no Authorization header). */
  pure def sendRequest(st: Sys, e: int, p: Provider, k: int): Sys =
    if (k == 0) st
    else { ...st,
           badKeySend: st.badKeySend or not(allowedBy(st.userCfg, e, p, k)),
           keyLeak: st.keyLeak or not(st.paired.contains({ p: p, e: e, k: k })) }

  /** Settings' model-list effect: runs after every config change while Settings is mounted. */
  pure def runModelEffect(st: Sys, maxFetches: int): Sys =
    val c = st.config
    val skip = not(st.settingsShown) or (c.provider == OpenAI and authKey(c) == 0) or st.fetchCount >= maxFetches
    if (skip) st
    else
      val sent = sendRequest(st, c.endpoint, c.provider, authKey(c))
      { ...sent,
        fetches: sent.fetches.union(Set({ id: st.fetchCount, cfg: c, stage: ModelList })),
        fetchCount: st.fetchCount + 1 }

  /** setConfig(c) followed by the effects that depend on config. */
  pure def setConfig(st: Sys, c: Config, maxFetches: int): Sys =
    // useEffect: endpointDraft follows config.endpoint
    val draft = if (c.endpoint != st.config.endpoint) c.endpoint else st.draft
    runModelEffect({ ...st, config: c, draft: draft }, maxFetches)

  /** A user edit in the Settings form. */
  pure def userSets(st: Sys, c: Config, maxFetches: int): Sys =
    setConfig({ ...st, userCfg: c, userEdited: true, paired: st.paired.union(Set(pairingOf(c))) }, c, maxFetches)

  /** Model list received for snapshot `f`: select its model, writing back the whole snapshot. */
  pure def applyModelList(st: Sys, f: Fetch, maxFetches: int): Sys =
    val selected = f.cfg.endpoint
    if (selected == f.cfg.model) st
    else
      val c = { ...f.cfg, model: selected }   // setConfig({ ...config, model }) with the closure's config
      setConfig({ ...st, staleRevert: st.staleRevert or userFields(c) != userFields(st.config) }, c, maxFetches)

  /** App's load handler: setConfig(prev => ({ ...prev, ...loaded })). */
  pure def applyLoad(st: Sys, maxFetches: int): Sys =
    if (not(st.hasStored)) st
    else
      val prev = st.config
      val l = st.stored
      val merged = { ...l.cfg, apiKeys: if (l.hasKeys) l.cfg.apiKeys else prev.apiKeys }
      val clobber = st.userEdited and userFields(merged) != userFields(prev)
      setConfig({ ...st, userCfg: merged, loadClobber: st.loadClobber or clobber,
                  paired: st.paired.union(Set(pairingOf(merged))) }, merged, maxFetches)

  // ---------------------------------------------------------------------------
  // State machine
  // ---------------------------------------------------------------------------

  /** App mounts with Settings shown and the default config; loadConfigFromDB() is issued. */
  action init = all {
    s' = {
      config: DEFAULT_CONFIG,
      settingsShown: true,
      draft: DEFAULT_CONFIG.endpoint,
      fetches: Set(),
      fetchCount: 0,
      queue: [LoadCfg],
      hasStored: HAS_STORED,
      stored: PREVIOUS,
      userCfg: DEFAULT_CONFIG,
      userEdited: false,
      staleRevert: false,
      badKeySend: false,
      loadClobber: false,
      paired: Set(pairingOf(DEFAULT_CONFIG)),
      keyLeak: false,
    },
    last' = "init",
  }

  // --- Settings form (only while Settings is shown) ---

  action selectProvider(p: Provider): bool = all {
    s.settingsShown,
    p != s.config.provider,
    s' = userSets(s, { ...s.config, provider: p, endpoint: defaultEndpoint(p), model: -1 }, MAX_FETCHES),
    last' = "selectProvider",
  }

  /** Typing in the endpoint input only changes the draft. */
  action typeEndpoint(e: int): bool = all {
    s.settingsShown,
    e != s.draft,
    s' = { ...s, draft: e },
    last' = "typeEndpoint",
  }

  /** commitEndpoint on blur/Enter: the draft (even a half-typed one) becomes config.endpoint. */
  action commitEndpoint = all {
    s.settingsShown,
    s.draft != s.config.endpoint,
    s' = userSets(s, { ...s.config, endpoint: s.draft }, MAX_FETCHES),
    last' = "commitEndpoint",
  }

  action setKey(k: int): bool = all {
    s.settingsShown,
    k != s.config.apiKeys.get(s.config.provider),
    s' = userSets(s, { ...s.config, apiKeys: s.config.apiKeys.set(s.config.provider, k) }, MAX_FETCHES),
    last' = "setKey",
  }

  action setSend(b: bool): bool = all {
    s.settingsShown,
    b != s.config.send.get(s.config.provider),
    s' = userSets(s, { ...s.config, send: s.config.send.set(s.config.provider, b) }, MAX_FETCHES),
    last' = "setSend",
  }

  action setSaveKeys(b: bool): bool = all {
    s.settingsShown,
    b != s.config.saveKeys,
    s' = userSets(s, { ...s.config, saveKeys: b }, MAX_FETCHES),
    last' = "setSaveKeys",
  }

  // --- Navigation and saves (App.tsx) ---

  /** handleToggle from Settings: save, then show Chat (Settings unmounts; fetches keep running). */
  action leaveSettings = all {
    s.settingsShown,
    s' = { ...s, settingsShown: false, queue: s.queue.append(SaveCfg(toPersisted(s.config))) },
    last' = "leaveSettings",
  }

  /** handleToggle from Chat: Settings mounts (fresh draft) and its effect runs. */
  action enterSettings = all {
    not(s.settingsShown),
    s' = runModelEffect({ ...s, settingsShown: true, draft: s.config.endpoint }, MAX_FETCHES),
    last' = "enterSettings",
  }

  /** toggleLang / toggleDark: save the current config right away (either view). */
  action toggleTheme = all {
    s' = { ...s, queue: s.queue.append(SaveCfg(toPersisted(s.config))) },
    last' = "toggleTheme",
  }

  /** A chat request: Authorization from getAuthKey(config), sent to config.endpoint. */
  action chatSend = all {
    not(s.settingsShown),
    s' = sendRequest(s, s.config.endpoint, s.config.provider, authKey(s.config)),
    last' = if (authKey(s.config) != 0) "chatSendWithKey" else "chatSend",
  }

  // --- Async completions ---

  /** A model-list response arrives (setState on an unmounted Settings is a no-op; setConfig is App's). */
  action fetchDone(f: Fetch): bool = all {
    s.fetches.contains(f),
    val rest = { ...s, fetches: s.fetches.exclude(Set(f)) }
    if (f.cfg.provider == LmStudio and f.stage == ModelList)
      // fetchLmStudioReasoning(config.endpoint, authKey) with the closure's values
      val key = if (LEAK_MUTATION) authKey(s.config) else authKey(f.cfg)
      s' = { ...sendRequest(rest, f.cfg.endpoint, f.cfg.provider, key),
             fetches: rest.fetches.union(Set({ ...f, stage: LmNative })) }
    else
      s' = applyModelList(rest, f, MAX_FETCHES),
    last' = if (f.cfg.provider == LmStudio and f.stage == ModelList) "lmNativeRequest"
            else if (f.cfg.endpoint != f.cfg.model and userFields({ ...f.cfg, model: f.cfg.endpoint }) != userFields(s.config)) "fetchDoneStale"
            else "fetchDone",
  }

  /** A model-list request fails (catch: error message, no setConfig). */
  action fetchFail(f: Fetch): bool = all {
    s.fetches.contains(f),
    s' = { ...s, fetches: s.fetches.exclude(Set(f)) },
    last' = "fetchFail",
  }

  action dbComplete(i: int): bool = all {
    i >= 0, i < s.queue.length(),
    FIFO_DB implies i == 0,
    val rest = { ...s, queue: s.queue.slice(0, i).concat(s.queue.slice(i + 1, s.queue.length())) }
    match s.queue[i] {
      | SaveCfg(st) => s' = { ...rest, hasStored: true, stored: st }
      | LoadCfg => s' = applyLoad(rest, MAX_FETCHES)
    },
    last' = match s.queue[i] {
      | SaveCfg(st) => if (st.hasKeys) "saveWithKeys" else "saveWithoutKeys"
      | LoadCfg => if (s.hasStored) "loadApplied" else "loadEmpty"
    },
  }

  action step = any {
    nondet p = PROVIDERS.oneOf()
    selectProvider(p),
    nondet e = ENDPOINTS.oneOf()
    typeEndpoint(e),
    commitEndpoint,
    nondet k = KEYS.oneOf()
    setKey(k),
    nondet b = Set(true, false).oneOf()
    any { setSend(b), setSaveKeys(b) },
    leaveSettings,
    enterSettings,
    toggleTheme,
    chatSend,
    all { s.fetches != Set(), nondet f = s.fetches.oneOf() any { fetchDone(f), fetchFail(f) } },
    all { s.queue.length() > 0, nondet i = s.queue.indices().oneOf() dbComplete(i) },
  }

  // ---------------------------------------------------------------------------
  // Witnesses
  // ---------------------------------------------------------------------------

  val wSelectProvider = last == "selectProvider"
  val wTypeEndpoint = last == "typeEndpoint"
  val wCommitEndpoint = last == "commitEndpoint"
  val wCommitPartial = last == "commitEndpoint" and s.config.endpoint == PARTIAL_ENDPOINT
  val wSetKey = last == "setKey"
  val wSetSend = last == "setSend"
  val wSetSaveKeys = last == "setSaveKeys"
  val wLeaveSettings = last == "leaveSettings"
  val wEnterSettings = last == "enterSettings"
  val wToggleTheme = last == "toggleTheme"
  val wChatSendWithKey = last == "chatSendWithKey"
  val wLmNativeRequest = last == "lmNativeRequest"
  val wFetchDone = last == "fetchDone" and s.config.model != -1
  val wFetchDoneStale = last == "fetchDoneStale"
  val wFetchFail = last == "fetchFail"
  val wSaveWithKeys = last == "saveWithKeys"
  val wSaveWithoutKeys = last == "saveWithoutKeys"
  val wLoadApplied = last == "loadApplied"
  /** Keys still stored although the user unchecked "save API keys" (until the next save). */
  val wKeysStoredWhileOptedOut = s.hasStored and s.stored.hasKeys and not(s.userCfg.saveKeys)

  // ---------------------------------------------------------------------------
  // Invariants
  // ---------------------------------------------------------------------------

  /** Stored data never contains keys when it was written with saveApiKeys off. */
  val persistedRespectsOwnFlag: bool =
    s.hasStored implies (s.stored.hasKeys == s.stored.cfg.saveKeys
                         and (not(s.stored.hasKeys) implies s.stored.cfg.apiKeys == PROVIDERS.mapBy(_ => 0)))

  /** The model-list fetch only ever changes `model`, never user-controlled settings. */
  val fetchOnlyChangesModel: bool = not(s.staleRevert)

  /** A key is only sent to the endpoint, provider and key the user's current settings allow. */
  val keySentOnlyAsUserAllows: bool = not(s.badKeySend)

  /** The initial load never overwrites settings the user already edited. */
  val loadKeepsUserEdits: bool = not(s.loadClobber)

  /** Once the user has left Settings and saves have settled, keys are stored only if the user opted in. */
  val optOutHonoured: bool =
    (not(s.settingsShown) and s.queue.length() == 0) implies
      ((s.hasStored and s.stored.hasKeys) implies s.userCfg.saveKeys)

  /** In the Chat view with nothing in flight, IndexedDB holds exactly the in-memory config. */
  val persistedMatchesMemory: bool =
    (not(s.settingsShown) and s.queue.length() == 0 and s.fetches == Set()) implies
      (s.hasStored and s.stored == toPersisted(s.config))

  /** A key only ever goes to a provider and endpoint it was configured together with (AGENTS.md: never relay it elsewhere). */
  val keyStaysWithItsEndpoint: bool = not(s.keyLeak)

  /** Expected to hold. */
  val holds: bool = persistedRespectsOwnFlag and keyStaysWithItsEndpoint
}

// -----------------------------------------------------------------------------
// Instances
// -----------------------------------------------------------------------------

/** Returning user: a config (LM Studio, key saved) is already stored. */
module settings_returning {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = false).*
}

/** First visit: nothing stored. */
module settings_first {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = false, LEAK_MUTATION = false).*
}

/** Mutation: the native request mixes the current key with the closure's endpoint; keyStaysWithItsEndpoint must fail. */
module settings_leak_mutation {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = true).*
}
