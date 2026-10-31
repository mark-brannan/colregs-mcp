# Releasing

Cutting a release is automatic. Smithery and the Claude directory are not:
both need an account, so those are the two steps a person does by hand.

## The automatic part

Merging release-please's release PR tags the commit, and
[`publish.yml`](../.github/workflows/publish.yml) does the rest from that tag:
npm, then the official MCP registry.

The manifest is schema-validated _before_ `npm publish`, because everything
after that line is irreversible. Nothing below needs doing until that workflow
is green.

**Verify:** the workflow run is green, and `npm view colregs-mcp version` shows
the new version.

## Smithery

One-time, for the namespace:

```bash
npm install -g smithery
smithery auth login
smithery namespace create <namespace>
```

Namespaces are globally unique and first-come, and the free tier allows three.
The CLI is the unscoped `smithery` package, not `@smithery/cli`; both still
publish a `smithery` binary and only the unscoped one has `mcp publish`.

Then, per release, build the bundle from the release tag (the workflow no
longer attaches one):

```bash
npm ci && npm run build && npm prune --omit=dev
npx @anthropic-ai/mcpb pack . colregs-mcp.mcpb
smithery mcp publish colregs-mcp.mcpb -n <namespace>/colregs-mcp
```

**Verify:** `smithery.ai/server/<namespace>/colregs-mcp` resolves and shows the
version just published, not the previous one.

## Claude directory (plugin bundle)

The directory no longer accepts local servers as `.mcpb` uploads
([#58](https://github.com/mark-brannan/colregs-mcp/issues/58)); a local server
is a plugin bundle the portal reads from this repo's default branch. The
bundle is [`plugin/`](../plugin/). Submit once at
[claude.ai/directory/manage](https://claude.ai/directory/manage) (paid Claude
plan, GitHub connected to the claude.ai organization): repository
`mark-brannan/colregs-mcp`, plugin path `plugin`, branch empty. After that the
GitHub push webhook picks up each merge to `main`.

Per release, raise `version` in `plugin/.claude-plugin/plugin.json` and the
pin in `plugin/.mcp.json` together: an exact version, never `@latest`. Run
`claude plugin validate ./plugin` first.

Reviewers need the privacy policy to resolve: `plugin/README.md` carries a
**Privacy Policy** section, and a README restructure breaks that silently.
Expect a policy hold, "Runs a pinned npx package"; it is read, not rejected.

**Verify:** under Submissions, Versions, the new version passes the scan and
is published; the listing appears as a community plugin.
