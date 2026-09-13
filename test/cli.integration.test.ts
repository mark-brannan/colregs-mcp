// The only test that exercises what a client actually runs: the built
// `dist/cli.js`, spawned as its own process, spoken to over real stdio.
//
// Everything in examples.test.ts connects through InMemoryTransport against
// `src/`, which is the right shape for asserting response content and is
// blind to a whole class of failure that only appears after the build: a bad
// import specifier in the emitted ESM, a missing file in `files`, a data
// package that resolves from the repo but not from an install, a shebang or
// executable bit that never made it. nav-wright shipped exactly that bug in
// its 0.1.0 -- typecheck, tests and build all green, and the published
// package would not load.
//
// It builds first rather than assuming a fresh `dist`, so the test is true
// whatever order the scripts ran in.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SLOOP } from './helpers.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

let client: Client;

beforeAll(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
  expect(existsSync(cli)).toBe(true);
  client = new Client({ name: 'integration', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli], stderr: 'pipe' }));
}, 60_000);

afterAll(async () => {
  await client?.close();
});

const callCli = async (name: string, args: Record<string, unknown>) => {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as { type: string; text: string }[]).find((c) => c.type === 'text')?.text ?? '';
  return { isError: res.isError === true, body: JSON.parse(text) as Record<string, unknown> };
};

describe('the built CLI over real stdio', () => {
  it('loads, handshakes and reports its four tools', async () => {
    expect(client.getServerVersion()?.name).toBe('colregs-mcp');
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['applied_entries', 'evaluate_display', 'light', 'rule_text']);
  });

  it('answers from the packaged colregs data, not just from src', async () => {
    // Three lawful displays for the sloop: the property the package exists
    // for, reached through the artifact a consumer installs.
    const { isError, body } = await callCli('evaluate_display', { facts: SLOOP });
    expect(isError).toBe(false);
    expect((body.lawful_displays as { count: number }).count).toBe(3);
    expect(Object.keys(body.cited_paragraphs as object).length).toBeGreaterThan(0);
  });

  it('reports an input outside the vocabulary as an error, not an empty answer', async () => {
    const { isError } = await callCli('rule_text', { cite: 'not-a-cite' });
    expect(isError).toBe(true);
  });
});
