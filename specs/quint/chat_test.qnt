// -*- mode: Bluespec; -*-
/**
 * Deterministic scenarios for chat.qnt. Each `run` reproduces one behaviour
 * (happy path, or one finding from README.md) step by step.
 *
 *   bun run quint:test
 */
module chat_test {
  import chat(MAX_SENDS = 3, MAX_SESSIONS = 4, FIFO_DB = true, ALLOW_REMOUNT = true, SHOW_GUARD = true).* from "./chat"

  /** Finish the in-flight reply whose ghost id is `id`. */
  action finishId(id: int): bool = all {
    reqs.exists(r => r.id == id),
    nondet r = reqs.filter(r => r.id == id).oneOf()
    finish(r),
  }

  /** Complete the oldest pending IndexedDB request (FIFO). */
  action db0 = dbComplete(0)

  pure val U0 = { sid: 0, kind: User, id: 0 }
  pure val R0 = { sid: 0, kind: Reply, id: 0 }

  /** Happy path: send, reply, both saves complete; store and sidebar agree. */
  run happyPathTest =
    init.then(mount).then(db0)          // LoadAll
      .then(send).then(db0)             // Save [U0]
      .then(finishId(0)).then(db0)      // Save [U0, R0]
      .expect(all {
        db.get(0) == [U0, R0],
        ui.screen == [U0, R0],
        not(ui.pending),
        sidebarMatchesDb,
        historyOnlyExtends,
      })

  /** F1: deleting a session while its reply is generated brings it back. */
  run deleteDuringReplyResurrectsTest =
    init.then(mount).then(db0)
      .then(send).then(db0)             // session 0 = [U0], listed in sidebar
      .then(clickDelete(0)).then(db0)   // delete commits; view moves to new session 1
      .expect(not(db.keys().contains(0)) and not(ui.sidebar.contains(0)))
      .then(finishId(0)).then(db0)      // the reply is still saved to session 0
      .expect(all {
        not(noResurrection),
        db.get(0) == [U0, R0],
        ui.sidebar.contains(0),
      })

  /**
   * F2: Settings -> Chat during generation resets pendingSessionId, so a second
   * request can start in the same session and the two saves overwrite each other.
   */
  run remountOverwritesHistoryTest =
    init.then(mount).then(db0)
      .then(send).then(db0)             // session 0 = [U0], reply 0 in flight
      .then(unmount).then(mount)        // epoch 2, pending reset, new session 1
      .then(db0)                        // LoadAll: sidebar = {0}
      .then(clickLoad(0)).then(db0)     // shows [U0]
      .then(send)                       // U1 sent in session 0 while reply 0 runs
      .expect(not(singleInFlight))
      .then(db0)                        // Save [U0, U1]
      .then(finishId(0)).then(db0)      // Save [U0, R0] drops U1
      .expect(all {
        not(historyOnlyExtends),
        db.get(0) == [U0, R0],
      })

  /**
   * F3: a reply finishing while loadSession() is in flight is overwritten by
   * the next send, without leaving the chat view.
   */
  run loadRaceLosesReplyTest =
    init.then(mount).then(db0)
      .then(send)                       // session 0, reply 0 in flight
      .then(newChat)                    // view session 1
      .then(db0)                        // Save [U0]
      .then(clickLoad(0))               // Load(0) queued
      .then(finishId(0))                // offscreen: Save [U0, R0] queued behind Load
      .then(db0)                        // Load returns the stale [U0]; pending is false
      .expect(ui.current == 0 and ui.screen == [U0] and not(ui.pending))
      .then(send)                       // Save [U0, U1] queued
      .then(db0)                        // Save [U0, R0]
      .then(db0)                        // Save [U0, U1] drops R0
      .expect(all {
        not(historyOnlyExtends),
        db.get(0) == [U0, { sid: 0, kind: User, id: 1 }],
      })

  /**
   * F4: deleteSession() compares against the session shown at click time.
   * The user deletes the current session, starts a new chat and sends before
   * the delete commits; the delete then moves the view to yet another session.
   */
  run deleteMovesAwayFromNewChatTest =
    init.then(mount).then(db0)
      .then(send).then(db0).then(finishId(0)).then(db0)
      .then(clickDelete(0))             // wasCurrent = true
      .then(newChat)                    // session 1 (mount used 0); the delete has not committed yet
      .then(send)                       // U1 in session 1
      .then(db0)                        // Delete commits -> createNewChat()
      .expect(all {
        ui.current != 1,
        ui.screen == [],
        reqs.exists(r => r.sid == 1),
      })

  /** F5: after remount, a resurrected session is missing from the sidebar. */
  run remountStaleSidebarTest =
    init.then(mount).then(db0)
      .then(send).then(db0)
      .then(unmount).then(mount).then(db0)
      .then(clickDelete(0)).then(db0)
      .then(finishId(0)).then(db0)
      .expect(all {
        db.keys().contains(0),
        not(ui.sidebar.contains(0)),
        not(sidebarMatchesDb),
      })
}
