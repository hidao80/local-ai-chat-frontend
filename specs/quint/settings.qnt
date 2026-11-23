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
  /**
   * true = runInStore queues the requests to one database and starts each only
   * after the previous one finished (src/lib/idb.ts), so they complete in issue
   * order even if the browser would not guarantee it (current code). false =
   * the order was left to the browser, i.e. to FIFO_DB.
   */
  const SERIALIZED_DB: bool
  /** Whether a config was stored by an earlier visit. */
  const HAS_STORED: bool
  /** Mutation knob: true makes the LM Studio native request use the current key with the closure's endpoint. */
  const LEAK_MUTATION: bool
  /**
   * true = the model-list effect's cleanup cancels the previous run, so a
   * superseded fetch neither sends its follow-up request nor touches state
   * (current code). false = the behaviour before that fix (S1-S3, S5).
   */
  const CANCEL_STALE: bool
  /**
   * true = unchecking "save API keys" immediately removes the stored keys
   * (forgetStoredApiKeys, current code, S6 fix). false = they stayed stored
   * until the next full save.
   */
  const FORGET_ON_OPT_OUT: bool
  /**
   * true = the nav buttons that save the config (To Chat, language, theme)
   * stay disabled until the startup load has finished (current code, S8 fix).
   * false = they could save the defaults over the stored config first.
   */
  const NAV_AFTER_LOAD: bool
  /**
   * true = the Settings form is disabled until the startup load has finished
   * (current code, S4 fix). false = edits made before it were overwritten.
   */
  const FORM_AFTER_LOAD: bool
  /**
   * true = the API key input commits on blur/Enter, like the endpoint
   * (current code, S7 fix): keystrokes only change the draft. false = every
   * keystroke committed the half-typed key to config.
   */
  const KEY_ON_COMMIT: bool
  /** true = an IndexedDB request that does not finish in time is given up without effect (see chat.qnt). */
  const TIMEOUTS: bool
  /**
   * true = a startup load that times out keeps the app locked and asks the
   * user to reload (current code, S9 fix). false = configLoaded was set with
   * the defaults, so the next save replaced the stored config.
   */
  const RELOAD_ON_LOAD_TIMEOUT: bool

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

  type DbOp = SaveCfg(Stored) | LoadCfg | ForgetKeys

  /** A key as configured together with its provider and endpoint. */
  type Pairing = { p: Provider, e: int, k: int }

  type Sys = {
    config: Config,
    settingsShown: bool,        // App showSettings (Settings mounted)
    draft: int,                 // Settings endpointDraft
    fetches: Set[Fetch],        // in flight
    fetchCount: int,
    activeFetch: int,           // id of the effect run that is not cancelled yet; -1 = none
    loaded: bool,               // App configLoaded: the startup loadConfigFromDB has finished
    storageFailed: bool,        // ghost: a request timed out (error toast shown) and no later save has completed
    reloadPrompt: bool,         // App asks the user to reload: the startup load timed out
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
    partialKeySent: bool,       // a request carried a half-typed key
    loadApplied: bool,          // the startup load of this page load has completed
    storedLost: bool,           // a save replaced a stored config that was never loaded
  }

  pure val PROVIDERS = Set(OpenAI, LmStudio)
  pure def defaultEndpoint(p: Provider): int = if (p == OpenAI) 10 else 11
  pure val CUSTOM_ENDPOINT = 12
  pure val PARTIAL_ENDPOINT = 13    // a half-typed host
  pure val ENDPOINTS = Set(10, 11, CUSTOM_ENDPOINT, PARTIAL_ENDPOINT)
  pure val PARTIAL_KEY = 3          // a half-typed key (one keystroke of a longer key)
  pure val KEYS = Set(0, 1, 2, PARTIAL_KEY)

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
           keyLeak: st.keyLeak or not(st.paired.contains({ p: p, e: e, k: k })),
           partialKeySent: st.partialKeySent or k == PARTIAL_KEY }

  /** Settings' model-list effect: runs after every config change while Settings is mounted. */
  pure def runModelEffect(st: Sys, maxFetches: int): Sys =
    val c = st.config
    val skip = not(st.settingsShown) or (c.provider == OpenAI and authKey(c) == 0) or st.fetchCount >= maxFetches
    if (skip) st
    else
      val sent = sendRequest(st, c.endpoint, c.provider, authKey(c))
      { ...sent,
        fetches: sent.fetches.union(Set({ id: st.fetchCount, cfg: c, stage: ModelList })),
        fetchCount: st.fetchCount + 1,
        activeFetch: st.fetchCount }

  /** setConfig(c) followed by the effects that depend on config. */
  pure def setConfig(st: Sys, c: Config, maxFetches: int): Sys =
    // useEffect: endpointDraft follows config.endpoint
    val draft = if (c.endpoint != st.config.endpoint) c.endpoint else st.draft
    // the model-list effect's cleanup cancels the previous run before the next one starts
    runModelEffect({ ...st, config: c, draft: draft, activeFetch: -1 }, maxFetches)

  /** Whether the completion of `f` may still act (send its follow-up request, set state). */
  pure def isLive(st: Sys, f: Fetch, cancelStale: bool): bool =
    not(cancelStale) or f.id == st.activeFetch

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
    s' = initial(HAS_STORED, PREVIOUS, false),
    last' = "init",
  }

  /** The user reloads the page after the reload prompt: a fresh App over the same IndexedDB. */
  action reload = all {
    s.reloadPrompt,
    s' = initial(s.hasStored, s.stored, s.storedLost),
    last' = "reload",
  }

  pure def initial(hasStored: bool, stored: Stored, storedLost: bool): Sys = {
      config: DEFAULT_CONFIG,
      settingsShown: true,
      draft: DEFAULT_CONFIG.endpoint,
      fetches: Set(),
      fetchCount: 0,
      activeFetch: -1,
      loaded: false,
      storageFailed: false,
      reloadPrompt: false,
      queue: [LoadCfg],
      hasStored: hasStored,
      stored: stored,
      userCfg: DEFAULT_CONFIG,
      userEdited: false,
      staleRevert: false,
      badKeySend: false,
      loadClobber: false,
      paired: Set(pairingOf(DEFAULT_CONFIG)),
      keyLeak: false,
      partialKeySent: false,
      loadApplied: false,
      storedLost: storedLost,
  }

  // --- Settings form (only while Settings is shown) ---

  action selectProvider(p: Provider): bool = all {
    s.settingsShown,
    FORM_AFTER_LOAD implies s.loaded,
    p != s.config.provider,
    s' = userSets(s, { ...s.config, provider: p, endpoint: defaultEndpoint(p), model: -1 }, MAX_FETCHES),
    last' = "selectProvider",
  }

  /** Typing in the endpoint input only changes the draft. */
  action typeEndpoint(e: int): bool = all {
    s.settingsShown,
    FORM_AFTER_LOAD implies s.loaded,
    e != s.draft,
    s' = { ...s, draft: e },
    last' = "typeEndpoint",
  }

  /** commitEndpoint on blur/Enter: the draft (even a half-typed one) becomes config.endpoint. */
  action commitEndpoint = all {
    s.settingsShown,
    FORM_AFTER_LOAD implies s.loaded,
    s.draft != s.config.endpoint,
    s' = userSets(s, { ...s.config, endpoint: s.draft }, MAX_FETCHES),
    last' = "commitEndpoint",
  }

  /** Commit the API key input (blur/Enter): `k` is the finished key. */
  action setKey(k: int): bool = all {
    s.settingsShown,
    FORM_AFTER_LOAD implies s.loaded,
    KEY_ON_COMMIT implies k != PARTIAL_KEY,
    k != s.config.apiKeys.get(s.config.provider),
    s' = userSets(s, { ...s.config, apiKeys: s.config.apiKeys.set(s.config.provider, k) }, MAX_FETCHES),
    last' = "setKey",
  }

  /**
   * A keystroke in the API key input (`k` = the half-typed key). With
   * KEY_ON_COMMIT it only changes the input's draft, which the model does not
   * track; without it, it commits like setKey. (A blur in the middle of typing
   * commits the half-typed key, as for the endpoint; not modelled.)
   */
  action typeKey(k: int): bool = all {
    s.settingsShown,
    FORM_AFTER_LOAD implies s.loaded,
    k != s.config.apiKeys.get(s.config.provider),
    s' = if (KEY_ON_COMMIT) s
         else userSets(s, { ...s.config, apiKeys: s.config.apiKeys.set(s.config.provider, k) }, MAX_FETCHES),
    last' = "typeKey",
  }

  action setSend(b: bool): bool = all {
    s.settingsShown,
    FORM_AFTER_LOAD implies s.loaded,
    b != s.config.send.get(s.config.provider),
    s' = userSets(s, { ...s.config, send: s.config.send.set(s.config.provider, b) }, MAX_FETCHES),
    last' = "setSend",
  }

  action setSaveKeys(b: bool): bool = all {
    s.settingsShown,
    FORM_AFTER_LOAD implies s.loaded,
    b != s.config.saveKeys,
    val edited = userSets(s, { ...s.config, saveKeys: b }, MAX_FETCHES)
    // forgetStoredApiKeys() when unchecked
    s' = if (FORGET_ON_OPT_OUT and not(b)) { ...edited, queue: edited.queue.append(ForgetKeys) } else edited,
    last' = "setSaveKeys",
  }

  // --- Navigation and saves (App.tsx) ---

  /** handleToggle from Settings: save, then show Chat (Settings unmounts, which cancels the effect run). */
  action leaveSettings = all {
    NAV_AFTER_LOAD implies s.loaded,
    s.settingsShown,
    s' = { ...s, settingsShown: false, activeFetch: -1, queue: s.queue.append(SaveCfg(toPersisted(s.config))) },
    last' = "leaveSettings",
  }

  /** handleToggle from Chat: Settings mounts (fresh draft) and its effect runs. */
  action enterSettings = all {
    NAV_AFTER_LOAD implies s.loaded,
    not(s.settingsShown),
    s' = runModelEffect({ ...s, settingsShown: true, draft: s.config.endpoint }, MAX_FETCHES),
    last' = "enterSettings",
  }

  /** toggleLang / toggleDark: save the current config right away (either view). */
  action toggleTheme = all {
    NAV_AFTER_LOAD implies s.loaded,
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
    if (not(isLive(s, f, CANCEL_STALE)))
      // cancelled run: returns without a follow-up request or any state update
      s' = rest
    else if (f.cfg.provider == LmStudio and f.stage == ModelList)
      // fetchLmStudioReasoning(config.endpoint, authKey) with the closure's values
      val key = if (LEAK_MUTATION) authKey(s.config) else authKey(f.cfg)
      s' = { ...sendRequest(rest, f.cfg.endpoint, f.cfg.provider, key),
             fetches: rest.fetches.union(Set({ ...f, stage: LmNative })) }
    else
      s' = applyModelList(rest, f, MAX_FETCHES),
    last' = if (not(isLive(s, f, CANCEL_STALE))) "fetchCancelled"
            else if (f.cfg.provider == LmStudio and f.stage == ModelList) "lmNativeRequest"
            else if (f.cfg.endpoint != f.cfg.model and userFields({ ...f.cfg, model: f.cfg.endpoint }) != userFields(s.config)) "fetchDoneStale"
            else "fetchDone",
  }

  /** A model-list request fails (catch: error message, no setConfig). */
  action fetchFail(f: Fetch): bool = all {
    s.fetches.contains(f),
    s' = { ...s, fetches: s.fetches.exclude(Set(f)) },
    last' = "fetchFail",
  }

  /** The running request times out: aborted without effect; the caller's catch (and App's finally) runs. */
  action dbTimeout(i: int): bool = all {
    TIMEOUTS,
    i >= 0, i < s.queue.length(),
    (FIFO_DB or SERIALIZED_DB) implies i == 0,
    val rest = { ...s, queue: s.queue.slice(0, i).concat(s.queue.slice(i + 1, s.queue.length())), storageFailed: true }
    s' = match s.queue[i] {
      | LoadCfg => if (RELOAD_ON_LOAD_TIMEOUT) { ...rest, reloadPrompt: true }  // stays locked
                   else { ...rest, loaded: true }   // .finally(() => setConfigLoaded(true)), defaults stay
      | _ => rest
    },
    last' = "dbTimeout",
  }

  action dbComplete(i: int): bool = all {
    i >= 0, i < s.queue.length(),
    (FIFO_DB or SERIALIZED_DB) implies i == 0,
    val rest = { ...s, queue: s.queue.slice(0, i).concat(s.queue.slice(i + 1, s.queue.length())) }
    match s.queue[i] {
      // a full save after a timed-out request writes the whole config again
      | SaveCfg(st) => s' = { ...rest, hasStored: true, stored: st, storageFailed: false,
                              storedLost: s.storedLost or (s.hasStored and not(s.loadApplied)) }
      | LoadCfg => s' = { ...applyLoad(rest, MAX_FETCHES), loaded: true, loadApplied: true }
      // drop apiKeys and record saveApiKeys: false in the stored record, if any
      | ForgetKeys => s' = if (not(s.hasStored)) rest
                           else { ...rest, stored: toPersisted({ ...s.stored.cfg, saveKeys: false }) }
    },
    last' = match s.queue[i] {
      | SaveCfg(st) => if (st.hasKeys) "saveWithKeys" else "saveWithoutKeys"
      | LoadCfg => if (s.hasStored) "loadApplied" else "loadEmpty"
      | ForgetKeys => if (s.hasStored and s.stored.hasKeys) "forgetKeys" else "forgetNothing"
    },
  }

  action step = any {
    nondet p = PROVIDERS.oneOf()
    selectProvider(p),
    nondet e = ENDPOINTS.oneOf()
    typeEndpoint(e),
    commitEndpoint,
    nondet k = KEYS.oneOf()
    any { setKey(k), typeKey(PARTIAL_KEY) },
    nondet b = Set(true, false).oneOf()
    any { setSend(b), setSaveKeys(b) },
    leaveSettings,
    enterSettings,
    toggleTheme,
    chatSend,
    all { s.fetches != Set(), nondet f = s.fetches.oneOf() any { fetchDone(f), fetchFail(f) } },
    all { s.queue.length() > 0, nondet i = s.queue.indices().oneOf() any { dbComplete(i), dbTimeout(i) } },
    reload,
  }

  // ---------------------------------------------------------------------------
  // Witnesses
  // ---------------------------------------------------------------------------

  val wSelectProvider = last == "selectProvider"
  val wTypeEndpoint = last == "typeEndpoint"
  val wCommitEndpoint = last == "commitEndpoint"
  val wCommitPartial = last == "commitEndpoint" and s.config.endpoint == PARTIAL_ENDPOINT
  val wSetKey = last == "setKey"
  val wTypeKey = last == "typeKey"
  val wSetSend = last == "setSend"
  val wSetSaveKeys = last == "setSaveKeys"
  val wLeaveSettings = last == "leaveSettings"
  val wEnterSettings = last == "enterSettings"
  val wToggleTheme = last == "toggleTheme"
  val wChatSendWithKey = last == "chatSendWithKey"
  val wLmNativeRequest = last == "lmNativeRequest"
  val wFetchDone = last == "fetchDone" and s.config.model != -1
  /** Only reachable with CANCEL_STALE = false (a superseded run writing its config back). */
  val wFetchDoneStale = last == "fetchDoneStale"
  val wFetchFail = last == "fetchFail"
  val wFetchCancelled = last == "fetchCancelled"
  val wSaveWithKeys = last == "saveWithKeys"
  val wSaveWithoutKeys = last == "saveWithoutKeys"
  val wLoadApplied = last == "loadApplied"
  val wForgetKeys = last == "forgetKeys"
  val wDbTimeout = last == "dbTimeout"
  val wReload = last == "reload"
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
    (not(s.settingsShown) and s.queue.length() == 0 and not(s.storageFailed)) implies
      ((s.hasStored and s.stored.hasKeys) implies s.userCfg.saveKeys)

  /** Once pending writes have completed, no key is stored while the user has "save API keys" turned off (S6). */
  val noKeysStoredAfterOptOut: bool =
    (s.queue.length() == 0 and not(s.storageFailed)) implies ((s.hasStored and s.stored.hasKeys) implies s.userCfg.saveKeys)

  /** In the Chat view with nothing in flight, IndexedDB holds exactly the in-memory config. */
  val persistedMatchesMemory: bool =
    (not(s.settingsShown) and s.queue.length() == 0 and s.fetches == Set() and not(s.storageFailed)) implies
      (s.hasStored and s.stored == toPersisted(s.config))

  /** A key only ever goes to a provider and endpoint it was configured together with (AGENTS.md: never relay it elsewhere). */
  val keyStaysWithItsEndpoint: bool = not(s.keyLeak)

  /** No request carries a half-typed key (S7: every keystroke in the API key input updates config). */
  val noPartialKeySent: bool = not(s.partialKeySent)

  /** A stored config is only replaced after it has been loaded (S9: a load timeout unlocked saving the defaults). */
  val storedKeptUntilLoaded: bool = not(s.storedLost)

  /** Expected to hold. */
  val holds: bool =
    persistedRespectsOwnFlag and keyStaysWithItsEndpoint and fetchOnlyChangesModel
    and keySentOnlyAsUserAllows and optOutHonoured and noKeysStoredAfterOptOut
    and persistedMatchesMemory and loadKeepsUserEdits and noPartialKeySent
    and storedKeptUntilLoaded
}

