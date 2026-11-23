// -*- mode: Bluespec; -*-
/**
 * Chat session concurrency model for local-ai-chat-frontend.
 *
 * Grounds (see README.md for the full correspondence map):
 *   src/components/Chat.tsx   send/stream loop, showSession, loadSession,
 *                             createNewChat, deleteSession, persistSession
 *   src/App.tsx               <Chat> stays mounted (hidden) while Settings is shown
 *                             (KEEP_MOUNTED; before the F2 fix it was unmounted)
 *   src/lib/chatStorage.ts    saveChatSession / loadChatSession /
 *   src/lib/idb.ts            loadAllChatSessions / deleteChatSession (runInStore)
 *
 * One browser tab, one JS thread. Concurrency comes only from async
 * completions interleaving with user events: the fetch/stream of a reply,
 * and IndexedDB requests. Each `await` boundary in the code is an action
 * boundary here; code between two awaits runs atomically.
 *
 * Abstractions: message text, titles, timestamps, provider/request building,
 * HTTP errors (an error reply is just a Reply) are not modelled.
 */
module chat {
  // ---------------------------------------------------------------------------
  // Assumptions (constants)
  // ---------------------------------------------------------------------------

  /** Upper bound on sends (each send consumes one message id). */
  const MAX_SENDS: int
  /** Upper bound on sessions created voluntarily (mount / New Chat). */
  const MAX_SESSIONS: int
  /**
   * IndexedDB completion order. true = FIFO in issue order (per-name open
   * queue + readwrite transaction ordering). false = any pending request may
   * complete next. runInStore opens a new connection per request, so FIFO is
   * an assumption, not something the code enforces.
   */
  const FIFO_DB: bool
  /** Whether the user may switch to Settings and back (unmount / remount <Chat>). */
  const ALLOW_REMOUNT: bool
  /** Mutation knob: false removes the `currentSessionIdRef === sessionId` check in show(). */
  const SHOW_GUARD: bool
  /**
   * true = <Chat> stays mounted and is only hidden while Settings is shown
   * (current code, F2 fix). false = it was unmounted and remounted with fresh
   * state, which reset pendingSessionId (F2, F5).
   */
  const KEEP_MOUNTED: bool
  /**
   * true = deleteSession records the id before deleting, and a reply that
   * finishes for a deleted session is not saved (current code, F1 fix).
   * false = the reply's save wrote the deleted session back (F1).
   */
  const SKIP_DELETED: bool
  /**
   * true = loadSession shows the history this instance last saved for the
   * session when it has one (latestMessagesRef), not the possibly older
   * snapshot read from IndexedDB (current code, F3 fix). false = it showed
   * the snapshot, and the next send overwrote a reply saved meanwhile.
   */
  const FRESH_LOAD: bool
  /**
   * true = deleteSession decides after the delete whether the deleted
   * session is still the one shown (currentSessionIdRef; current code, F4
   * fix). false = it used the session shown at click time and could move
   * away from a chat opened meanwhile.
   */
  const CURRENT_AT_COMPLETION: bool

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  type SessionId = int

  type Kind = User | Partial | Reply

  /** `id` is a ghost identity (the send that produced the message). */
  type Msg = { sid: SessionId, kind: Kind, id: int }

  /** An in-flight sendMessage() call, after `fetch` was issued. */
  type Req = { id: int, sid: SessionId, conv: List[Msg], epoch: int }

  /** A pending IndexedDB request together with the continuation that runs on completion. */
  type DbOp =
    | Save({ sid: SessionId, msgs: List[Msg], epoch: int })
    | Delete({ sid: SessionId, wasCurrent: bool, epoch: int })
    | Load({ sid: SessionId, epoch: int })
    | LoadAll({ epoch: int })

