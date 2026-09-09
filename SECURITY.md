# Security Policy

## Supported versions

This is a preview, not yet published to npm, and maintained as a single
moving line: only `main` gets fixes, and the tool surface will change
without notice.

| Version | Supported |
| ------- | --------- |
| `main` | yes |
| a pinned commit | no — update to `main` first |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** Report it
privately through GitHub:

1. Go to
   [Security → Report a vulnerability](https://github.com/mark-brannan/colregs-mcp/security/advisories/new).
2. Describe what you found, ideally as the tool call and input that
   triggers it.

You should get an acknowledgement within a week. This is a spare-time project
maintained by one person, so a fix may take longer than that — you will be told
where it stands rather than left waiting. If a report is valid and you want
credit, you will be named in the advisory.

If you get no response at all within two weeks, open a public issue saying only
that you are waiting on a private report — no details — and it will be picked
up.

## What is in scope

This server speaks MCP over stdio to a client you launch yourself
(`node dist/cli.js`) — it opens no network port and accepts no remote
connections. The trust boundary is the tool call itself, since the caller is
usually a language model rather than a human typing carefully.

- **Tool input handling** (`evaluate_display`, `applied_entries`, `rule_text`,
  `light`). An input outside the generated schema's vocabulary must error,
  never return an empty or misleading answer, and must not crash the process
  or hang it.
- **The response shape.** A tool result that drops a citation, a modality, or
  otherwise lets an answer be read as more certain or more complete than the
  underlying rule set supports — the [response shape](README.md#response-shape)
  section describes what every answer must carry.
- **The CLI's argument and environment handling.**
- **The published package**, once it ships to npm — anything in `files` that
  should not be there, or a discrepancy between npm and this repository at
  the corresponding tag.

## What is out of scope

- **The underlying evaluation.** A wrong lawful display for a well-formed
  fact record belongs to
  [colregs-engine](https://github.com/mark-brannan/colregs-engine/security);
  a wrong rule text or citation belongs to
  [colregs](https://github.com/mark-brannan/colregs/security).
- **What the calling model does with a correct answer.** This server has no
  control over how a client presents or acts on its output.
- **Navigational use.** This is a preview and must not be used, directly or
  through an assistant, to make collision-avoidance decisions at sea.

## Notes on how this package is built

- **Stdio only, no server socket.** There is nothing here for a network
  attacker to reach; the entire surface is the tool calls a local client
  makes.
- Depends on `colregs` and `colregs-engine` for all rule content and
  evaluation, and `@modelcontextprotocol/sdk` for the protocol itself — no
  other runtime dependency touches tool input.
- `npm test` runs against fixtures with the network unavailable.
