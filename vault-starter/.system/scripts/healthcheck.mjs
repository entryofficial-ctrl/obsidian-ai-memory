import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const vault = path.resolve(here, '..', '..');
const serverPath = path.join(vault, '.system', 'mcp', 'server.mjs');
const client = new Client(
  {
    name: 'ai-memory-healthcheck',
    version: '1.0.0'
  },
  {
    capabilities: {}
  }
);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env: Object.assign({}, process.env, { AI_MEMORY_HOME: vault })
});

await client.connect(transport);
const tools = await client.listTools();
const expected = ['memory_status', 'memory_search', 'memory_read', 'memory_upsert', 'memory_record'];
const names = tools.tools.map(function (tool) {
  return tool.name;
});
for (const name of expected) {
  if (!names.includes(name)) {
    throw new Error('Missing MCP tool: ' + name);
  }
}

const healthPath = '_inbox/healthcheck.md';
await client.callTool({
  name: 'memory_upsert',
  arguments: {
    path: healthPath,
    content: '# Healthcheck\n\nAI-Memory write test.',
    mode: 'replace'
  }
});
const readResult = await client.callTool({
  name: 'memory_read',
  arguments: { path: healthPath }
});
const serialized = JSON.stringify(readResult);
if (!serialized.includes('AI-Memory write test')) {
  throw new Error('MCP read/write verification failed.');
}
await unlink(path.join(vault, healthPath));

const searchResult = await client.callTool({
  name: 'memory_search',
  arguments: { query: '공용 AI-Memory', project: 'general', limit: 3 }
});
if (!JSON.stringify(searchResult).includes('matches')) {
  throw new Error('MCP search verification failed.');
}

const statusResult = await client.callTool({
  name: 'memory_status',
  arguments: {}
});
process.stdout.write(JSON.stringify({
  ok: true,
  tools: names,
  status: statusResult.content,
  search: searchResult.content
}, null, 2) + '\n');

await client.close();