  /**
   * React state of the currently mounted <Chat> instance. `epoch` identifies
   * the instance: continuations of an older instance call setState on an
   * unmounted component, which is a no-op.
   */
  type Ui = {
    mounted: bool,
    shown: bool,              // the chat view is visible (user events possible)
    epoch: int,
    current: SessionId,       // currentSessionId / currentSessionIdRef
    screen: List[Msg],        // messages
    pending: bool,            // pendingSessionId !== null
    sidebar: Set[SessionId],  // chatSessions (ids only)
    deleting: Set[SessionId], // deletedSessionIdsRef: sessions the user deleted in this instance
    latest: SessionId -> List[Msg], // latestMessagesRef: history this instance last saved per session
    movedAway: bool,          // ghost: a delete moved the view away from a session other than the deleted one
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  var ui: Ui
  var db: SessionId -> List[Msg]   // chat-history store; keys = stored sessions
  var queue: List[DbOp]            // issued, not yet completed IDB requests
  var reqs: Set[Req]               // in-flight replies
  var nextId: int                  // message id counter (bounds sends)
  var nextSid: SessionId           // `session-${Date.now()}` abstracted to a counter

  // Ghost state, only read by properties
  var deleted: Set[SessionId]      // sessions whose delete has committed
  var historyLost: bool            // a save replaced stored history that was not its prefix
  var last: str                    // name of the last action (for witnesses)

  // ---------------------------------------------------------------------------
  // Functional layer
  // ---------------------------------------------------------------------------

  pure def isPrefix(a: List[Msg], b: List[Msg]): bool =
    a.length() <= b.length() and a.indices().forall(i => a[i] == b[i])

  pure def removeAt(l: List[DbOp], i: int): List[DbOp] =
    l.slice(0, i).concat(l.slice(i + 1, l.length()))

  pure def mapRemoveKey(m: SessionId -> List[Msg], k: SessionId): SessionId -> List[Msg] =
    m.keys().exclude(Set(k)).mapBy(x => m.get(x))

  /** A continuation of instance `epoch` can still touch React state. */
  pure def alive(u: Ui, epoch: int): bool = u.mounted and u.epoch == epoch

  /** Chat.tsx show(): only touch the screen while this session is viewed. */
  pure def show(u: Ui, epoch: int, sid: SessionId, msgs: List[Msg], guard: bool): Ui =
    if (alive(u, epoch) and (not(guard) or u.current == sid)) { ...u, screen: msgs } else u

  /** Chat.tsx showSession(). */
  pure def showSession(u: Ui, sid: SessionId, msgs: List[Msg]): Ui =
    { ...u, current: sid, screen: msgs }

  pure def canSend(u: Ui, nextId: int, maxSends: int): bool =
    u.shown and not(u.pending) and nextId < maxSends

  // ---------------------------------------------------------------------------
  // State machine
  // ---------------------------------------------------------------------------

  /** App starts with Settings shown, so <Chat> is not mounted; the store is empty. */
  action init = all {
    ui' = { mounted: false, shown: false, epoch: 0, current: -1, screen: [], pending: false, sidebar: Set(), deleting: Set(), latest: Map(), movedAway: false },
    db' = Map(),
    queue' = [],
    reqs' = Set(),
    nextId' = 0,
    nextSid' = 0,
    deleted' = Set(),
    historyLost' = false,
    last' = "init",
  }

  // --- <Chat> lifecycle (App.tsx showSettings toggle) ---

  /** Mount: fresh state, new session id, loadAllChatSessions() issued. */
  action mount = all {
    not(ui.mounted),
    ALLOW_REMOUNT or ui.epoch == 0,
    nextSid < MAX_SESSIONS,
    val e = ui.epoch + 1
    all {
      ui' = { mounted: true, shown: true, epoch: e, current: nextSid, screen: [], pending: false, sidebar: Set(), deleting: Set(), latest: Map(), movedAway: false },
      queue' = queue.append(LoadAll({ epoch: e })),
      nextSid' = nextSid + 1,
      db' = db, reqs' = reqs, nextId' = nextId,
      deleted' = deleted, historyLost' = historyLost,
      last' = "mount",
    },
  }

  /** Show the still-mounted chat again (KEEP_MOUNTED): its state, pending reply included, is kept. */
  action reveal = all {
    KEEP_MOUNTED,
    ui.mounted,
    not(ui.shown),
    ui' = { ...ui, shown: true },
    db' = db, queue' = queue, reqs' = reqs, nextId' = nextId, nextSid' = nextSid,
    deleted' = deleted, historyLost' = historyLost,
    last' = "reveal",
  }

  /** User opens Settings: the chat is hidden (KEEP_MOUNTED) or unmounted. In-flight work keeps running. */
  action unmount = all {
    ui.shown,
    ALLOW_REMOUNT,
    ui' = if (KEEP_MOUNTED) { ...ui, shown: false } else { ...ui, mounted: false, shown: false },
    db' = db, queue' = queue, reqs' = reqs, nextId' = nextId, nextSid' = nextSid,
    deleted' = deleted, historyLost' = historyLost,
    last' = "unmount",
  }

  // --- User events in the chat view ---

  /** sendMessage() up to `await fetch(...)`. */
  action send = all {
    canSend(ui, nextId, MAX_SENDS),
    val sid = ui.current
    val conv = ui.screen.append({ sid: sid, kind: User, id: nextId })
    val skipped = SKIP_DELETED and ui.deleting.contains(sid)
    all {
      ui' = { ...ui, pending: true, screen: conv,
              latest: if (skipped) ui.latest else ui.latest.put(sid, conv) },
      // persistSession skips a session the user deleted (F1 fix)
      queue' = if (skipped) queue
               else queue.append(Save({ sid: sid, msgs: conv, epoch: ui.epoch })),
      reqs' = reqs.union(Set({ id: nextId, sid: sid, conv: conv, epoch: ui.epoch })),
      nextId' = nextId + 1,
      db' = db, nextSid' = nextSid, deleted' = deleted, historyLost' = historyLost,
      last' = "send",
    },
  }