// -----------------------------------------------------------------------------
// Instances
// -----------------------------------------------------------------------------

/** Returning user: a config (LM Studio, key saved) is already stored. */
module settings_returning {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = false, CANCEL_STALE = true, FORGET_ON_OPT_OUT = true, NAV_AFTER_LOAD = true, FORM_AFTER_LOAD = true, KEY_ON_COMMIT = true, SERIALIZED_DB = true, TIMEOUTS = true, RELOAD_ON_LOAD_TIMEOUT = true).*
}

/** First visit: nothing stored. */
module settings_first {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = false, LEAK_MUTATION = false, CANCEL_STALE = true, FORGET_ON_OPT_OUT = true, NAV_AFTER_LOAD = true, FORM_AFTER_LOAD = true, KEY_ON_COMMIT = true, SERIALIZED_DB = true, TIMEOUTS = true, RELOAD_ON_LOAD_TIMEOUT = true).*
}

/** Mutation: the native request mixes the current key with the closure's endpoint; keyStaysWithItsEndpoint must fail. */
module settings_leak_mutation {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = true, CANCEL_STALE = false, FORGET_ON_OPT_OUT = false, NAV_AFTER_LOAD = true, FORM_AFTER_LOAD = true, KEY_ON_COMMIT = true, SERIALIZED_DB = true, TIMEOUTS = true, RELOAD_ON_LOAD_TIMEOUT = true).*
}

