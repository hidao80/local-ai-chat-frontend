// Check every invariant of the Quint models with IndexedDB completions in any
// order (FIFO_DB = false): the browser does not have to complete them in
// issue order, so the code serializes them (runInStore, SERIALIZED_DB).
// Checks each invariant of both models separately, prints one verdict per
// invariant (with the seed of a violating run) and exits 1 if any was violated.
//
//   bun run quint:run:unordered

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const quintPackage = require.resolve("@informalsystems/quint/package.json");
const quintCli = join(
  dirname(quintPackage),
  require(quintPackage).bin.quint,
);

const CHECKS = [
  {
    spec: "specs/quint/chat.qnt",
    main: "chat_unordered",
    invariants: [
      "noCrossTalk",
      "dbWellFormed",
      "singleInFlight",
      "sidebarMatchesDb",
      "noResurrection",
      "historyOnlyExtends",
      "deleteKeepsOtherView",
    ],
  },
  {
    spec: "specs/quint/settings.qnt",
    main: "settings_unordered",
    invariants: [
      "persistedRespectsOwnFlag",
      "keyStaysWithItsEndpoint",
      "fetchOnlyChangesModel",
      "keySentOnlyAsUserAllows",
      "optOutHonoured",
      "loadKeepsUserEdits",
      "persistedMatchesMemory",
      "noKeysStoredAfterOptOut",
      "noPartialKeySent",
      "storedKeptUntilLoaded",
    ],
  },
];

let failed = false;
for (const { spec, main, invariants } of CHECKS) {
  console.log(`\n== ${main} (${spec})`);
  // One run per invariant, so each one gets its own verdict
  for (const invariant of invariants) {
    // Run the CLI with this Node binary directly, never through a shell
    const result = spawnSync(
      process.execPath,
      [
        quintCli,
        "run",
        spec,
        `--main=${main}`,
        "--max-steps=25",
        "--max-samples=20000",
        "--verbosity=1",
        `--invariant=${invariant}`,
      ],
      { encoding: "utf8" },
    );
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (result.status === 0) {
      console.log(`ok        ${invariant}`);
      continue;
    }
    failed = true;
    if (output.includes("[violation]")) {
      // The seed replays the violating trace with `quint run --seed=...`
      const seed = output.match(/--seed=\S+/)?.[0] ?? "";
      console.log(`VIOLATED  ${invariant} ${seed}`);
    } else {
      console.log(`ERROR     ${invariant}\n${output}`);
    }
  }
}
process.exit(failed ? 1 : 0);