  /** createNewChat(). */
  action newChat = all {
    ui.shown,
    nextSid < MAX_SESSIONS,
    ui' = showSession(ui, nextSid, []),
    nextSid' = nextSid + 1,
    db' = db, queue' = queue, reqs' = reqs, nextId' = nextId,
    deleted' = deleted, historyLost' = historyLost,
    last' = "newChat",
  }

  /** loadSession(): issue loadChatSession(id). */
  action clickLoad(s: SessionId): bool = all {
    ui.shown,
    ui.sidebar.contains(s),
    queue' = queue.append(Load({ sid: s, epoch: ui.epoch })),
    ui' = ui, db' = db, reqs' = reqs, nextId' = nextId, nextSid' = nextSid,
    deleted' = deleted, historyLost' = historyLost,
    last' = "clickLoad",
  }

  /**
   * deleteSession() after the confirm modal: issue deleteChatSession(id).
   * `sessionId === currentSessionId` reads the render closure, i.e. the
   * value at click time, not at completion time.
   */
  action clickDelete(s: SessionId): bool = all {
    ui.shown,
    ui.sidebar.contains(s),
    queue' = queue.append(Delete({ sid: s, wasCurrent: s == ui.current, epoch: ui.epoch })),
    ui' = if (SKIP_DELETED) { ...ui, deleting: ui.deleting.union(Set(s)) } else ui,
    db' = db, reqs' = reqs, nextId' = nextId, nextSid' = nextSid,
    deleted' = deleted, historyLost' = historyLost,
    last' = "clickDelete",
  }

  // --- Reply stream (fetch + readChatResponse) ---

  /** onDelta: show the partial reply if its session is on screen. */
  action delta(r: Req): bool = all {
    reqs.contains(r),
    ui' = show(ui, r.epoch, r.sid, r.conv.append({ sid: r.sid, kind: Partial, id: r.id }), SHOW_GUARD),
    db' = db, queue' = queue, reqs' = reqs, nextId' = nextId, nextSid' = nextSid,
    deleted' = deleted, historyLost' = historyLost,
    last' = "delta",
  }

  /** The instance that sent `r` has seen its session deleted (its ref is only readable while it lives). */
  pure def deletedInSender(u: Ui, r: Req, skipDeleted: bool): bool =
    skipDeleted and alive(u, r.epoch) and u.deleting.contains(r.sid)

  /**
   * Reply finished (success or error): show, setPendingSessionId(null), and
   * persistSession unless the session was deleted meanwhile.
   */
  action finish(r: Req): bool = all {
    reqs.contains(r),
    val finished = r.conv.append({ sid: r.sid, kind: Reply, id: r.id })
    val shown = show(ui, r.epoch, r.sid, finished, SHOW_GUARD)
    val saved = not(deletedInSender(ui, r, SKIP_DELETED))
    all {
      ui' = if (not(alive(ui, r.epoch))) shown
            else { ...shown, pending: false,
                   latest: if (saved) shown.latest.put(r.sid, finished) else shown.latest },
      queue' = if (not(saved)) queue
               else queue.append(Save({ sid: r.sid, msgs: finished, epoch: r.epoch })),
      reqs' = reqs.exclude(Set(r)),
      db' = db, nextId' = nextId, nextSid' = nextSid,
      deleted' = deleted, historyLost' = historyLost,
      last' = if (ui.current != r.sid or not(alive(ui, r.epoch))) "finishOffscreen" else "finish",
    },
  }

  // --- IndexedDB completions (request executes + its continuation runs) ---

