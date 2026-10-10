# Demo: a bare model's answer versus the cited one

> [!WARNING]
> **Not for navigation.** This is a preview (0.0.x) built on pre-release
> rule data. It covers COLREGS Part C lights only, international text only,
> at night only. Do not use its output, or any answer on this page, to
> decide what to show or what you are looking at on the water.

The point of this server is that a model cannot quietly flatten a plural,
cited answer into one confident sentence. This page puts one question to the
same model, in the same client, twice: once alone, once with the server.
Every answer below is captured output, not written by hand, and the commands
are here so you can run the same thing.

## The question

The sloop from the [worked examples](../README.md#two-worked-examples), 11.6 m
under sail and underway, which has three lawful displays under Rule 25.

```text
What navigation lights does my 11.6 m sailboat show at night, under sail and underway, under the COLREGS?
```

## How it was captured

| | |
|---|---|
| Date | 2026-10-10, runs started between 10:26:57 and 10:30:26 UTC |
| Client | Claude Code 2.1.258, `claude -p` (one question, no conversation) |
| Model | `claude-sonnet-5-5`, read back from the `modelUsage` field of every run |
| Server | this repository at commit `56aaca5`, built with `npm ci && npm run build` |
| Data | `colregs` 0.3.4 (the `colregs.version` the tool reports) and `colregs-engine` 0.1.7 (from the install) |
| Runs | six in total, all listed [below](#all-six-runs); none was discarded |

Without the server:

```bash
claude -p --model claude-sonnet-5-5 --tools "" --setting-sources project \
  --strict-mcp-config --no-session-persistence \
  --output-format stream-json --verbose \
  -- "What navigation lights does my 11.6 m sailboat show at night, under sail and underway, under the COLREGS?" > bare.jsonl
```

With it, the same command plus `--mcp-config mcp.json --allowedTools mcp__colregs`
before the `--` and `> server.jsonl` at the end, where `mcp.json` is

```json
{ "mcpServers": { "colregs": { "command": "node", "args": ["/absolute/path/to/colregs-mcp/dist/cli.js"] } } }
```

(The capture used the absolute path of its clone; it is replaced here.)

What the flags are for: `--tools ""` removes the client's own tools, so the
bare run answers from the model alone (no web search) and the server run can
reach nothing but the colregs tools. `--setting-sources project`, run from an
empty directory outside any repository, and `--strict-mcp-config` keep the
user's settings, hooks and other MCP servers out. `--output-format
stream-json --verbose` records the model id and each tool call, and the
answers below are read back out of that record with
`jq -r 'select(.type=="result") | .result' bare.jsonl`. The CLI printed an
`unrecognized_model` notice on stderr for this model id; every run still
reported `claude-sonnet-5-5` as the model used.

## Without the server

Run 1, started 10:26:57 UTC, verbatim:

````text
Under sail and underway, at 11.6 m (under 20 m), Rule 25 requires three lights:

| Light | Colour | Arc | Visible range (Rule 22, vessel under 12 m) |
|---|---|---|---|
| Starboard sidelight | green | 112.5° from dead ahead to 22.5° abaft the beam | 1 nm |
| Port sidelight | red | 112.5° on the port side | 1 nm |
| Sternlight | white | 135° centred astern | 2 nm |

Seen from ahead, from the side, and from astern:

```
 ahead:      red   green        side (stbd):  green        astern:   white
```

- **Combined lantern:** under 20 m, Rule 25(b) lets you put the three on one lantern at or near the masthead (a tricolour).
- **Optional extra:** Rule 25(c) allows an all-round red-over-green pair at the masthead. You can't use it together with a tricolour.
- **Engine running:** you're then a power-driven vessel (Rule 3) and must show a white masthead light, with a 225° arc, plus the sidelights and sternlight. Rule 25(e) allows a sailing vessel under 7 m to use a torch instead, but that doesn't apply at 11.6 m.
````

This answer gets the options roughly right, with one wrong cite, and gives a
reader nothing to check it against.

- **It leads with one display.** "Rule 25 requires three lights" opens a
  table of sidelights and a sternlight; the combined lantern and the
  red-over-green pair come after it as bullets. Nothing says how many
  displays are lawful, or that they are alternatives.
- **It mis-cites a paragraph.** It says Rule 25(e) lets a sailing vessel under
  7 m use a torch. In the rule text `rule_text` returns (colregs 0.3.4), that
  is 25(d)(i); 25(e) is something else:

  > 25(d)(i): A sailing vessel of less than 7 meters in length shall, if practicable, exhibit the lights prescribed in Rule 25(a) or (b), but if she does not, she shall have ready at hand an electric torch or lighted lantern showing a white light which shall be exhibited in sufficient time to prevent collision.
  >
  > 25(e): A vessel proceeding under sail when also being propelled by machinery shall exhibit forward where it can best be seen a conical shape, apex downwards.

  Without the Rules open, a reader cannot tell this slip from a correct cite.
- **Nothing in it can be checked.** No paragraph text, and no marking of which
  lights are mandatory and which are permitted.

## With the server

Run 2, started 10:28:43 UTC. The model made one tool call, read back with
`jq -c 'select(.type=="assistant") | .message.content[] | select(.type=="tool_use") | {name, input}' server.jsonl`:

```json
{"name":"mcp__colregs__evaluate_display","input":{"facts":{"fact:propulsion":"propulsion:sail","fact:activity":"activity:none","fact:position":"position:underway","fact:making_way":true,"fact:length_m":11.6}}}
```

(It added `fact:making_way` on its own. The README's sloop leaves it out and
gets the same three displays.) The tool's response has the shape of the README's
first example. This is that response, reduced with
`jq -r 'select(.type=="user") | .message.content[]? | select(.type=="tool_result") | .content' server.jsonl | jq -r -f summarize.jq`,
where `summarize.jq` is

```jq
"colregs \(.colregs.version), \(.lawful_displays.count) lawful displays, relation \(.lawful_displays.relation)",
(.lawful_displays.options[] |
  "option \(.option) of \(.of), chosen: \([.chosen[].cite] | join(",") | if . == "" then "-" else . end)",
  (.lights[] | "    \(.name)\(if .color then " (\(.color))" else "" end)  \(.modality | sub("modality:"; ""))  \(.prescribed_by.cite)")),
"cited_paragraphs: \(.cited_paragraphs | keys | join(", "))"
```

and the output is

```text
colregs 0.3.4, 3 lawful displays, relation any_one_of
option 1 of 3, chosen: 25(b)
    sidelights  may  25(b)
    sternlight  may  25(b)
option 2 of 3, chosen: -
    sidelights  shall  25(a)
    sternlight  shall  25(a)
option 3 of 3, chosen: 25(c)
    sidelights  shall  25(a)
    sternlight  shall  25(a)
    all-round light (red)  may  25(c)
    all-round light (green)  may  25(c)
cited_paragraphs: 25(a), 25(b), 25(c)
```

The model's answer, verbatim:

````text
Three displays are lawful for an 11.6 m sailboat under sail and underway. Which one you show depends on how your boat is fitted. This is not for navigation.

| # | Display | Rule |
|---|---|---|
| 1 | One combined lantern at or near the masthead, carrying sidelights and sternlight together | 25(b) |
| 2 | Separate sidelights (red to port, green to starboard) and a sternlight | 25(a) |
| 3 | The same as #2, plus two all-round lights in a vertical line at or near the masthead, red above green | 25(a) + 25(c) |

Sidelights and a sternlight are mandatory (25(a)). Under 20 m you may combine them into one masthead lantern (25(b)). The red-over-green lights (25(c)) are an optional addition. They may not be shown together with the combined lantern from #1.

The tool's data is a pre-release version (0.3.4) that is still being checked. Rule text quoted is from the tool's output.
````

It opens with the count, names the choice each display turns on, and keeps
25(c) apart from 25(b), all of which come straight from the response. The
answer is still the model's prose; the commitment is the response it was
given, which carries the cites and the verbatim paragraph text.

## All six runs

| Run | Server | UTC | What the answer did |
|---|---|---|---|
| 1 | no | 10:26:57 | Leads with "Rule 25 requires three lights"; 25(b) and 25(c) as bullets; torch cited as 25(e), which is 25(d)(i). Shown above |
| 3 | no | 10:29:56 | "One of two arrangements", then 25(c) as an optional extra; cites right. The closest bare run to the server's, and still no count of three and no rule text |
| 4 | no | 10:29:56 | Opens "at minimum" three lights; describes 25(b) as the two sidelights in one lantern at the bow, and cites the tricolour as 25(e); flags its own ranges as from memory |
| 2 | yes | 10:28:43 | One `evaluate_display` call; "three lawful displays"; 25(a), 25(b), 25(c); 25(c) not with 25(b). Shown above |
| 5 | yes | 10:30:26 | One call; "three lawful displays"; the same three-row table; quotes 25(a) and 25(c) from the response |
| 6 | yes | 10:30:26 | One call (also sent `fact:motorsailing: false`); "three lawful displays"; the same three-row table |

Three runs each is a sample, not a rate. It does not show that a bare model is
always wrong, and run 3 shows it is not. It shows what to expect: the bare
answers vary in what they cite and how many displays they name, and none of
them says three; every server-backed answer did, from the response rather
than from memory.

## Run it yourself

Build the clone and register it, then ask the same question with and without
it:

```bash
git clone https://github.com/mark-brannan/colregs-mcp && cd colregs-mcp && npm ci && npm run build
claude mcp add colregs -- node "$PWD/dist/cli.js"

Q="What navigation lights does my 11.6 m sailboat show at night, under sail and underway, under the COLREGS?"
claude -p --allowedTools mcp__colregs -- "$Q"   # with the server
claude -p --strict-mcp-config -- "$Q"           # no MCP servers at all
```

`claude mcp remove colregs` undoes the registration. The README's one-liner,
`claude mcp add colregs -- npx -y colregs-mcp`, installs the latest release
instead of a clone; its data can be older than the 0.3.4 captured here, so
check `colregs.version` in the tool result first if your count differs.

Your client's own settings and tools change the bare answer (one with web
search may look the Rules up), which is why the captured runs removed them.
Expect different wording on every run; what to look for is the count of
displays, the cite on each, and whether the cites match the Rules.
