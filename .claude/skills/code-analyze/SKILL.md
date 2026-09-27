---
name: code-analyze
description: Analyze a repository and create or refresh structured reference docs under z-ai/code/ (dependencies, infrastructure, databases, screens, security, tests, overview, etc.). Use when asked to analyze, document, or update documentation of a codebase.
context: fork
agent: general-purpose
background: true
---

## 1. Traceability & Integrity

- **Commit Hash**: Append the current commit hash as the final line of every modified/created file.
- **Source of Truth**: Always prioritize test code (unit/integration) over implementation when detecting discrepancies.
- **Verification**: If a discrepancy is found between layers (e.g., DB vs. API), document it as a "Known Bug" or "Inconsistency".

## 2. Documentation Hygiene

- **Pruning**: Completely delete any entries, notes, or TODOs related to files, components, or features that no longer exist in the codebase.
- **Structure**: Maintain a clean directory structure under `z-ai/code/{CATEGORY_NAME}.md`. Organize your knowledge using Markdown files and a directory structure, and create `z-ai/code/index.md` containing a Mermaid mindmap that links each category file.
- **Front matter**: Every generated `.md` file must include the standard front matter:  

    ```md
    ---
    name: analyzed-{basename}
    description: {State the purpose in one sentence.}
    metadata:
        type: analysis
        commit-hash: {target commit hash}
    ---
    ```

## 3. Quality of Information

- **Uncertainty Labels**: Clearly state if information is "Unconfirmed", "Speculative", or "Unknown".
- **Speculation Protocol**: When making suggestions/speculations, provide concise options and a recommendation level (1-5) for each.
- **Clarity**: Use Mermaid notation for all diagrams (ER, Flow, Use Case).
- **Simplicity**: When documenting configuration files, summarize or link them instead of copying their contents. Never edit the analyzed project's files.

## Target files

**Execution Rules**:

- Create or update files in the step order below. On a refresh, compare each file's `metadata.commit-hash` with HEAD (`git diff --name-only <hash>..HEAD`); skip categories whose inputs did not change and only bump their commit-hash. Re-run `overview`, `todo`, and `notes` if any other category changed.
- After each step is completed, record its progress (step, commit hash, date) in `z-ai/code/index.md`.
- For large repositories (roughly 300+ source files, excluding vendored and generated code), run steps 1–12 and 16–17 as parallel subagents, one category each, then write `overview`, `notes`, and `todo` yourself from their outputs. Tell each subagent to also read files outside its category when they affect it (e.g. CI workflows for `test`). Otherwise, run all steps sequentially yourself.

| Step No. | Category Name | Target topics |
| --- | --- | --- |
| 1 | dependencies | Library name, version, license, vulnerability, update status. |
| 2 | infrastructures | CD/CI and IaC. |
| 3 | databases | Connection settings (driver, host, env var names; never secret values), Architecture, Migration, List of tables by category and their summaries, Summary of domain areas. |
| 4 | screens | Entry Point, Default Route, URL Pattern, Controller inheritance hierarchy, Base class, View File Convention, Basic template files. |
| 5 | configurations |Main configuration files, Environment-specific settings. |
| 6 | components | Application Structure, Custom Vendor Namespace. |
| 7 | utilities | Global helper Classes, functions, Traits. |
| 8 | performance | Likely bottlenecks, heavy processing paths, and concurrency settings identified from the code (label runtime figures as "Unconfirmed" unless measured). |
| 9 | known_bugs | Architectural/design issues, Compatibility issues, Notes on analytical limitations. (Security issues go in `security`.) |
| 10 | security | **[Required]**: Injection (SQL/XSS/Command/Path traversal), Secret & Credential leakage (hardcoded keys, .env commits), Authentication & Authorization (unprotected endpoints, bypass), **[Recommended]**: CORS / Security Headers (CSP, HSTS, X-Frame-Options), Data Exposure (sensitive fields in API responses, stack traces in errors), Dependency Vulnerabilities (known CVEs in lockfile), **[Optional]**: Rate Limiting / Brute-force protection,  File Upload validation (MIME type, path restriction), Transport Security (TLS version, cipher suites). |
| 11 | test | Test frameworks, directory layout, what each suite verifies, coverage gaps. |
| 12 | development-workflow | Development Workflow. |
| 13 | overview | Project Overview, Technology stack, Repository structure, Request Flow, Domain configuration, scale, Number of steps (approximate number of lines), Main features. (Link to `development-workflow` for the workflow.) |
| 14 | notes | Analysis findings that fit no other category. |
| 15 | todo | Security (high priority), Test, Database, Code Quality, Infrastructure, Developer Experience, Performance. |
| 16 | naming_convention | Variable, Table name, Column name, Function name, Class name. |
| 17 | use_cases | Use case diagram (using gherkin notation). |
