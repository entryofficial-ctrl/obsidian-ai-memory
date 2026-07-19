# 구축 가이드 — Obsidian + Claude + Codex 공용 AI-Memory

Obsidian Markdown Vault 하나를 여러 AI가 함께 사용하는 장기기억 저장소로 만듭니다. 아래에서 `<VAULT>`는 본인 볼트의 절대경로(예: `/Users/me/Documents/AI-Memory`)로 바꿔 읽으세요.

## 1. Obsidian Vault 준비

1. [Obsidian](https://obsidian.md)을 설치합니다.
2. 볼트 폴더를 만들고 이 저장소의 `vault-starter/` 내용을 통째로 복사합니다.
3. Obsidian에서 "Open folder as vault"로 그 폴더를 엽니다.
4. Settings → Files & Links → "Automatically update internal links"를 켭니다 (노트 이름 변경 시 위키링크 자동 수리).

## 2. 로컬 MCP 서버 준비

```bash
cd <VAULT>/.system
npm install
npm run healthcheck
```

제공 도구:

| 도구 | 역할 |
|---|---|
| `memory_status` | 볼트 경로·파일 수 확인 |
| `memory_search` | 관련 기억 검색 (프로젝트 가중치 포함) |
| `memory_read` | 검색된 마크다운 읽기 |
| `memory_upsert` | `current-state`, `runbook`, `decisions`, `incidents` 갱신 |
| `memory_record` | 작업 요약을 `projects/<p>/sessions/`에 구조화 저장 |

볼트 경로는 서버 위치에서 자동 추론되며, `AI_MEMORY_HOME` 환경변수로 명시할 수 있습니다.

## 3. 볼트 git 초기화

종료 훅이 변경분을 자동 커밋하므로 볼트를 git 저장소로 만들어 둡니다.

```bash
cd <VAULT> && git init
```

`.gitignore`에 최소한 `.obsidian/workspace*`, `.system/node_modules/`, `.system/logs/`, `.system/state/`, `.DS_Store`를 넣습니다.

## 4. Claude Desktop (일반 Chat 탭) 연결

`~/Library/Application Support/Claude/claude_desktop_config.json`의 `mcpServers`에 병합:

```json
{
  "mcpServers": {
    "ai_memory": {
      "type": "stdio",
      "command": "node",
      "args": ["<VAULT>/.system/mcp/server.mjs"],
      "env": { "AI_MEMORY_HOME": "<VAULT>" }
    }
  }
}
```

기존 서버가 있으면 `mcpServers` 전체를 덮어쓰지 말고 `ai_memory` 항목만 추가합니다. 앱을 완전히 종료(Cmd+Q) 후 다시 열고, 연결 로그를 확인합니다:

```bash
tail -100 ~/Library/Logs/Claude/mcp-server-ai_memory.log
```

Chat 탭은 로컬 훅을 실행하지 못하므로 도구 선택 기반의 반자동입니다. 꼭 남기고 싶은 결과는 "이 작업 결과를 AI-Memory에 기록해줘" 한 문장으로 기록됩니다.

## 5. Claude Code / Claude Desktop Code 탭 연결

Code 탭은 Claude Code와 같은 설정 체계를 씁니다.

```bash
claude mcp add ai_memory --scope user \
  --env AI_MEMORY_HOME=<VAULT> \
  -- node <VAULT>/.system/mcp/server.mjs
claude mcp list   # ai_memory 확인
```

전역 지침 `~/.claude/CLAUDE.md`에 `vault-starter/CLAUDE.md`와 같은 규칙(검색 먼저, 작업 후 기록, 비밀정보 금지)을 둡니다.

훅 연결 (`~/.claude/settings.json`): SessionStart / UserPromptSubmit / Stop 이벤트에 `.system/hooks/memory-hook.mjs`를 연결하면 시작 시 관련 문맥 로드, 프롬프트 기반 검색, 종료 시 자동 요약 + git 커밋이 됩니다.

```jsonc
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "node <VAULT>/.system/hooks/memory-hook.mjs claude" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node <VAULT>/.system/hooks/memory-hook.mjs claude" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "node <VAULT>/.system/hooks/memory-hook.mjs claude" }] }]
  }
}
```

## 6. Codex 연결

`~/.codex/config.toml`:

```toml
[mcp_servers.ai_memory]
command = "node"
args = ["<VAULT>/.system/mcp/server.mjs"]
env = { AI_MEMORY_HOME = "<VAULT>" }
```

전역 `AGENTS.md`에는 `vault-starter/AGENTS.md`와 같은 규칙을 둡니다. 확인:

```bash
/Applications/ChatGPT.app/Contents/Resources/codex mcp list
```

## 7. 기존 Claude 자동 메모 가져오기 (선택)

Claude Code를 써왔다면 `~/.claude/projects/*/memory/`의 기존 메모를 비밀정보 마스킹 후 `imports/claude/`로 가져올 수 있습니다.

```bash
cd <VAULT>/.system
npm run import-claude
```

**단일 기억 원칙**: 가져온 뒤에는 `~/.claude/projects/<p>/memory/MEMORY.md`를 "기억은 볼트에 있음" 리다이렉트 한 장으로 바꿔 두 기억이 갈라지는 것을 막습니다 (원본 토픽 파일 삭제는 본인이 직접).

## 8. 검증

```bash
cd <VAULT>/.system && npm run healthcheck
```

마지막으로 연결한 각 AI에서 이렇게 물어봅니다:

> AI-Memory에서 볼트 구축 방법을 먼저 찾아서 요약해줘.

검색 결과가 돌아오면 구축과 색인이 정상입니다.

## 9. 운영 규칙 요약

- 과거 작업 질문 → 답하기 전에 `memory_search`
- 기억은 과거 문맥 — 현재 상태는 코드·git·로그·실제 시스템으로 재검증
- 의미 있는 작업 후 `memory_record`, 지속 상태 변경 시 `memory_upsert`
- 반복 작업은 Job 노트로 (`_jobs/`, 교정받으면 Lessons에 접기)
- 열린 작업은 `active-priorities.md` 단일 큐로
- 비밀번호·키·토큰·쿠키·개인키·`.env` 전체는 절대 저장하지 않기