  action dbComplete(i: int): bool = all {
    i >= 0, i < queue.length(),
    FIFO_DB implies i == 0,
    val rest = removeAt(queue, i)
    match queue[i] {
      | Save(p) => all {
          // saveChatSession: get + put in one transaction; then setChatSessions
          historyLost' = (historyLost or (db.keys().contains(p.sid) and not(isPrefix(db.get(p.sid), p.msgs)))),
          db' = db.put(p.sid, p.msgs),
          ui' = if (alive(ui, p.epoch)) { ...ui, sidebar: ui.sidebar.union(Set(p.sid)) } else ui,
          queue' = rest, reqs' = reqs, nextId' = nextId, nextSid' = nextSid,
          deleted' = deleted,
          last' = if (deleted.contains(p.sid)) "saveResurrects" else "saveDone",
        }
      | Delete(p) => all {
          db' = mapRemoveKey(db, p.sid),
          deleted' = deleted.union(Set(p.sid)),
          // if (sessionId === current) createNewChat(); then filter chatSessions.
          // `current` is the click-time closure value, or the ref at completion with CURRENT_AT_COMPLETION.
          val moves = alive(ui, p.epoch) and (if (CURRENT_AT_COMPLETION) ui.current == p.sid else p.wasCurrent)
          val listed = { ...ui, sidebar: ui.sidebar.exclude(Set(p.sid)) }
          all {
            ui' = if (not(alive(ui, p.epoch))) ui
                  else if (moves) { ...showSession(listed, nextSid, []), movedAway: ui.movedAway or ui.current != p.sid }
                  else listed,
            nextSid' = if (moves) nextSid + 1 else nextSid,
            queue' = rest, reqs' = reqs, nextId' = nextId, historyLost' = historyLost,
            last' = if (moves and ui.current != p.sid) "deleteLeavesOtherView" else "deleteDone",
          }
        }
      | Load(p) => all {
          // loadChatSession resolves with the snapshot at execution time; null -> no-op.
          // With FRESH_LOAD the instance's own latest save wins over that snapshot.
          ui' = if (not(alive(ui, p.epoch) and db.keys().contains(p.sid))) ui
                else if (FRESH_LOAD and ui.latest.keys().contains(p.sid)) showSession(ui, p.sid, ui.latest.get(p.sid))
                else showSession(ui, p.sid, db.get(p.sid)),
          db' = db, queue' = rest, reqs' = reqs, nextId' = nextId, nextSid' = nextSid,
          deleted' = deleted, historyLost' = historyLost,
          last' = if (reqs.exists(r => r.sid == p.sid)) "loadPendingSession" else "loadDone",
        }
      | LoadAll(p) => all {
          ui' = if (alive(ui, p.epoch)) { ...ui, sidebar: db.keys() } else ui,
          db' = db, queue' = rest, reqs' = reqs, nextId' = nextId, nextSid' = nextSid,
          deleted' = deleted, historyLost' = historyLost,
          last' = "loadAllDone",
        }
    }
  }

  action step = any {
    mount,
    reveal,
    unmount,
    send,
    newChat,
    nondet s = 0.to(MAX_SESSIONS + MAX_SENDS).oneOf()
    any { clickLoad(s), clickDelete(s) },
    all { reqs != Set(), nondet r = reqs.oneOf() any { delta(r), finish(r) } },
    all { queue.length() > 0, nondet i = queue.indices().oneOf() dbComplete(i) },
  }

  // ---------------------------------------------------------------------------
  // Witnesses (positive reachability targets; pass to --witnesses)
  // ---------------------------------------------------------------------------

  val wMount = last == "mount" and ui.epoch == 1
  val wRemount = last == "mount" and ui.epoch >= 2   // only without KEEP_MOUNTED
  val wReveal = last == "reveal"
  val wUnmount = last == "unmount"
  val wSend = last == "send"
  val wNewChat = last == "newChat"
  val wClickLoad = last == "clickLoad"
  val wClickDelete = last == "clickDelete"
  val wDeltaShown = last == "delta" and ui.screen.length() > 0 and ui.screen[ui.screen.length() - 1].kind == Partial
  val wFinish = last == "finish"
  val wFinishOffscreen = last == "finishOffscreen"
  val wSaveDone = last == "saveDone"
  val wDeleteDone = last == "deleteDone"
  val wLoadDone = last == "loadDone"
  val wLoadPendingSession = last == "loadPendingSession"
  val wLoadAllDone = last == "loadAllDone"
  val wSaveResurrects = last == "saveResurrects"   // only without SKIP_DELETED (F1) or FIFO_DB
  val wDeleteLeavesOtherView = last == "deleteLeavesOtherView"
  val wTwoInFlight = reqs.size() >= 2   // only without KEEP_MOUNTED (F2)

  // ---------------------------------------------------------------------------
  // Invariants
  // ---------------------------------------------------------------------------

  /** The screen only shows messages of the session it is showing (show() guard). */
  val noCrossTalk: bool = ui.screen.indices().forall(i => ui.screen[i].sid == ui.current)

  /** Stored history never mixes sessions and never contains a partial reply. */
  val dbWellFormed: bool =
    db.keys().forall(s => val l = db.get(s) l.indices().forall(i => l[i].sid == s and l[i].kind != Partial))

