import { syncClaudeMemories } from '../mcp/lib.mjs';

const result = await syncClaudeMemories();
process.stdout.write(JSON.stringify(result, null, 2) + '\n');

