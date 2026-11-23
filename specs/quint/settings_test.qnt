// -*- mode: Bluespec; -*-
/**
 * Deterministic scenarios for settings.qnt. Each `run` reproduces one
 * behaviour (happy path, a fixed finding, or an open finding from README.md)
 * step by step.
 *
 *   bun run quint:test
 */
module settings_test {
  import settings(MAX_FETCHES = 8, FIFO_DB = true, HAS_STORED = false, LEAK_MUTATION = false, CANCEL_STALE = true).* from "./settings"

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

  /** S1 (fixed): a model list that arrives after a provider switch is discarded. */
  run providerSwitchKeptTest =
    init.then(db0)
      .then(setKey(1))                      // OpenAI key -> fetch 0 against OpenAI
      .then(selectProvider(LmStudio))       // cleanup cancels fetch 0; fetch 1 against LM Studio
      .then(done(0))                        // OpenAI's list arrives late
      .expect(all {
        fetchOnlyChangesModel,
        s.config.provider == LmStudio,
        s.config.endpoint == 11,
      })

  /** S2 (fixed): unchecking "save API keys" stays unchecked, so leaving Settings stores no key. */
  run saveKeysOptOutKeptTest =
    init.then(db0)
      .then(selectProvider(LmStudio))       // fetch 0
      .then(setKey(1))                      // fetch 1
      .then(setSaveKeys(false))             // fetch 2; fetch 1 is cancelled
      .then(done(1))
      .expect(not(s.config.saveKeys))
      .then(leaveSettings).then(db0)
      .expect(not(s.stored.hasKeys) and optOutHonoured)

  /** S3 (fixed): after "send API key" is unchecked, a superseded LM Studio fetch sends no follow-up request. */
  run sendKeyOffNotSentTest =
    init.then(db0)
      .then(selectProvider(LmStudio))       // fetch 0
      .then(setKey(1))                      // fetch 1 (key 1, allowed at that time)
      .then(setSend(false))                 // fetch 2 (no key); fetch 1 is cancelled
      .then(done(1))                        // returns before fetchLmStudioReasoning
      .expect(all {
        keySentOnlyAsUserAllows,
        not(s.fetches.exists(f => f.id == 1)),
        authKey(s.config) == 0,
      })

  /** S5 (fixed): leaving Settings cancels the run, so no model is selected only in memory. */
  run modelNotSelectedAfterLeaveTest =
    init.then(db0)
      .then(selectProvider(LmStudio))       // fetch 0
      .then(leaveSettings).then(db0)        // unmount cancels fetch 0; saved with model unset
      .then(done(0))
      .expect(all {
        s.config.model == -1,
        persistedMatchesMemory,
      })

  /** S7: typing the key commits every keystroke, so the model-list request carries a half-typed key. */
  run partialKeySentTest =
    init.then(db0)
      .then(selectProvider(LmStudio))       // fetch 0
      .then(setKey(PARTIAL_KEY))            // first keystrokes of the key -> fetch 1
      .then(setKey(1))                      // the full key -> fetch 2
      .expect(all {
        not(noPartialKeySent),
        keyStaysWithItsEndpoint,
      })
}

/** The behaviour before the model-list effect got its cleanup (CANCEL_STALE = false). */
module settings_no_cancel_test {
  import settings(MAX_FETCHES = 8, FIFO_DB = true, HAS_STORED = false, LEAK_MUTATION = false, CANCEL_STALE = false).* from "./settings"

  action done(id: int): bool = all {
    s.fetches.exists(f => f.id == id),
    nondet f = s.fetches.filter(f => f.id == id).oneOf()
    fetchDone(f),
  }

  action db0 = dbComplete(0)

  /** S1: the late list writes the old provider (and its endpoint) back from the stale closure. */
  run providerSwitchRevertedTest =
    init.then(db0)
      .then(setKey(1))
      .then(selectProvider(LmStudio))
      .then(done(0))
      .expect(all {
        not(fetchOnlyChangesModel),
        s.config.provider == OpenAI,
        s.config.endpoint == 10,
      })

  /** S2: unchecking "save API keys" is undone, and leaving Settings stores the key. */
  run saveKeysOptOutRevertedTest =
    init.then(db0)
      .then(selectProvider(LmStudio))
      .then(setKey(1))
      .then(setSaveKeys(false))
      .then(done(1)).then(done(1))
      .expect(s.config.saveKeys and not(s.userCfg.saveKeys))
      .then(leaveSettings).then(db0)
      .expect(all {
        s.stored.hasKeys,
        s.stored.cfg.apiKeys.get(LmStudio) == 1,
        not(optOutHonoured),
      })

  /** S3: the native request still carries the key after sending was turned off, then turns it back on. */
  run sendKeyOffStillSentTest =
    init.then(db0)
      .then(selectProvider(LmStudio))
      .then(setKey(1))
      .then(setSend(false))
      .then(done(1))
      .expect(not(keySentOnlyAsUserAllows))
      .then(done(1))
      .expect(s.config.send.get(LmStudio) and authKey(s.config) == 1)

  /** S5: the model auto-selected after leaving Settings is only in memory. */
  run modelSelectedAfterLeaveNotSavedTest =
    init.then(db0)
      .then(selectProvider(LmStudio))
      .then(leaveSettings).then(db0)
      .then(done(0)).then(done(0))
      .expect(all {
        s.config.model == 11,
        s.stored.cfg.model == -1,
        not(persistedMatchesMemory),
      })
}

/** Scenarios for a returning user (a config is already stored). */
module settings_returning_test {
  import settings(MAX_FETCHES = 8, FIFO_DB = true, HAS_STORED = true, LEAK_MUTATION = false, CANCEL_STALE = true).* from "./settings"

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
      .expect(s.stored.hasKeys and s.stored.cfg.apiKeys.get(LmStudio) == 1 and not(noKeysStoredAfterOptOut))
      .then(leaveSettings).then(db0)
      .expect(not(s.stored.hasKeys) and optOutHonoured)

  /** S8: leaving Settings before the load resolves saves the default config over the stored one. */
  run leaveBeforeLoadSavesDefaultsTest =
    init
      .then(leaveSettings)                  // saves the not-yet-loaded default config
      .then(db0)                            // the load still applies the stored config in memory
      .then(db0)                            // then the save replaces the stored config
      .expect(all {
        s.config.provider == LmStudio,
        s.stored.cfg.provider == OpenAI,
        not(persistedMatchesMemory),
      })
}
