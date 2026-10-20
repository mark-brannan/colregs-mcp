# COLREGS

> **Not for navigation.** This is a preview (0.0.x) built on pre-release
> rule data. Do not use its output to decide what to do on the water.
> The tool surface will change without notice.

This plugin gives Claude a local MCP server that answers questions under the
International Regulations for Preventing Collisions at Sea (COLREGS). Every
answer carries its paragraph cites and the verbatim rule text those cites
resolve to, so a language model cannot quietly simplify it.

## What it runs

Claude starts one local process, `colregs-mcp`, over stdio. The package is
fetched once from the public npm registry, at the exact version pinned in
`.mcp.json`, the first time the plugin starts. Source is at
https://github.com/mark-brannan/colregs-mcp.

It exposes three read-only tools: `evaluate` (one evaluation of the
circumstances a vessel is in: her lawful lights, what Part B requires of her,
and what the other vessels' signals indicate), `rule_text` (the verbatim text
of a COLREGS paragraph) and `light` (the definition of one light).

## Privacy Policy

The server collects nothing. It runs as a local process, answers from rule data
installed beside it, and makes no network request of its own. There is no
telemetry, no logging of what it is asked, no account and no stored data. The
only network transaction is the one-time package download from npm. Questions
about this policy: https://github.com/mark-brannan/colregs-mcp/issues

## Licence

Apache-2.0.