/** The code before the model-list effect got its cleanup; fetchOnlyChangesModel and the others in `holds` must fail. */
module settings_no_cancel {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = false, CANCEL_STALE = false, FORGET_ON_OPT_OUT = false, NAV_AFTER_LOAD = true, FORM_AFTER_LOAD = true, KEY_ON_COMMIT = true, SERIALIZED_DB = true, TIMEOUTS = true, RELOAD_ON_LOAD_TIMEOUT = true).*
}

/** The code before the S6 fix: unchecking "save API keys" left the stored keys until the next save. */
module settings_no_forget {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = false, CANCEL_STALE = true, FORGET_ON_OPT_OUT = false, NAV_AFTER_LOAD = true, FORM_AFTER_LOAD = true, KEY_ON_COMMIT = true, SERIALIZED_DB = true, TIMEOUTS = true, RELOAD_ON_LOAD_TIMEOUT = true).*
}

/** The code before the S8 fix: leaving Settings before the startup load saved the defaults. */
module settings_save_before_load {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = false, CANCEL_STALE = true, FORGET_ON_OPT_OUT = true, NAV_AFTER_LOAD = false, FORM_AFTER_LOAD = true, KEY_ON_COMMIT = true, SERIALIZED_DB = true, TIMEOUTS = true, RELOAD_ON_LOAD_TIMEOUT = true).*
}

