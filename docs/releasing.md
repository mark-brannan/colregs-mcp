# Releasing

Cutting a release is automatic. Getting the bundle in front of Smithery and
the Claude connector directory is not: both need an account, so those are the
two steps a person does by hand.

## The automatic part

Merging release-please's release PR tags the commit, and
[`publish.yml`](../.github/workflows/publish.yml) does the rest from that tag:
npm, the official MCP registry, then `mcpb pack`, with the `.mcpb` attached to
the GitHub Release as `colregs-mcp.mcpb`.

The manifest is schema-validated *before* `npm publish`, because everything
after that line is irreversible. Nothing below needs doing until that workflow
is green.

**Verify:** the Release page for the new tag lists `colregs-mcp.mcpb` as an
asset, and

```bash
gh release download vX.Y.Z --pattern colregs-mcp.mcpb --dir /tmp/rel
```

downloads it. That downloaded file is what both steps below upload — don't
build a local one, or the thing reviewed is not the thing released.

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

Then, per release:

```bash
smithery mcp publish /tmp/rel/colregs-mcp.mcpb -n <namespace>/colregs-mcp
```

**Verify:** `smithery.ai/server/<namespace>/colregs-mcp` resolves and shows the
version just published, not the previous one.

## Claude connector directory

A web form at
[claude.com/docs/connectors/building/submission](https://claude.com/docs/connectors/building/submission),
separate from the remote-connector portal; no organisation account is needed
for the `.mcpb` path. Upload the downloaded `colregs-mcp.mcpb`.

Two things reviewers reject outright, both already satisfied — check they
still are rather than assuming:

- **`privacy_policies` must resolve.** `manifest.json` points at the README's
  [Privacy Policy](../README.md#privacy-policy) anchor. A missing or
  incomplete policy is an immediate rejection, and an anchor is exactly the
  kind of link a README restructure breaks silently.
- **Every tool carries `readOnlyHint`.** All four do; a new tool added without
  one would fail the annotation gate at the next submission, not at the commit
  that added it.

Neither platform documents a minimum version or maturity bar — that was
checked against both submission and review-criteria pages, not assumed, and
recorded in [#18](https://github.com/mark-brannan/colregs-mcp/issues/18).
The 0.0.x version and the not-for-navigation warning are carried into the
bundle description verbatim, so a reviewer sees them without having to look.

**Verify:** submission acknowledged, and the listing appears as a community
connector. Nothing in the repo changes for this step, so the confirmation
email is the only record — there is no local state to check.
