import {
  autoCommitVault,
  captureHookResult,
  logHookError,
  projectStartupContext,
  promptSearchContext,
  syncClaudeMemories
} from '../mcp/lib.mjs';

const provider = process.argv[2] || 'llm';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function outputContext(eventName, context) {
  if (!context) {
    return;
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: context
    }
  }));
}

async function main() {
  const input = await readStdin();
  const eventName = String(input.hook_event_name || '');
  if (eventName === 'SessionStart') {
    await syncClaudeMemories();
    outputContext(eventName, await projectStartupContext(input.cwd));
    return;
  }
  if (eventName === 'UserPromptSubmit') {
    outputContext(eventName, await promptSearchContext(input.prompt || '', input.cwd));
    return;
  }
  if (eventName === 'Stop') {
    const capture = await captureHookResult(input, provider);
    await autoCommitVault('AI memory: ' + provider + ' session update');
  }
}

main().catch(async function (error) {
  try {
    await logHookError(error);
  } finally {
    process.exitCode = 0;
  }
});
