#!/usr/bin/env node
// stdio transport. This is the whole executable: `colregs-mcp` on the
// command line, or `node dist/cli.js`, speaks MCP on stdin/stdout.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.js';

const server = createServer();
await server.connect(new StdioServerTransport());
