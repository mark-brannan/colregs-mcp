# colregs-mcp

> [!WARNING]
> **Not for navigation.** This is a preview (0.0.x) built on pre-release
> rule data. It covers COLREGS Part C lights only, international text only,
> at night only. Do not use its output to decide what to show or what you
> are looking at on the water. The tool surface will change without notice.

An [MCP](https://modelcontextprotocol.io) server that answers "what lights
may this vessel show" from
[colregs-engine](https://github.com/mark-brannan/colregs-engine), and hands
back the answer in a form a language model cannot quietly simplify: every
lawful display, every light with its own modality, every entry with its
paragraph cite, and the verbatim rule text those cites resolve to.

It has no semantics of its own. The engine decides; this package only
decides how the answer is written down. That is the whole job, and the
[response shape](#response-shape) section is the part worth reading.

## Try it

Register the stdio server with your client. Claude Code:

```bash
claude mcp add colregs -- npx -y colregs-mcp
```

Any other MCP client: command `npx`, arguments `-y colregs-mcp`, no
environment.

## Tools

| tool | input | returns |
|---|---|---|
| `evaluate_display` | `facts` | every lawful display, cited and with modality per light |
| `applied_entries` | `facts` | the applicability entries that hold, as `{id, cite}` |
| `rule_text` | `cite` | verbatim paragraph text from colregs `data/rules.json` |
| `light` | `id` | a light's definition from colregs `data/lights.json` |

`facts` is a colregs fact record: the keys and values of colregs'
`data/facts.json`, namespaced (`fact:propulsion`, `propulsion:sail`). The
input schema is generated from that file at startup, so it follows the data.
A key or value outside the vocabulary is an error, never an empty answer.

Every tool description carries the coverage limits: COLREGS Part C lights
only, international text only, lights at night only, pre-release data.

## Two worked examples

The same two vessels as colregs-engine's README.

### A 12 m sloop, under way: three displays

```json
{ "facts": { "fact:propulsion": "propulsion:sail", "fact:activity": "activity:none",
             "fact:position": "position:underway", "fact:length_m": 11.6 } }
```

Trimmed response:

```json
{
  "colregs": { "version": "0.2.0", "source": "resolved" },
  "applied": [
    { "id": "25a", "cite": "25(a)", "modality": "shall" },
    { "id": "25b", "cite": "25(b)", "modality": "may" },
    { "id": "25c", "cite": "25(c)", "modality": "may" }
  ],
  "exempted": [], "excluded": [],
  "lawful_displays": {
    "count": 3,
    "relation": "any_one_of",
    "options": [
      { "option": 1, "of": 3, "chosen": [],
        "lights": [
          { "light": "light:sidelights", "name": "sidelights", "modality": "shall", "prescribed_by": { "id": "25a", "cite": "25(a)" } },
          { "light": "light:sternlight", "name": "sternlight", "modality": "shall", "prescribed_by": { "id": "25a", "cite": "25(a)" } } ] },
      { "option": 2, "of": 3, "chosen": [ { "id": "25b", "cite": "25(b)", "modality": "may" } ],
        "lights": [
          { "light": "light:sidelights", "name": "sidelights", "combined": true, "position": "at or near the top of the mast", "modality": "may", "prescribed_by": { "id": "25b", "cite": "25(b)" } },
          { "light": "light:sternlight", "name": "sternlight", "combined": true, "position": "at or near the top of the mast", "modality": "may", "prescribed_by": { "id": "25b", "cite": "25(b)" } } ] },
      { "option": 3, "of": 3, "chosen": [ { "id": "25c", "cite": "25(c)", "modality": "may" } ],
        "lights": [
          { "light": "light:sidelights", "name": "sidelights", "modality": "shall", "prescribed_by": { "id": "25a", "cite": "25(a)" } },
          { "light": "light:sternlight", "name": "sternlight", "modality": "shall", "prescribed_by": { "id": "25a", "cite": "25(a)" } },
          { "light": "light:all_round", "name": "all-round light", "color": "red", "count": 1, "position": "upper, at or near the top of the mast", "modality": "may", "prescribed_by": { "id": "25c", "cite": "25(c)" } },
          { "light": "light:all_round", "name": "all-round light", "color": "green", "count": 1, "position": "lower, at or near the top of the mast", "modality": "may", "prescribed_by": { "id": "25c", "cite": "25(c)" } } ] }
    ]
  },
  "optional_additions": { "relation": "any_subset_of", "items": [] },
  "modality_key": { "shall": "mandatory", "may": "permitted alternative" },
  "cited_paragraphs": {
    "25(a)": "A sailing vessel underway shall exhibit: (i) sidelights; (ii) a sternlight.",
    "25(b)": "In a sailing vessel of less than 20 meters in length the lights prescribed in Rule 25(a) may be combined in one lantern carried at or near the top of the mast where it can best be seen.",
    "25(c)": "A sailing vessel underway may, in addition to the lights prescribed in Rule 25(a), exhibit at or near the top of the mast, where they can best be seen, two all-round lights in a vertical line, the upper being red and the lower green, but these lights shall not be exhibited in conjunction with the combined lantern permitted by Rule 25(b)."
  }
}
```

Three is the right number, and the response is built so that "a 12 m sloop
shows sidelights and a sternlight" cannot be read off it. The fact record
describes a situation, not a fitted vessel. There is no equipment fact in
colregs' `data/facts.json` (checked: nothing in that file names a lantern,
a fitting or a piece of gear), so nothing in the input can settle 25(b)
against 25(c). The Rules leave that to the skipper, and so does this.

### A fishing vessel aground: two lawful displays, no exclusion

```json
{ "facts": { "fact:propulsion": "propulsion:power", "fact:activity": "activity:fishing",
             "fact:position": "position:aground", "fact:length_m": 30 } }
```

Trimmed response:

```json
{
  "applied": [
    { "id": "30d-anchor", "cite": "30(d)", "modality": "shall" },
    { "id": "30d-red", "cite": "30(d)", "modality": "shall-if-practicable" }
  ],
  "excluded": [],
  "lawful_displays": {
    "count": 2, "relation": "any_one_of",
    "options": [
      { "option": 1, "of": 2, "chosen": [ { "id": "30a", "cite": "30(a)", "modality": "shall" } ],
        "lights": [
          { "light": "light:all_round", "color": "red",   "count": 2, "arrangement": "vertical", "modality": "shall-if-practicable", "prescribed_by": { "id": "30d-red", "cite": "30(d)" } },
          { "light": "light:all_round", "color": "white", "count": 1, "position": "in the fore part", "modality": "shall", "prescribed_by": { "id": "30a", "cite": "30(a)" }, "via": { "id": "30d-anchor", "cite": "30(d)" } },
          { "light": "light:all_round", "color": "white", "count": 1, "position": "at or near the stern, at a lower level than the fore one", "modality": "shall", "prescribed_by": { "id": "30a", "cite": "30(a)" }, "via": { "id": "30d-anchor", "cite": "30(d)" } } ] },
      { "option": 2, "of": 2, "chosen": [ { "id": "30b", "cite": "30(b)", "modality": "may" } ],
        "lights": [
          { "light": "light:all_round", "color": "red",   "count": 2, "arrangement": "vertical", "modality": "shall-if-practicable", "prescribed_by": { "id": "30d-red", "cite": "30(d)" } },
          { "light": "light:all_round", "color": "white", "count": 1, "position": "where it can best be seen", "modality": "may", "prescribed_by": { "id": "30b", "cite": "30(b)" }, "via": { "id": "30d-anchor", "cite": "30(d)" } } ] }
    ]
  },
  "modality_key": { "shall": "mandatory", "may": "permitted alternative", "shall-if-practicable": "mandatory where practicable, with a stated fallback" },
  "cited_paragraphs": { "30(a)": "…", "30(b)": "…", "30(d)": "…" }
}
```

No Rule 26 entry fires for `position:aground`: per
[ADR 0007](https://github.com/mark-brannan/colregs/blob/main/docs/adr/0007-rule26-overrides-and-aground.md),
Rule 26 has no jurisdiction over a vessel aground, so Rule 30(d) alone
governs and she shows the same anchor lights as any other vessel her
length, plus 30(d)'s red lights if practicable.

## Response shape

Three properties, each tested in `test/examples.test.ts`:

1. **Cited, verbatim.** Every entry id travels with its paragraph cite, and
   `cited_paragraphs` holds the text of every paragraph a response cites,
   straight from colregs `data/rules.json`. This package writes no prose of
   its own into a response; the only sentences in it are the Rules'.
2. **Modality per light.** `shall`, `may`, `shall-if-practicable` and the
   rest are kept on each light, not summarised per display. Option 3 above
   is two `shall` lights and two `may` lights, and it says so four times.
   `modality_key` carries colregs' own one-line glossary for the modalities
   the response uses.
3. **Plural by construction.** `lawful_displays` opens with `count` and
   `relation` (`exactly_one` or `any_one_of`) before any lights appear; each
   option numbers itself `n of count` and names the choice entries that
   distinguish it; and there is no top-level `lights` field to mistake for
   the answer. The tool description says why plural is correct, in the terms
   above.

A vessel that lawfully shows nothing gets one empty display, not an error,
matching the engine. An error is reserved for input outside the vocabulary.

Every response carries `colregs.version` and, on `evaluate_display`,
`colregs.source`, both straight from the engine. The server refuses to start
if its own copy of colregs and the engine's are different releases.

## Why a separate package

colregs-engine is pure, total and has no runtime dependencies, and
formal-methods work is planned on top of it. A transport and a server SDK
belong somewhere else. This is that somewhere.

## Dependencies and stability

- `colregs-engine` and `colregs` are both published npm packages, pinned
  with caret ranges. The engine and the data package must resolve the same
  release; a split install fails at startup with a message saying so.
- Version 0.0.x. Tool names, argument names and response fields may all
  change. The three response properties above are the commitment; nothing
  else is.

## Licence

Apache-2.0. Nothing here is advice to mariners; the fitness-for-navigation
disclaimer in [colregs](https://github.com/mark-brannan/colregs) carries
over.