  /** At most one reply is generated at a time (design intent of pendingSessionId). */
  val singleInFlight: bool = reqs.size() <= 1

  /** A deleted session never comes back to the store. */
  val noResurrection: bool = deleted.forall(s => not(db.keys().contains(s)))

  /** Each save extends the stored history; no stored message is ever dropped. */
  val historyOnlyExtends: bool = not(historyLost)

  /** When nothing is in flight, the sidebar lists exactly the stored sessions. */
  val sidebarMatchesDb: bool =
    (ui.mounted and queue.length() == 0 and reqs == Set()) implies ui.sidebar == db.keys()

  /** A delete only moves the view away when the deleted session is the one shown (F4). */
  val deleteKeepsOtherView: bool = not(ui.movedAway)

  /** Expected to hold. */
  val holds: bool =
    noCrossTalk and dbWellFormed and singleInFlight and sidebarMatchesDb and noResurrection and historyOnlyExtends
    and deleteKeepsOtherView
}

// -----------------------------------------------------------------------------
// Instances (run these, not `chat`)
// -----------------------------------------------------------------------------

/** Main configuration: FIFO IndexedDB, Settings toggle allowed. */
module chat_fifo {
  import chat(MAX_SENDS = 3, MAX_SESSIONS = 3, FIFO_DB = true, ALLOW_REMOUNT = true, SHOW_GUARD = true, KEEP_MOUNTED = true, SKIP_DELETED = true, FRESH_LOAD = true, CURRENT_AT_COMPLETION = true).*
}

/** FIFO IndexedDB, user never leaves the chat view (isolates single-mount races). */
module chat_fifo_nomount {
  import chat(MAX_SENDS = 3, MAX_SESSIONS = 3, FIFO_DB = true, ALLOW_REMOUNT = false, SHOW_GUARD = true, KEEP_MOUNTED = true, SKIP_DELETED = true, FRESH_LOAD = true, CURRENT_AT_COMPLETION = true).*
}

/** IndexedDB completions in any order (weaker assumption). */
module chat_unordered {
  import chat(MAX_SENDS = 3, MAX_SESSIONS = 3, FIFO_DB = false, ALLOW_REMOUNT = true, SHOW_GUARD = true, KEEP_MOUNTED = true, SKIP_DELETED = true, FRESH_LOAD = true, CURRENT_AT_COMPLETION = true).*
}

/** Mutation: show() without the session check; noCrossTalk must fail here. */
module chat_noguard {
  import chat(MAX_SENDS = 3, MAX_SESSIONS = 3, FIFO_DB = true, ALLOW_REMOUNT = false, SHOW_GUARD = false, KEEP_MOUNTED = true, SKIP_DELETED = true, FRESH_LOAD = true, CURRENT_AT_COMPLETION = true).*
}

/** The code before the F1 fix: a reply finishing for a deleted session saved it again. */
module chat_resurrect {
  import chat(MAX_SENDS = 3, MAX_SESSIONS = 3, FIFO_DB = true, ALLOW_REMOUNT = true, SHOW_GUARD = true, KEEP_MOUNTED = true, SKIP_DELETED = false, FRESH_LOAD = true, CURRENT_AT_COMPLETION = true).*
}

/** The code before the F2 (and F1) fix: Settings unmounted <Chat>, so a remount reset its state. */
module chat_remount {
  import chat(MAX_SENDS = 3, MAX_SESSIONS = 3, FIFO_DB = true, ALLOW_REMOUNT = true, SHOW_GUARD = true, KEEP_MOUNTED = false, SKIP_DELETED = false, FRESH_LOAD = true, CURRENT_AT_COMPLETION = true).*
}

/** The code before the F3 fix: loadSession showed the IndexedDB snapshot even if a newer save had landed. */
module chat_stale_load {
  import chat(MAX_SENDS = 3, MAX_SESSIONS = 3, FIFO_DB = true, ALLOW_REMOUNT = true, SHOW_GUARD = true, KEEP_MOUNTED = true, SKIP_DELETED = true, FRESH_LOAD = false, CURRENT_AT_COMPLETION = true).*
}

/** The code before the F4 fix: deleteSession compared against the session shown at click time. */
module chat_click_time_current {
  import chat(MAX_SENDS = 3, MAX_SESSIONS = 3, FIFO_DB = true, ALLOW_REMOUNT = true, SHOW_GUARD = true, KEEP_MOUNTED = true, SKIP_DELETED = true, FRESH_LOAD = true, CURRENT_AT_COMPLETION = false).*
}
