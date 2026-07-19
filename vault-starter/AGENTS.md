# Shared AI memory workflow

- Treat this vault as durable personal context, not as proof of current external state.
- Search the ai-memory MCP server before answering questions about prior development work, servers, deployments, incidents, or project decisions.
- After meaningful work, call memory_record with a concise reusable summary.
- Update current-state, runbook, decisions, or incidents with memory_upsert when durable facts changed.
- Never store passwords, API keys, tokens, cookies, private keys, or complete environment files.
- If memory conflicts with code, Git, logs, or a live system, verify the current state and then correct the memory.
- One memory, not two: Claude Code per-project memory files (`~/.claude/projects/*/memory/MEMORY.md`) are redirect pointers into this vault. Never store memories there; record here instead.
- Cross-project open work lives in `active-priorities.md` (vault root). Scan it when a session starts; add items when work parks, delete them when work truly finishes. Verify an item's real state before acting on it.
- Recurring tasks get a Job note (`_jobs/` or `projects/<p>/jobs/`, template `Templates/job.md`): boot chain + procedure + quality bar + Lessons. Explaining the same task a second time means create the Job; when the user corrects a Job's output, fold the lesson into that note in the same pass.
- Renaming a note outside the Obsidian app breaks `[[wikilinks]]` to it (only in-app renames auto-repair). Prefer in-app renames; after a direct file rename, find and fix every old reference.

