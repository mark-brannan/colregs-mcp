// The colregs data files this server reads directly: rules.json (verbatim
// paragraph text), lights.json (light definitions) and the parts of
// facts.json and applicability.json needed to describe inputs and cite
// entries. The engine reads applicability.json itself; nothing here
// re-evaluates anything.
//
// Read through createRequire rather than `import ... with { type: 'json' }`
// so the build has no opinion about import attributes across Node versions.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface Paragraph {
  path: string;
  rule: string;
  rule_title: string;
  jurisdiction: string;
  text: string;
}

export interface RulesData {
  source: string;
  source_url: string;
  retrieved: string;
  note: string;
  gaps: { path: string; reason: string }[];
  paragraphs: Record<string, Paragraph>;
}

export interface LightsData {
  jurisdiction: string;
  bearing_convention: Record<string, string>;
  lights: Record<string, Record<string, unknown>>;
}

interface FactAxis {
  values: string[];
  cites?: Record<string, string>;
  note?: string;
}
interface FactField {
  type?: string;
  unit?: string;
  cite?: string;
  note?: string;
  refines?: string;
}

export interface FactsData {
  axes: Record<string, FactAxis>;
  modifiers: Record<string, FactField>;
  numerics: Record<string, FactField>;
  booleans: Record<string, FactField>;
}

interface ApplicabilityData {
  modalities: Record<string, string>;
  entries: { id: string; cite: string }[];
}

export const rules = require('colregs/data/rules.json') as RulesData;
export const lights = require('colregs/data/lights.json') as LightsData;
export const facts = require('colregs/data/facts.json') as FactsData;
const applicability = require('colregs/data/applicability.json') as ApplicabilityData;

/** The colregs release this package resolved for rules/lights/facts. The
 * engine reports its own; server.ts refuses to start if the two differ. */
export const COLREGS_VERSION: string = (
  require('colregs/package.json') as { version: string }
).version;

/** Verbatim modality glossary from applicability.json. */
export const MODALITY_KEY: Record<string, string> = applicability.modalities;

const CITE_BY_ENTRY = new Map(applicability.entries.map((e) => [e.id, e.cite]));

/** The paragraph an applicability entry cites, or the id itself when the
 * engine reports an id the data does not carry (it should not). */
export function citeOf(entryId: string): string {
  return CITE_BY_ENTRY.get(entryId) ?? entryId;
}

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];

/**
 * Paragraph keys a cite denotes. A cite is usually one paragraph path
 * (`26(c)(i)`); a bare rule number (`25`) denotes every paragraph of that
 * rule; a range of sub-paragraphs (`24(a)(ii)-(iv)`, as some applicability
 * entries cite) expands to each member. Unknown cites return [].
 */
export function paragraphKeys(cite: string): string[] {
  const c = cite.trim();
  if (c in rules.paragraphs) return [c];
  if (/^\d+$/.test(c)) {
    return Object.keys(rules.paragraphs).filter((k) => rules.paragraphs[k].rule === c);
  }
  const range = /^(.*)\((\w+)\)-\((\w+)\)$/.exec(c);
  if (range) {
    const [, head, from, to] = range;
    const a = ROMAN.indexOf(from);
    const b = ROMAN.indexOf(to);
    if (a >= 0 && b >= a) {
      return ROMAN.slice(a, b + 1)
        .map((r) => `${head}(${r})`)
        .filter((k) => k in rules.paragraphs);
    }
  }
  return [];
}

/** Verbatim text for every paragraph a set of cites denotes; a cite that
 * resolves to nothing maps to null so the gap is visible, not silent. */
export function citedParagraphs(cites: Iterable<string>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const cite of new Set(cites)) {
    const keys = paragraphKeys(cite);
    if (keys.length === 0) {
      out[cite] = null;
      continue;
    }
    for (const k of keys) out[k] = rules.paragraphs[k].text;
  }
  return out;
}
