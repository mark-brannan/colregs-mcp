// The four tools. Thin: each one calls the engine or reads a data file, then
// hands the result to shape.ts. No semantics of its own.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { appliedDisplayEntries, evaluateDisplay } from 'colregs-engine';
import type { FactRecord } from 'colregs-engine';
import { z } from 'zod';

import { COLREGS_VERSION, facts as factsData, lights, paragraphKeys, rules } from './data.js';
import { shapeApplied, shapeEvaluation } from './shape.js';

const require_ = (await import('node:module')).createRequire(import.meta.url);
export const VERSION: string = (require_('../package.json') as { version: string }).version;

// Appended to every tool description. The wording is deliberately the same
// on all four so a client that shows one tool shows the limits.
export const NOT_FOR_NAVIGATION =
  'Not for navigation. ' +
  'Coverage: COLREGS Part C lights only, international (high seas) text only, ' +
  'lights at night only (no day shapes, no sound signals, no Part B steering rules), ' +
  'evaluated against pre-release colregs data (0.x), whose content is still being ' +
  'checked. Every entry id and paragraph cite in a response is verbatim from the ' +
  'colregs data package; nothing is paraphrased. This tool surface is a 0.0.x ' +
  'preview and will change without notice.';

const PLURAL_ANSWER =
  'A fact record describes a situation, not a fitted vessel: colregs data/facts.json ' +
  'has no equipment fact, so nothing in the input can settle a choice the Rules leave ' +
  'to how the vessel is fitted or what the skipper elects, such as Rule 25(b), the ' +
  'combined masthead lantern a sailing vessel under 20 m may carry, against Rule 25(c), ' +
  'the all-round red over green she may add. When lawful_displays.count is greater than 1, ' +
  'every option is equally lawful, the correct report is all of them, and reporting any ' +
  'one as "the" display for this vessel is wrong. Each option numbers itself "n of count", ' +
  'names the choice entries that distinguish it (chosen) and lists its lights with their ' +
  'own modality, so "shall" and "may" lights in one display are never merged.';

const CHECK_VERSIONS = (): void => {
  // rule_text and light read this package's colregs; evaluate_display reads
  // the engine's. They dedupe to one copy under a compatible range, but a
  // split install would cite paragraphs from one release against entries
  // from another and nothing in a response could show it.
  const engineSees = evaluateDisplay({}).colregs.version;
  if (engineSees !== COLREGS_VERSION) {
    throw new Error(
      `colregs version split: colregs-engine resolved colregs@${engineSees}, ` +
        `colregs-mcp resolved colregs@${COLREGS_VERSION}. Reinstall so both use one release.`,
    );
  }
};

/** Input schema for a fact record, built from facts.json so it follows the
 * data. Derived facts are never accepted: a consumer does not supply them.
 * Every field is optional; an absent fact never satisfies a predicate
 * (colregs "Predicate semantics"), so leaving one out can only remove
 * entries, never add them. */
function factRecordSchema() {
  const shape: Record<string, z.ZodTypeAny> = {};
  const withNote = (s: z.ZodTypeAny, cite?: string, note?: string) => {
    const parts = [cite ? `Cite ${cite}.` : '', note ?? ''].filter(Boolean);
    return parts.length ? s.describe(parts.join(' ')) : s;
  };
  for (const [key, axis] of Object.entries(factsData.axes)) {
    const cites = Object.entries(axis.cites ?? {})
      .map(([v, c]) => `${v}: ${c}`)
      .join('; ');
    shape[key] = withNote(
      z.enum(axis.values as [string, ...string[]]).optional(),
      undefined,
      [cites && `Cites: ${cites}.`, axis.note].filter(Boolean).join(' '),
    );
  }
  for (const [key, f] of Object.entries(factsData.modifiers)) {
    shape[key] = withNote(z.boolean().optional(), undefined, [f.refines && `Refines ${f.refines}.`, f.note].filter(Boolean).join(' '));
  }
  for (const [key, f] of Object.entries(factsData.numerics)) {
    shape[key] = withNote(z.number().optional(), f.cite, [f.unit && `Unit: ${f.unit}.`, f.note].filter(Boolean).join(' '));
  }
  for (const [key, f] of Object.entries(factsData.booleans)) {
    shape[key] = withNote(z.boolean().optional(), f.cite, f.note);
  }
  return z.object(shape).strict();
}

const json = (value: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  structuredContent: value as Record<string, unknown>,
});

const failure = (message: string, detail?: Record<string, unknown>): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: JSON.stringify({ error: message, ...detail }, null, 2) }],
});

