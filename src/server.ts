// The tools. Thin: each one calls the engine or reads a data file, then
// hands the result to shape.ts or straight through. No semantics of its own.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { evaluate } from 'colregs-engine';
import type { Circumstances, FactRecord } from 'colregs-engine';
import { z } from 'zod';

import { COLREGS_VERSION, facts as factsData, lights, paragraphKeys, rules } from './data.js';
import { shapeEvaluation } from './shape.js';

const require_ = (await import('node:module')).createRequire(import.meta.url);
export const VERSION: string = (require_('../package.json') as { version: string }).version;

// Appended to every tool description. The wording is deliberately the same
// on every tool so a client that shows one tool shows the limits.
export const NOT_FOR_NAVIGATION =
  'Not for navigation. ' +
  'Coverage: COLREGS Part C lights only, international (high seas) text only, ' +
  'lights at night only (no day shapes, no sound signals, no Part B steering rules), ' +
  'evaluated against pre-release colregs data (0.x), whose content is still being ' +
  'checked. Every entry id and paragraph cite in a response is verbatim from the ' +
  'colregs data package; nothing is paraphrased. This tool surface is a 0.0.x ' +
  'preview and will change without notice.';

// Server-level instructions. Clients put this in the model's context for the
// whole session, so it says only what no tool description already says.
export const INSTRUCTIONS =
  NOT_FOR_NAVIGATION +
  '\n\n' +
  'When signals.lawful_displays.count is greater than 1, every option is equally lawful and ' +
  'the answer is all of them. Quote rule text from cited_paragraphs or rule_text, ' +
  'never from memory.';

const PLURAL_ANSWER =
  'A fact record describes a situation, not a fitted vessel: colregs data/facts.json ' +
  'has no equipment fact, so nothing in the input can settle a choice the Rules leave ' +
  'to how the vessel is fitted or what the skipper elects, such as Rule 25(b), the ' +
  'combined masthead lantern a sailing vessel under 20 m may carry, against Rule 25(c), ' +
  'the all-round red over green she may add. When lawful_displays.count is greater than 1, ' +
  'every option is equally lawful, the correct report is all of them, and reporting any ' +
  'one as "the" display for this vessel is wrong. Displays are listed in the order to ' +
  'consider the rules in, most specific concession first, and the first is the one a ' +
  'vessel of that description usually shows. Each option numbers itself "n of count", ' +
  'names the choice entries that distinguish it (chosen) and lists its lights with their ' +
  'own modality, so "shall" and "may" lights in one display are never merged.';

const CHECK_VERSIONS = (): void => {
  // rule_text and light read this package's colregs; evaluate reads the
  // engine's. They dedupe to one copy under a compatible range, but a
  // split install would cite paragraphs from one release against entries
  // from another and nothing in a response could show it.
  const engineSees = evaluate({ self: { fact: {} } }).signals?.colregs.version;
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
    shape[key] = withNote(
      z.boolean().optional(),
      undefined,
      [f.refines && `Refines ${f.refines}.`, f.note].filter(Boolean).join(' '),
    );
  }
  for (const [key, f] of Object.entries(factsData.numerics)) {
    shape[key] = withNote(
      z.number().optional(),
      f.cite,
      [f.unit && `Unit: ${f.unit}.`, f.note].filter(Boolean).join(' '),
    );
  }
  for (const [key, f] of Object.entries(factsData.booleans)) {
    shape[key] = withNote(z.boolean().optional(), f.cite, f.note);
  }
  return z.object(shape).strict();
}

// Input for `evaluate`: a Circumstances record as colregs-engine's unified
// evaluate reads it (curia colregs-domain-model). kin/geo/act/hist/env key
// sets are compile-time only in colregs-engine, unlike facts.json, so those
// are open records, not generated like factRecordSchema.
const namespacedRecord = (prefix: string, note: string) =>
  z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .describe(`Keys namespaced \`${prefix}:*\` per colregs-engine. ${note}`);

function vesselSchema() {
  return z
    .object({
      fact: z.lazy(() => factRecordSchema()).describe('What this vessel is and is doing.'),
      kin: namespacedRecord(
        'kin',
        'Absolute kinematic state (position, heading, speed, dynamics).',
      ),
      geo: namespacedRecord(
        'geo',
        'Geometry measured from her own frame (relative bearing, windward).',
      ),
      act: namespacedRecord('act', 'What she is doing or intending now, stated, never derived.'),
      hist: namespacedRecord('hist', 'What has already been true and latches.'),
    })
    .strict();
}

