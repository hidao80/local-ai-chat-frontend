---
name: update-adr
description: Create or update Architecture Decision Record documentation from Git logs. Use when asked to record, document, or refresh architectural decisions of a repository.
agent: general-purpose
background: false
---

# Details

Create or update an Architecture Decision Record document at `z-ai/code/ADR.md` from the git log (and `z-ai/decision.jsonl` if present).

- Record only architecturally significant decisions (new dependencies, structural refactors, data model or interface changes), not every commit.
- Each entry: title, status (Accepted / Superseded by ...), date, context, decision, consequences, and the source commit hash(es).
- When the file exists, read it first and append decisions made after the newest recorded commit. Keep existing entries; mark replaced ones as Superseded instead of deleting them.
- Git logs rarely state the reason for a decision: label any inferred context or rationale as "Speculative".