function withEngine<T>(fn: () => T): CallToolResult {
  try {
    return json(fn());
  } catch (e) {
    return failure(e instanceof Error ? e.message : String(e));
  }
}

export function createServer(): McpServer {
  CHECK_VERSIONS();
  const server = new McpServer({ name: 'colregs-mcp', version: VERSION });
  const FactsSchema = factRecordSchema();

  server.registerTool(
    'evaluate_display',
    {
      title: 'Evaluate lawful light displays',
      description:
        'Every complete, lawful set of navigation lights one vessel may show, from a ' +
        'fact record (propulsion, activity, position, length, and the other facts ' +
        'in colregs data/facts.json) under the COLREGS. Returns the applied entries, ' +
        'the entries exempted or excluded and by which entry, and lawful_displays: ' +
        '{count, relation, options}. relation is "none", "exactly_one" or "any_one_of". ' +
        PLURAL_ANSWER +
        ' optional_additions are lawful extras (relation any_subset_of) that do not ' +
        'multiply the display set. Every id carries its paragraph cite, and ' +
        'cited_paragraphs holds the verbatim text of every cited paragraph. ' +
        NOT_FOR_NAVIGATION,
      inputSchema: { facts: FactsSchema },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ facts }) =>
      withEngine(() => shapeEvaluation(facts as FactRecord, evaluateDisplay(facts as FactRecord))),
  );

  server.registerTool(
    'applied_entries',
    {
      title: 'Applied applicability entries',
      description:
        'The colregs applicability entries whose conditions hold for a fact record, as ' +
        '{id, cite} pairs in data order, without composing displays. Use evaluate_display ' +
        'for the lights; this is the cheaper question "which paragraphs speak to this ' +
        'vessel". Same input as evaluate_display. ' +
        NOT_FOR_NAVIGATION,
      inputSchema: { facts: FactsSchema },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ facts }) =>
      withEngine(() => shapeApplied(facts as FactRecord, appliedDisplayEntries(facts as FactRecord))),
  );

  server.registerTool(
    'rule_text',
    {
      title: 'Verbatim rule text',
      description:
        'The verbatim text of a COLREGS paragraph from colregs data/rules.json, by its ' +
        'cite as used in every other response here: a paragraph path such as "25(b)" or ' +
        '"26(c)(i)", a bare rule number such as "25" for every paragraph of that rule, ' +
        'or a range such as "24(a)(ii)-(iv)". The text is the International text as ' +
        'transcribed from the USCG amalgamated Navigation Rules; the response names ' +
        'the source and retrieval date. ' +
        NOT_FOR_NAVIGATION,
      inputSchema: { cite: z.string().describe('Paragraph path, rule number or range, e.g. "25(b)", "25", "24(a)(ii)-(iv)".') },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ cite }) => {
      const keys = paragraphKeys(cite);
      if (keys.length === 0) {
        const rule = /^(\d+)/.exec(cite.trim())?.[1];
        const gap = rules.gaps.find((g) => g.path === cite.trim());
        return failure(`no paragraph for cite '${cite}'`, {
          ...(gap ? { gap: gap.reason } : {}),
          ...(rule ? { known_cites_for_rule: paragraphKeys(rule) } : {}),
        });
      }
      return json({
        colregs: { version: COLREGS_VERSION },
        source: { source: rules.source, source_url: rules.source_url, retrieved: rules.retrieved },
        paragraphs: keys.map((k) => {
          const p = rules.paragraphs[k];
          return { cite: k, rule: p.rule, rule_title: p.rule_title, jurisdiction: p.jurisdiction, text: p.text };
        }),
      });
    },
  );

  server.registerTool(
    'light',
    {
      title: 'Light definition',
      description:
        'The definition of one light from colregs data/lights.json, verbatim: name, ' +
        'the Rule 21 paragraph that defines it, colour, character, arc in degrees and ' +
        'placement. Ids are the light ids that evaluate_display returns, such as ' +
        '"light:sidelights" or "light:all_round"; the "light:" prefix is optional. ' +
        'Arcs use the bearing convention returned alongside. ' +
        NOT_FOR_NAVIGATION,
      inputSchema: { id: z.string().describe('Light id, e.g. "light:masthead" or "masthead".') },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ id }) => {
      const key = id.trim().startsWith('light:') ? id.trim() : `light:${id.trim()}`;
      const def = lights.lights[key];
      if (!def) return failure(`no light '${key}'`, { known_ids: Object.keys(lights.lights) });
      return json({
        colregs: { version: COLREGS_VERSION },
        id: key,
        definition: def,
        bearing_convention: lights.bearing_convention,
      });
    },
  );

  return server;
}
