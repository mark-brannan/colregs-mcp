# Releasing

Cutting a release is automatic. Smithery and the Claude directory are not:
both need an account, so those are the two steps a person does by hand.

## The automatic part

Merging release-please's release PR tags the commit, and
[`publish.yml`](../.github/workflows/publish.yml) does the rest from that tag:
npm, then the official MCP registry.

Nothing below needs doing until that workflow is green.

**Verify:** the workflow run is green, `npm view colregs-mcp version` shows the
new version, and
`curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=io.github.mark-brannan/colregs-mcp'`
lists it at that version.

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

Then, per release, build the bundle from the release tag. `npm prune` leaves the tree pruned, so run this from a clean
checkout you can discard:

```bash
git checkout vX.Y.Z
npm ci && npm run build && npm prune --omit=dev
npx @anthropic-ai/mcpb pack . colregs-mcp.mcpb
smithery mcp publish colregs-mcp.mcpb -n <namespace>/colregs-mcp
```

**Verify:** `smithery.ai/server/<namespace>/colregs-mcp` resolves and shows the
version just published, not the previous one.

## Claude directory (plugin bundle)

The directory takes a local server as a plugin bundle the portal reads from this
repo's default branch ([#58](https://github.com/mark-brannan/colregs-mcp/issues/58)). The
bundle is [`plugin/`](../plugin/). Submit once at
[claude.ai/directory/manage](https://claude.ai/directory/manage) (paid Claude
plan, GitHub connected to the claude.ai organization): repository
`mark-brannan/colregs-mcp`, plugin path `plugin`, branch empty. After that the
GitHub push webhook picks up each merge to `main`.

Per release, the `version` in `plugin/.claude-plugin/plugin.json` and the pin
in `plugin/.mcp.json` are bumped by the release PR itself (release-please
config and `release-sync.yml`); check that it shows both, an exact version and
never `@latest`. Run `claude plugin validate ./plugin` before merging it.

The portal reads `main` the moment the release PR merges, before `publish.yml`
has put the new version on npm, so the new version's first scan can fail with a
404 on the pinned `npx` package. Once `publish.yml` is green, re-run it under
Submissions, Versions.

Reviewers need the privacy policy to resolve: `plugin/README.md` carries a
**Privacy Policy** section, and a README restructure breaks that silently.
Expect a policy hold, "Runs a pinned npx package"; it is read, not rejected.

**Verify:** under Submissions, Versions, the new version passes the scan and
is published; the listing appears as a community plugin.