/** The code before the S4 fix: the form could be edited before the startup load overwrote it. */
module settings_edit_before_load {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = false, CANCEL_STALE = true, FORGET_ON_OPT_OUT = true, NAV_AFTER_LOAD = true, FORM_AFTER_LOAD = false, KEY_ON_COMMIT = true, SERIALIZED_DB = true, TIMEOUTS = true, RELOAD_ON_LOAD_TIMEOUT = true).*
}

/** The code before the S7 fix: every keystroke committed the half-typed API key. */
module settings_key_per_keystroke {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = false, CANCEL_STALE = true, FORGET_ON_OPT_OUT = true, NAV_AFTER_LOAD = true, FORM_AFTER_LOAD = true, KEY_ON_COMMIT = false, SERIALIZED_DB = true, TIMEOUTS = true, RELOAD_ON_LOAD_TIMEOUT = true).*
}

/** IndexedDB completions in any order (weaker assumption than FIFO_DB). */
module settings_unordered {
  import settings(MAX_FETCHES = 4, FIFO_DB = false, HAS_STORED = true, LEAK_MUTATION = false, CANCEL_STALE = true, FORGET_ON_OPT_OUT = true, NAV_AFTER_LOAD = true, FORM_AFTER_LOAD = true, KEY_ON_COMMIT = true, SERIALIZED_DB = true, TIMEOUTS = true, RELOAD_ON_LOAD_TIMEOUT = true).*
}

/** Before requests were serialized: completions in any order, as the browser may deliver them. */
module settings_unserialized {
  import settings(MAX_FETCHES = 4, FIFO_DB = false, HAS_STORED = true, LEAK_MUTATION = false, CANCEL_STALE = true, FORGET_ON_OPT_OUT = true, NAV_AFTER_LOAD = true, FORM_AFTER_LOAD = true, KEY_ON_COMMIT = true, SERIALIZED_DB = false, TIMEOUTS = true, RELOAD_ON_LOAD_TIMEOUT = true).*
}

/** The code before the S9 fix: a startup load that timed out unlocked the app with the defaults. */
module settings_load_timeout_unlocks {
  import settings(MAX_FETCHES = 4, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = false, CANCEL_STALE = true, FORGET_ON_OPT_OUT = true, NAV_AFTER_LOAD = true, FORM_AFTER_LOAD = true, KEY_ON_COMMIT = true, SERIALIZED_DB = true, TIMEOUTS = true, RELOAD_ON_LOAD_TIMEOUT = false).*
}
