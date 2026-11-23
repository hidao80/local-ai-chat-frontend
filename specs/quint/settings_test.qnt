// -*- mode: Bluespec; -*-
/**
 * Deterministic scenarios for settings.qnt. Each `run` reproduces one
 * behaviour (happy path, or one finding from README.md) step by step.
 *
 *   bun run quint:test
 */
module settings_test {
  import settings(MAX_FETCHES = 8, FIFO_DB = true, HAS_STORED = false, LEAK_MUTATION = false).* from "./settings"

  /** Complete the next stage of the model-list fetch with ghost id `id`. */
  action done(id: int): bool = all {
    s.fetches.exists(f => f.id == id),
    nondet f = s.fetches.filter(f => f.id == id).oneOf()
    fetchDone(f),
  }

  action db0 = dbComplete(0)

  /** Happy path: pick LM Studio, the model list selects a model, leaving Settings saves it. */
  run happyPathTest =
    init.then(db0)                          // nothing stored
      .then(selectProvider(LmStudio))       // fetch 0
      .then(done(0)).then(done(0))          // /v1/models, then the native request; model selected -> fetch 1
      .then(done(1)).then(done(1))          // same model: no further change
      .then(leaveSettings).then(db0)
      .expect(all {
        s.config.model == 11,
        fetchOnlyChangesModel,
        keySentOnlyAsUserAllows,
        persistedMatchesMemory,
        optOutHonoured,
      })

  /**
   * S1: a model list that arrives after the user switched provider writes the
   * old provider (and its endpoint) back, because setConfig spreads the
   * effect's stale `config` closure.
   */
  run providerSwitchRevertedTest =
    init.then(db0)
      .then(setKey(1))                      // OpenAI key -> fetch 0 against OpenAI
      .then(selectProvider(LmStudio))       // fetch 1 against LM Studio
      .then(done(0))                        // OpenAI's list arrives late
      .expect(all {
        not(fetchOnlyChangesModel),
        s.config.provider == OpenAI,
        s.config.endpoint == 10,
        s.userCfg.provider == LmStudio,
      })

  /** S2: unchecking "save API keys" is undone by a late model list, so leaving Settings stores the key. */
  run saveKeysOptOutRevertedTest =
    init.then(db0)
      .then(selectProvider(LmStudio))       // fetch 0
      .then(setKey(1))                      // fetch 1 (snapshot: key 1, saveKeys on)
      .then(setSaveKeys(false))             // fetch 2
      .then(done(1)).then(done(1))          // fetch 1 completes and writes saveKeys back on
      .expect(s.config.saveKeys and not(s.userCfg.saveKeys))
      .then(leaveSettings).then(db0)
      .expect(all {
        s.stored.hasKeys,
        s.stored.cfg.apiKeys.get(LmStudio) == 1,
        not(optOutHonoured),
      })

  /**
   * S3: unchecking "send API key" does not stop an LM Studio model fetch that
   * already started; its second request still carries the key, and its
   * completion turns sending back on.
   */
  run sendKeyOffStillSentTest =
    init.then(db0)
      .then(selectProvider(LmStudio))       // fetch 0
      .then(setKey(1))                      // fetch 1 (key 1)
      .then(setSend(false))                 // fetch 2 (no key)
      .then(done(1))                        // fetchLmStudioReasoning(endpoint, key 1)
      .expect(not(keySentOnlyAsUserAllows))
      .then(done(1))
      .expect(s.config.send.get(LmStudio) and authKey(s.config) == 1)

  /** S5: the model auto-selected after leaving Settings is only in memory. */
  run modelSelectedAfterLeaveNotSavedTest =
    init.then(db0)
      .then(selectProvider(LmStudio))       // fetch 0
      .then(leaveSettings).then(db0)        // saved with model unset
      .then(done(0)).then(done(0))          // model selected while Chat is shown
      .expect(all {
        s.config.model == 11,
        s.stored.cfg.model == -1,
        not(persistedMatchesMemory),
      })
}

/** Scenarios for a returning user (a config is already stored). */
module settings_returning_test {
  import settings(MAX_FETCHES = 8, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = false).* from "./settings"

  action db0 = dbComplete(0)

  /** S4: settings edited before loadConfigFromDB resolves are overwritten by the stored config. */
  run loadOverwritesEditsTest =
    init
      .then(setKey(2))                      // OpenAI key typed while the load is pending
      .then(db0)                            // stored LM Studio config is spread over it
      .expect(all {
        not(loadKeepsUserEdits),
        s.config.provider == LmStudio,
        s.config.apiKeys.get(OpenAI) == 0,
      })

  /** S6: unchecking "save API keys" leaves the stored key in IndexedDB until the next save. */
  run optOutKeepsStoredKeyUntilSaveTest =
    init.then(db0)                          // LM Studio, key 1, stored with keys
      .then(setSaveKeys(false))
      .expect(s.stored.hasKeys and s.stored.cfg.apiKeys.get(LmStudio) == 1)
      .then(leaveSettings).then(db0)
      .expect(not(s.stored.hasKeys) and optOutHonoured)
}