function otherSchema() {
  return z
    .object({
      known: z
        .enum(['in-sight', 'radar-alone', 'heard'])
        .describe(
          'How self knows of her: Rule 11 in sight, Rule 19(d) by radar alone, Rule 19(e) heard.',
        ),
      bearing_deg: z.number().optional().describe("Her bearing relative to self's heading."),
      range_nm: z.number().optional().describe('Her range from self, nautical miles.'),
      fact: z
        .lazy(() => factRecordSchema())
        .optional()
        .describe('What she is, as asserted by the caller.'),
      observed: z
        .object({
          lights: z.array(z.string()).optional(),
          shapes: z.array(z.string()).optional(),
          sounds: z.array(z.string()).optional(),
        })
        .strict()
        .optional()
        .describe(
          'What self sees or hears of her: light, shape and sound ids, never what she exhibits.',
        ),
      kin: namespacedRecord('kin', 'Her absolute kinematic state.'),
      geo: namespacedRecord('geo', 'Pairwise geometry about her (CPA, TCPA, risk_of_collision).'),
      act: namespacedRecord('act', 'What she is doing or intending now.'),
      hist: namespacedRecord('hist', 'What has already been true of her and latches.'),
    })
    .strict();
}

function circumstancesSchema() {
  return z
    .object({
      self: vesselSchema()
        .optional()
        .describe('The vessel whose obligations and signals are read.'),
      others: z
        .array(otherSchema())
        .optional()
        .describe('The other vessels, each as self knows her.'),
      conditions: namespacedRecord('env', 'The water: narrow channel, traffic lane.'),
    })
    .strict();
}

// First field of every response, success or error. Descriptions are read once
// at connect time; the response is what a model has in front of it when it answers.
export const RESPONSE_WARNING =
  'Not for navigation. COLREGS Part C lights only, international text only, night only, ' +
  'evaluated against pre-release colregs data (0.x). Do not use this to decide what to ' +
  'show or what you are looking at on the water.';

const json = (value: unknown): CallToolResult => {
  const body = { warning: RESPONSE_WARNING, ...(value as Record<string, unknown>) };
  return {
    content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
    structuredContent: body,
  };
};

const failure = (message: string, detail?: Record<string, unknown>): CallToolResult => ({
  isError: true,
  content: [
    {
      type: 'text',
      text: JSON.stringify({ warning: RESPONSE_WARNING, error: message, ...detail }, null, 2),
    },
  ],
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
  const server = new McpServer(
    { name: 'colregs-mcp', version: VERSION },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    'evaluate',
    {
      title: 'Evaluate the circumstances',
      description:
        'One evaluation of the circumstances one vessel is in, under the COLREGS, with ' +
        'three readings. signals: every complete, lawful set of navigation lights self ' +
        'may show, from her fact record (propulsion, activity, position, length, and the ' +
        'other facts in colregs data/facts.json): the applied entries; exempted (relieved ' +
        "by a rel:exempts entry) and overridden (displaced by a superior obligation's " +
        'rel:overrides) entries, each with the entry that did it; and lawful_displays: ' +
        '{count, relation, options}. relation is "none", "exactly_one" or "any_one_of". ' +
        PLURAL_ANSWER +
        ' optional_additions are lawful extras (relation any_subset_of) that do not ' +
        'multiply the display set. Every id carries its paragraph cite, and ' +
        'cited_paragraphs holds the verbatim text of every cited paragraph. ' +
        'appraisal: what Part B requires of self on her own, then against each other ' +
        "vessel (kind of encounter, risk of collision, each vessel's role). indicated: " +
        'per other vessel, what her observed lights, shapes and sounds say she could be. ' +
        'appraisal and indicated are passed through from colregs-engine as returned, ' +
        'without the cite resolution signals has. Compliance over time is not read yet. ' +
        NOT_FOR_NAVIGATION,
      inputSchema: { circumstances: circumstancesSchema() },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ circumstances }) =>
      withEngine(() => {
        const c = circumstances as Circumstances;
        const ev = evaluate(c);
        const signals = ev.signals;
        return {
          colregs: { version: COLREGS_VERSION, source: 'resolved' },
          circumstances: c,
          appraisal: ev.appraisal,
          signals: signals && shapeEvaluation(c.self?.fact as FactRecord, signals),
          indicated: ev.indicated,
        };
      }),
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
      inputSchema: {
        cite: z
          .string()
          .describe('Paragraph path, rule number or range, e.g. "25(b)", "25", "24(a)(ii)-(iv)".'),
      },
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
          return {
            cite: k,
            rule: p.rule,
            rule_title: p.rule_title,
            jurisdiction: p.jurisdiction,
            text: p.text,
          };
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
        'placement. Ids are the light ids that evaluate returns in signals, such as ' +
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
