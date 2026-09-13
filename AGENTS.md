# AGENTS.md

Guidance for AI coding agents working in this repository.

## Stage: pre-consumer

Published at 0.0.x. Nobody has this server configured. Not "few" — an MCP client
that has never been installed has no users, and the registry entry is a listing,
not an install base. Until Solace says otherwise that is a fact, not an estimate,
and not an agent's to re-evaluate. The family stanza in colregs `AGENTS.md` is the
long form; this is what it means here.

**Breaking changes need no ceremony.** Rename a tool, change its input schema,
reshape what it returns, restructure `server.json` or the bundle manifest — no
deprecation window, no aliased tool name kept alive, no compatibility branch, no
paragraph weighing whose client config might break. Nobody's config breaks.
`git revert` is the migration path.

**Stub as the safe default.** A tool named in a design doc gets registered the
same day, even if it throws or returns an inconclusive status. Withholding a tool
because its behaviour isn't settled is the failure mode, not the caution.

**Where the rigour goes instead.** What the tools *say* — the advisory envelope,
its statuses and its provenance — because a wrong answer about lights at sea is
the only failure here that matters. That rigour is about correctness, never about
hedging: no disclaimers, no liability language, no "may change" in a tool result.
Those live in the README and the licence, and the decision to add one is Solace's.

**When this changes:** Solace says so. Registry presence, a version number and a
release workflow are not evidence of consumers, and an agent that treats them as
such is reasoning about nobody.
