// The two worked examples from colregs-engine's README, seen through the
// tools. These assert the response *shape* properties the package exists
// for; the engine's own tests own the semantics.

import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';

import { FISHING_AGROUND, SLOOP, TRAWLER_ANCHORED, call, connect } from './helpers.js';

const require = createRequire(import.meta.url);
const rulesJson = require('colregs/data/rules.json');

let client: Awaited<ReturnType<typeof connect>>;
beforeAll(async () => {
  client = await connect();
});

describe('evaluate_display: the 12 m sloop shows one of three displays', () => {
  it('is structurally plural and every light keeps its modality and cite', async () => {
    const { isError, body, structured } = await call(client, 'evaluate_display', { facts: SLOOP });
    expect(isError).toBe(false);
    expect(structured).toEqual(body);

    expect(body.colregs).toEqual({ version: expect.any(String), source: 'resolved' });
    expect(body.facts).toEqual(SLOOP);
    expect(body.applied).toEqual([
      { id: '25a', cite: '25(a)', modality: 'shall' },
      { id: '25b', cite: '25(b)', modality: 'may' },
      { id: '25c', cite: '25(c)', modality: 'may' },
    ]);
    expect(body.excluded).toEqual([]);
    expect(body.exempted).toEqual([]);
    expect(body.overridden).toEqual([]);

    const ld = body.lawful_displays;
    expect(Object.keys(ld)).toEqual(['count', 'relation', 'options']);
    expect(ld.count).toBe(3);
    expect(ld.relation).toBe('any_one_of');
    expect(ld.options.map((o: { option: number; of: number }) => [o.option, o.of])).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(ld.options.map((o: { chosen: { id: string }[] }) => o.chosen.map((c) => c.id))).toEqual([[], ['25b'], ['25c']]);

    // No top-level lights to mistake for "the answer".
    expect(body.lights).toBeUndefined();

    for (const o of ld.options) {
      for (const l of o.lights) {
        expect(['shall', 'may']).toContain(l.modality);
        expect(l.prescribed_by).toEqual({ id: expect.any(String), cite: expect.stringMatching(/^\d+\(/) });
        expect(l.name).toEqual(expect.any(String));
      }
    }
    // Option 3 mixes obligations: 25(a)'s shall lights with 25(c)'s may lights.
    expect(ld.options[2].lights.map((l: { modality: string }) => l.modality)).toEqual(['shall', 'shall', 'may', 'may']);
    expect(ld.options[2].lights[2]).toMatchObject({ light: 'light:all_round', color: 'red', modality: 'may', prescribed_by: { id: '25c', cite: '25(c)' } });

    expect(body.modality_key).toEqual({ shall: expect.any(String), may: expect.any(String) });
    expect(body.cited_paragraphs['25(b)']).toBe(rulesJson.paragraphs['25(b)'].text);
    expect(Object.keys(body.cited_paragraphs).sort()).toEqual(['25(a)', '25(b)', '25(c)']);
  });
});

describe('evaluate_display: a fishing vessel aground', () => {
  it('falls back to ordinary anchor lights, no Rule 26 entry firing', async () => {
    const { isError, body } = await call(client, 'evaluate_display', { facts: FISHING_AGROUND });
    expect(isError).toBe(false);

    // colregs-engine#32 (open, unruled): whether a fishing vessel aground
    // shows a fishing-vessel identity alongside her anchor lights. As it
    // stands, no Rule 26 entry fires for `position:aground`, so she shows
    // the plain anchor lights of Rule 30 like any other vessel her length.
    expect(body.applied.map((a: { id: string }) => a.id)).toEqual(['30d-anchor', '30d-red']);
    expect(body.excluded).toEqual([]);
    expect(body.overridden).toEqual([]);

    const ld = body.lawful_displays;
    expect(ld.count).toBe(2);
    expect(ld.relation).toBe('any_one_of');
    expect(ld.options.map((o: { chosen: { id: string }[] }) => o.chosen.map((c) => c.id))).toEqual([['30a'], ['30b']]);
    const mods = ld.options.flatMap((o: { lights: { modality: string }[] }) => o.lights.map((l) => l.modality));
    expect(mods).toContain('shall');
    expect(mods).toContain('may');
    expect(mods).toContain('shall-if-practicable');
    expect(body.modality_key['shall-if-practicable']).toEqual(expect.any(String));

    for (const k of ['30(a)', '30(b)', '30(d)']) {
      expect(body.cited_paragraphs[k]).toBe(rulesJson.paragraphs[k].text);
    }
  });
});

describe('evaluate_display: a trawler at anchor (colregs-engine#36)', () => {
  it('reports her displaced 30a/30b anchor lights in overridden, not excluded', async () => {
    const { isError, body } = await call(client, 'evaluate_display', { facts: TRAWLER_ANCHORED });
    expect(isError).toBe(false);

    // Rule 26's fishing-vessel identification is an obligation that
    // outranks Rule 30's anchor lights for the same vessel: 30a/30b leave
    // composition via rel:overrides, not rel:excludes, and must still be
    // named -- silently dropping them (the bug this test pins) would leave
    // an MCP client believing no anchor-light rule ever applied at all.
    expect(body.excluded).toEqual([]);
    expect(body.overridden.length).toBeGreaterThan(0);
    expect(body.overridden.map((x: { id: string }) => x.id).sort()).toEqual(['30a', '30b']);
    for (const x of body.overridden) {
      expect(x).toEqual({
        id: expect.any(String),
        cite: expect.stringMatching(/^30\(/),
        by: { id: expect.any(String), cite: expect.stringMatching(/^26\(/) },
      });
    }
    // Both the displaced entries and their overrider are "applied" (their
    // predicates matched) -- overridden only says they left composition,
    // same contract as excluded/exempted.
    const appliedIds = body.applied.map((a: { id: string }) => a.id);
    const overriddenBy = new Set(body.overridden.map((x: { by: { id: string } }) => x.by.id));
    for (const id of overriddenBy) expect(appliedIds).toContain(id);
    for (const x of body.overridden) expect(appliedIds).toContain(x.id);

    // Neither displaced entry appears in any lawful display.
    for (const d of body.lawful_displays.options) {
      expect(d.entries.map((e: { id: string }) => e.id)).not.toContain('30a');
      expect(d.entries.map((e: { id: string }) => e.id)).not.toContain('30b');
    }

    // Overridden ids' and overriders' cites are resolvable, same contract
    // as exempted/excluded.
    for (const x of body.overridden) {
      expect(body.cited_paragraphs[x.cite]).toEqual(expect.any(String));
      expect(body.cited_paragraphs[x.by.cite]).toEqual(expect.any(String));
    }
  });
});

describe('applied_entries', () => {
  it('returns ids with cites and nothing composed', async () => {
    const { isError, body } = await call(client, 'applied_entries', { facts: SLOOP });
    expect(isError).toBe(false);
    expect(body).toEqual({
      colregs: { version: expect.any(String), source: 'resolved' },
      facts: SLOOP,
      applied: [
        { id: '25a', cite: '25(a)' },
        { id: '25b', cite: '25(b)' },
        { id: '25c', cite: '25(c)' },
      ],
    });
  });
});

describe('rule_text', () => {
  it('returns verbatim paragraph text with its source', async () => {
    const { isError, body } = await call(client, 'rule_text', { cite: '25(b)' });
    expect(isError).toBe(false);
    expect(body.colregs.version).toEqual(expect.any(String));
    expect(body.source.source_url).toEqual(expect.stringMatching(/^https:/));
    expect(body.paragraphs).toEqual([
      { cite: '25(b)', rule: '25', rule_title: expect.any(String), jurisdiction: 'intl', text: rulesJson.paragraphs['25(b)'].text },
    ]);
  });
  it('expands a rule number and a range', async () => {
    const whole = await call(client, 'rule_text', { cite: '25' });
    expect(whole.body.paragraphs.map((p: { cite: string }) => p.cite)).toContain('25(d)(ii)');
    const range = await call(client, 'rule_text', { cite: '24(a)(ii)-(iv)' });
    expect(range.body.paragraphs.map((p: { cite: string }) => p.cite)).toEqual(['24(a)(ii)', '24(a)(iii)', '24(a)(iv)']);
  });
  it('fails visibly on an unknown cite and names the rule\'s real cites', async () => {
    const { isError, body } = await call(client, 'rule_text', { cite: '25(z)' });
    expect(isError).toBe(true);
    expect(body.known_cites_for_rule).toContain('25(a)');
  });
});

describe('light', () => {
  it('returns the verbatim definition, prefix optional', async () => {
    const a = await call(client, 'light', { id: 'light:sidelights' });
    const b = await call(client, 'light', { id: 'sidelights' });
    expect(a.isError).toBe(false);
    expect(a.body).toEqual(b.body);
    expect(a.body.definition.cite).toBe('21(b)');
    expect(a.body.bearing_convention.zero).toBe('right ahead');
  });
  it('fails visibly on an unknown id', async () => {
    const { isError, body } = await call(client, 'light', { id: 'searchlight' });
    expect(isError).toBe(true);
    expect(body.known_ids).toContain('light:masthead');
  });
});

describe('inputs', () => {
  it('rejects a fact outside colregs vocabulary rather than answering', async () => {
    const res = await client.callTool({ name: 'evaluate_display', arguments: { facts: { propulsion: 'sail' } } });
    expect(res.isError).toBe(true);
  });
  it('rejects a value the engine does not know', async () => {
    const res = await client.callTool({
      name: 'evaluate_display',
      arguments: { facts: { ...SLOOP, 'fact:activity': 'activity:racing' } },
    });
    expect(res.isError).toBe(true);
  });
  it('an empty record is a vessel that shows nothing: one empty display, not an error', async () => {
    const { isError, body } = await call(client, 'evaluate_display', { facts: {} });
    expect(isError).toBe(false);
    expect(body.lawful_displays).toEqual({
      count: 1,
      relation: 'exactly_one',
      options: [{ option: 1, of: 1, chosen: [], entries: [], lights: [] }],
    });
    expect(body.cited_paragraphs).toEqual({});
  });
});

describe('tool descriptions', () => {
  it('every tool carries the not-for-navigation line and coverage limits', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['applied_entries', 'evaluate_display', 'light', 'rule_text']);
    for (const t of tools) {
      expect(t.description).toContain('Not for navigation.');
      expect(t.description).toContain('Part C lights only');
      expect(t.description).toContain('pre-release colregs data');
    }
    const ev = tools.find((t) => t.name === 'evaluate_display')!;
    expect(ev.description).toContain('has no equipment fact');
    expect(ev.description).toContain('every option is equally lawful');
    const props = (ev.inputSchema as { properties: Record<string, { properties: Record<string, unknown> }> }).properties.facts.properties;
    expect(Object.keys(props)).toContain('fact:length_m');
    expect(Object.keys(props)).not.toContain('fact:rule18_class');
  });
});
