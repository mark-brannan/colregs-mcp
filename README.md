# colregs-mcp

> [!WARNING]
> **Not for navigation.** This is a preview (0.0.x) built on pre-release
> rule data. Do not use its output to decide what to do on the water.
> The tool surface will change without notice.

An [MCP](https://modelcontextprotocol.io) server that answers questions
under the COLREGS. Every answer carries its paragraph cites and the verbatim
rule text those cites resolve to, so a language model cannot quietly
simplify it. The rules are evaluated by
[colregs-engine](https://github.com/mark-brannan/colregs-engine); this
package only decides how the answer is written down.

## Try it

**Claude Code:**

```bash
claude mcp add colregs -- npx -y colregs-mcp
```

**Claude connector directory:** in Claude, open Settings → Connectors,
search for `COLREGS` and click Connect. No configuration is needed.

**Any other MCP client:** command `npx`, arguments `-y colregs-mcp`, no
environment.

**From a clone:**

```bash
git clone https://github.com/mark-brannan/colregs-mcp && cd colregs-mcp && npm install && npm run build
```

then command `node`, argument `/absolute/path/to/colregs-mcp/dist/cli.js`.

## Tools

| tool        | input           | returns                                                           |
| ----------- | --------------- | ----------------------------------------------------------------- |
| `evaluate`  | `circumstances` | one evaluation: `appraisal`, `signals`, `indicated`, `compliance` |
| `rule_text` | `cite`          | the verbatim text of a COLREGS paragraph                          |
| `light`     | `id`            | one light's definition: colour, character, arc, placement         |

### evaluate

`circumstances` is the whole picture one vessel is in: `self` (her own
facts), `others` (each other vessel, with what is known or observed of
her) and `conditions` (visibility, environment). One call evaluates the
picture; the response carries four readings of it.

- **`signals`**: every complete, lawful set of lights `self` may show. Each
  light carries its modality (`shall`, `may`, `shall-if-practicable`) and
  the paragraph that prescribes it.
- **`appraisal`**: what the Rules require of `self` on her own, and then
  against each other vessel: the kind of encounter, whether risk of
  collision is asserted, and each vessel's role (stand-on, give-way,
  shall-not-impede).
- **`indicated`**: for each other vessel, what her observed lights, shapes
  and sounds indicate she could be.
- **`compliance`**: over a track of circumstances sampled through time, one
  verdict per vessel per obligation that attached: kept, breached or
  pending.

Every id travels with its paragraph cite, and `cited_paragraphs` holds the
verbatim text of every paragraph the response cites. The input vocabulary
is generated from the `colregs` data package at startup. A key or value
outside it is an error, never an empty answer.

### rule_text

Takes a paragraph path such as `25(b)` or `26(c)(i)`, a bare rule number
such as `25` for every paragraph of that rule, or a range such as
`24(a)(ii)-(iv)`. Returns the International text as transcribed from the
USCG amalgamated Navigation Rules, with its source and retrieval date.

### light

Takes a light id as it appears in a response, such as `light:sidelights`
or `light:all_round`. Returns the Rule 21 definition: colour, character,
arc in degrees and placement.

## Example

A 12 m sloop under way, alone.

```json
{
  "circumstances": {
    "self": {
      "fact:propulsion": "propulsion:sail",
      "fact:activity": "activity:none",
      "fact:position": "position:underway",
      "fact:length_m": 11.6
    }
  }
}
```

Trimmed response:

```json
{
  "colregs": { "version": "0.3.4" },
  "signals": {
    "applied": [
      { "id": "rule:25a", "cite": "25(a)", "modality": "modality:shall" },
      { "id": "rule:25b", "cite": "25(b)", "modality": "modality:may" },
      { "id": "rule:25c", "cite": "25(c)", "modality": "modality:may" }
    ],
    "lawful_displays": {
      "count": 3,
      "relation": "any_one_of",
      "options": [
        {
          "option": 1,
          "of": 3,
          "lights": [
            {
              "light": "light:sidelights",
              "modality": "modality:shall",
              "prescribed_by": { "id": "rule:25a", "cite": "25(a)" }
            },
            {
              "light": "light:sternlight",
              "modality": "modality:shall",
              "prescribed_by": { "id": "rule:25a", "cite": "25(a)" }
            }
          ]
        },
        { "option": 2, "of": 3, "...": "..." },
        { "option": 3, "of": 3, "...": "..." }
      ]
    },
    "modality_key": { "modality:shall": "mandatory", "modality:may": "permitted alternative" },
    "cited_paragraphs": {
      "25(a)": "A sailing vessel underway shall exhibit: (i) sidelights; (ii) a sternlight.",
      "25(b)": "…",
      "25(c)": "…"
    }
  },
  "appraisal": { "self": { "...": "..." }, "others": [] },
  "indicated": []
}
```

The sloop has three lawful displays, because the Rules give her the choice
and nothing in the input settles it.

[docs/demo.md](docs/demo.md) puts the same question to the same model with
and without this server and shows both answers as captured.

## Response shape

Three properties hold for every response:

1. **Cited, verbatim.** Every entry id travels with its paragraph cite, and
   `cited_paragraphs` holds the text of every paragraph cited. The only
   sentences in a response are the Rules' own.
2. **Modality per light.** `shall`, `may` and `shall-if-practicable` are
   kept on each light, not summarised per display. `modality_key` is a
   one-line glossary of the modalities the response uses.
3. **Plural by construction.** `lawful_displays` opens with `count` and
   `relation` before any lights appear, and each option numbers itself
   `n of count`. There is no top-level `lights` field to mistake for the
   answer.

A vessel that lawfully shows nothing gets one empty display, not an error.
An error is reserved for input outside the vocabulary.

Every response carries `colregs.version`. The server refuses to start if its
own copy of `colregs` and the engine's are different releases.

## Dependencies

`colregs-engine` and `colregs` are installed from GitHub `main`, not from
npm releases; the lockfile pins the commit. Both must resolve the same
release.

## Privacy Policy

The server collects nothing. It runs as a local stdio process, answers from
the `colregs` data package installed beside it, and makes no network request
of its own. There is no telemetry, no logging of what it is asked, and no
account. The only network transaction is the install itself, which is npm's.

## Releasing

Automatic from the release tag: npm, the MCP registry, and a `.mcpb` bundle
on the GitHub Release. The remaining by-hand steps are in
[docs/releasing.md](docs/releasing.md).

## Licence

AGPL-3.0-only. The fitness-for-navigation disclaimer in
[colregs](https://github.com/mark-brannan/colregs) carries over.
