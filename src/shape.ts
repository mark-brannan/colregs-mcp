// Response shapes. This is the package: the engine already answers
// correctly, and the only work here is making that answer survive being read
// by a language model. Three properties are protected.
//
//  1. Every entry id travels with its paragraph cite, and every cite
//     resolves to verbatim text in `cited_paragraphs`. Nothing here is prose
//     of this package's own that could be paraphrased into a recommendation.
//  2. Modality survives per light. `shall` and `may` on two lights in one
//     display are different obligations, and the flat engine field is kept
//     next to each light rather than summarised.
//  3. A plural result is structurally plural. `lawful_displays` is an object
//     whose first fields are `count` and `relation`, and the displays are
//     `options`, each numbered `n of count`. There is no top-level `lights`
//     to read as "the answer".

import type { DisplayEvaluation, DisplayLight, FactRecord } from 'colregs-engine';

import { COLREGS_VERSION, MODALITY_KEY, citeOf, citedParagraphs, lights } from './data.js';

export interface Cited {
  id: string;
  cite: string;
}

export interface CitedModal extends Cited {
  modality: string;
}

export interface CitedBy extends Cited {
  by: Cited;
}

export interface ShapedLight {
  light: string;
  /** Name from lights.json, when the id is known there. */
  name?: string;
  /** Any further fields of the entry's light spec, verbatim (color, count,
   * combined, position, arrangement, ...). */
  [spec: string]: unknown;
  modality: string;
  prescribed_by: Cited;
  via?: Cited;
}

export interface DisplayOption {
  option: number;
  of: number;
  /** The choice entries that distinguish this option from its siblings. */
  chosen: CitedModal[];
  entries: CitedModal[];
  lights: ShapedLight[];
}

export type DisplayRelation = 'none' | 'exactly_one' | 'any_one_of';

export interface EvaluateDisplayResponse {
  colregs: { version: string; source: 'resolved' | 'caller' };
  facts: FactRecord;
  applied: CitedModal[];
  exempted: CitedBy[];
  excluded: CitedBy[];
  /** Applied entries displaced by a superior applied obligation's
   * rel:overrides, with the overriding id (colregs-engine#36). Kept apart
   * from `excluded` rather than merged into it: `excluded` is barred by a
   * rel:excludes constraint, `overridden` is displaced by a rel:overrides
   * obligation — different mechanisms, so a reader can tell which one
   * removed the entry without inspecting `by`. */
  overridden: CitedBy[];
  lawful_displays: {
    count: number;
    relation: DisplayRelation;
    options: DisplayOption[];
  };
  optional_additions: {
    relation: 'any_subset_of';
    items: { id: string; cite: string; via?: Cited; lights: ShapedLight[] }[];
  };
  modality_key: Record<string, string>;
  cited_paragraphs: Record<string, string | null>;
}

const cited = (id: string): Cited => ({ id, cite: citeOf(id) });

function shapeLight(l: DisplayLight, modalities: Record<string, string>): ShapedLight {
  const { light, ...rest } = l.spec as { light: string } & Record<string, unknown>;
  const def = lights.lights[light];
  const out: ShapedLight = {
    light,
    ...(def && typeof def.name === 'string' ? { name: def.name } : {}),
    ...rest,
    modality: l.modality ?? modalities[l.sourceEntry],
    prescribed_by: cited(l.sourceEntry),
  };
  if (l.via) out.via = cited(l.via);
  return out;
}

export function shapeEvaluation(facts: FactRecord, ev: DisplayEvaluation): EvaluateDisplayResponse {
  const modal = (id: string): CitedModal => ({ ...cited(id), modality: ev.modalities[id] });
  const count = ev.displays.length;
  const relation: DisplayRelation = count === 0 ? 'none' : count === 1 ? 'exactly_one' : 'any_one_of';

  const options: DisplayOption[] = ev.displays.map((d, i) => ({
    option: i + 1,
    of: count,
    chosen: d.chosen.map(modal),
    entries: d.entries.map(modal),
    lights: d.lights.map((l) => shapeLight(l, ev.modalities)),
  }));

  const additions = ev.optionalAdditions.map((a) => ({
    id: a.id,
    cite: a.cite,
    ...(a.via ? { via: cited(a.via) } : {}),
    lights: a.lights.map((l) => shapeLight(l, ev.modalities)),
  }));

  const cites = new Set<string>();
  for (const id of ev.applied) cites.add(citeOf(id));
  for (const x of [...ev.exempted, ...ev.excluded, ...ev.overridden]) {
    cites.add(citeOf(x.id));
    cites.add(citeOf(x.by));
  }
  for (const o of options) for (const l of o.lights) {
    cites.add(l.prescribed_by.cite);
    if (l.via) cites.add(l.via.cite);
  }
  for (const a of additions) cites.add(a.cite);

  const usedModalities = new Set<string>(Object.values(ev.modalities));
  for (const o of options) for (const l of o.lights) usedModalities.add(l.modality);
  const modality_key: Record<string, string> = {};
  for (const m of Object.keys(MODALITY_KEY)) if (usedModalities.has(m)) modality_key[m] = MODALITY_KEY[m];

  return {
    colregs: ev.colregs,
    facts,
    applied: ev.applied.map(modal),
    exempted: ev.exempted.map((x) => ({ ...cited(x.id), by: cited(x.by) })),
    excluded: ev.excluded.map((x) => ({ ...cited(x.id), by: cited(x.by) })),
    overridden: ev.overridden.map((x) => ({ ...cited(x.id), by: cited(x.by) })),
    lawful_displays: { count, relation, options },
    optional_additions: { relation: 'any_subset_of', items: additions },
    modality_key,
    cited_paragraphs: citedParagraphs(cites),
  };
}

export interface AppliedEntriesResponse {
  colregs: { version: string; source: 'resolved' };
  facts: FactRecord;
  applied: Cited[];
}

export function shapeApplied(facts: FactRecord, ids: string[]): AppliedEntriesResponse {
  // The server never passes opts.data to the engine, so the data is the
  // engine's own resolved release by construction; the version is checked
  // against this package's copy at startup (server.ts).
  return { colregs: { version: COLREGS_VERSION, source: 'resolved' }, facts, applied: ids.map(cited) };
}
