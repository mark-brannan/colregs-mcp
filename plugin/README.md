# COLREGS

> **Not for navigation.** This is a preview (0.0.x) built on pre-release rule
> data. Do not use its output to decide what to do on the water. Coverage is
> partial and the tool surface will change.

This plugin gives Claude a local MCP server that answers questions under the
International Regulations for Preventing Collisions at Sea (COLREGS). Every
answer lists all the lawful options rather than one, and each entry carries its
paragraph cite and the verbatim rule text, so the model cannot quietly
simplify it. Coverage today is Part C (lights and shapes), night, international
text only.

## What it runs

Claude starts one local process, `colregs-mcp`, over stdio. The package is
fetched once from the public npm registry at an exact pinned version
(`colregs-mcp@0.0.4`) the first time the plugin starts. Source is at
https://github.com/mark-brannan/colregs-mcp.

It exposes eight read-only tools: `evaluate_display`, `applied_entries`,
`applied_encounter_entries`, `applied_conduct_entries`,
`evaluate_circumstances`, `evaluate_compliance`, `rule_text` (verbatim text of
a COLREGS paragraph) and `light` (the definition of one light). The set will
change as the preview develops.

## Privacy Policy

The server collects nothing. It runs as a local process, answers from rule data
installed beside it, and makes no network request of its own. There is no
telemetry, no logging of what it is asked, no account and no stored data. The
only network transaction is the one-time package download from npm. Questions
about this policy: https://github.com/mark-brannan/colregs-mcp/issues

## Licence

Apache-2.0.
