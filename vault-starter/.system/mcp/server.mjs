import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  memoryStatus,
  readVaultFile,
  recordMemory,
  searchMemory,
  writeVaultFile
} from './lib.mjs';

const server = new McpServer(
  {
    name: 'ai-memory',
    version: '1.0.0'
  },
  {
    instructions: [
      'Use memory_search before answering questions about prior development work, servers, deployments, incidents, or project decisions.',
      'Treat memory as historical context and verify current code, logs, Git, or live systems when facts may have changed.',
      'After meaningful work, call memory_record with a concise reusable summary.',
      'Use memory_upsert for durable current-state, runbook, decisions, or incident documents.',
      'Never store passwords, API keys, tokens, cookies, private keys, or full environment files.'
    ].join(' ')
  }
);

function textResult(value) {
  return {
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      }
    ]
  };
}

server.registerTool(
  'memory_status',
  {
    title: 'AI Memory Status',
    description: 'Show the AI-Memory vault path, file counts, import state, and safety behavior.',
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async function () {
    return textResult(await memoryStatus());
  }
);

server.registerTool(
  'memory_search',
  {
    title: 'Search AI Memory',
    description: 'Search durable project notes, server runbooks, prior task summaries, incidents, and imported Claude memories. Call this before relying on remembered project history.',
    inputSchema: {
      query: z.string().min(2).describe('Natural-language search query, error text, command, server name, or project topic.'),
      project: z.string().optional().describe('Current project or repository name, when known.'),
      limit: z.number().int().min(1).max(20).optional().default(8)
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async function (input) {
    const matches = await searchMemory(input.query, {
      project: input.project,
      limit: input.limit
    });
    return textResult({ query: input.query, project: input.project || null, matches: matches });
  }
);

server.registerTool(
  'memory_read',
  {
    title: 'Read AI Memory',
    description: 'Read one Markdown document returned by memory_search.',
    inputSchema: {
      path: z.string().min(1).describe('Vault-relative Markdown path.')
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async function (input) {
    const content = await readVaultFile(input.path);
    return textResult({ path: input.path, content: content.slice(0, 50000) });
  }
);

server.registerTool(
  'memory_upsert',
  {
    title: 'Update AI Memory',
    description: 'Create, replace, or append to a durable Markdown document. Secret-like values are redacted automatically.',
    inputSchema: {
      path: z.string().min(1).describe('Vault-relative Markdown path such as projects/my-app/runbook.md.'),
      content: z.string().min(1).describe('Markdown content without secrets.'),
      mode: z.enum(['replace', 'append']).optional().default('replace')
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false
    }
  },
  async function (input) {
    return textResult(await writeVaultFile(input.path, input.content, input.mode));
  }
);

server.registerTool(
  'memory_record',
  {
    title: 'Record Completed Work',
    description: 'Store a structured reusable summary after meaningful development, server, deployment, debugging, or decision work. Secret-like values are redacted automatically.',
    inputSchema: {
      project: z.string().min(1).describe('Project or repository name.'),
      title: z.string().min(2).describe('Short task title.'),
      summary: z.string().min(2).describe('What was accomplished and the resulting state.'),
      provider: z.string().optional().describe('codex, claude, chatgpt, or another source.'),
      changes: z.array(z.string()).optional().default([]),
      commands: z.array(z.string()).optional().default([]),
      decisions: z.array(z.string()).optional().default([]),
      followUps: z.array(z.string()).optional().default([]),
      sources: z.array(z.string()).optional().default([])
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false
    }
  },
  async function (input) {
    return textResult(await recordMemory(input));
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

process.on('SIGINT', async function () {
  await server.close();
  process.exit(0);
});

