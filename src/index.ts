// colregs-mcp: a preview MCP server over colregs-engine.
//
// Public surface, such as it is at 0.0.x: createServer() for embedding or
// testing over any transport, plus the response shapes. The tool surface
// will change; the three response properties in shape.ts are what this
// package is for and will not.

export { createServer, NOT_FOR_NAVIGATION, VERSION } from './server.js';
export { shapeApplied, shapeEvaluation } from './shape.js';
export type {
  AppliedEntriesResponse,
  Cited,
  CitedBy,
  CitedModal,
  DisplayOption,
  DisplayRelation,
  EvaluateDisplayResponse,
  ShapedLight,
} from './shape.js';
