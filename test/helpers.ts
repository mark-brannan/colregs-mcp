import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/server.js';

/** A connected client over an in-memory pair, so tests exercise the real
 * tool registrations and the JSON that actually leaves the server. */
export async function connect(): Promise<Client> {
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverT);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientT);
  return client;
}

export async function call(client: Client, name: string, args: Record<string, unknown>) {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as { type: string; text: string }[]).find((c) => c.type === 'text')?.text ?? '';
  return { isError: res.isError === true, body: JSON.parse(text), structured: res.structuredContent };
}

export const SLOOP = {
  'fact:propulsion': 'propulsion:sail',
  'fact:activity': 'activity:none',
  'fact:position': 'position:underway',
  'fact:length_m': 11.6,
};

export const FISHING_AGROUND = {
  'fact:propulsion': 'propulsion:power',
  'fact:activity': 'activity:fishing',
  'fact:position': 'position:aground',
  'fact:length_m': 30,
};
