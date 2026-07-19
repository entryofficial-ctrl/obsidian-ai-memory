# AI 실행형 설치 지시서

**사용자에게:** 이 파일 전체를 복사해서 **Claude Code**(터미널 `claude`, 또는 Claude Desktop의 Code 탭)에 붙여넣고 "실행해줘"라고 하세요. 파일 시스템과 터미널이 없는 일반 채팅(claude.ai 웹, Desktop Chat 탭)에서는 실행이 안 되고 안내만 받을 수 있습니다.

---

**AI에게:** 너는 지금 설치 지시서를 읽고 있다. 이 문서를 요약하거나 설명하지 말고, 아래 단계를 순서대로 실행하라. 각 단계가 끝날 때마다 결과를 한 줄로 보고하라.

## 원칙 (전 단계 공통)

- 기존 파일을 덮어쓰기 전에 반드시 백업하고 사용자에게 알린다.
- 설정 파일(JSON/TOML)은 통째로 교체하지 말고 필요한 항목만 병합한다.
- 비밀번호·API 키·토큰은 읽지도, 쓰지도, 어디에도 남기지도 않는다.
- 실패한 단계는 원인을 보고하고 사용자의 지시를 기다린다. 조용히 건너뛰지 않는다.

## Phase 0 — 환경 확인

1. `node --version` 실행. 실패하면: 사용자에게 [nodejs.org](https://nodejs.org)에서 LTS 설치를 요청하고 여기서 멈춘다 (Homebrew가 있으면 `brew install node`를 제안해도 된다).
2. 이 저장소가 로컬에 있는지 확인한다. 없으면 `git clone https://github.com/entryofficial-ctrl/obsidian-ai-memory` (git이 없으면 ZIP 다운로드를 안내).
3. Obsidian 설치 여부를 확인한다 (`ls /Applications/Obsidian.app`). 없으면 설치를 권하되, 볼트 구축 자체는 Obsidian 없이도 진행 가능하므로 계속한다.

## Phase 1 — 사용자 확인 (반드시 답을 기다린 뒤 진행)

1. 볼트를 만들 경로를 묻는다. 기본 제안: `~/Documents/AI-Memory`.
2. 그 경로가 이미 존재하고 내용이 있으면: 절대 덮어쓰지 말고, 기존 내용을 보고한 뒤 (a) 다른 경로 (b) 수동 병합 중에서 고르게 한다.
3. 어떤 AI 제품을 연결할지 묻는다: Claude Desktop Chat 탭 / Claude Code / Codex (복수 선택 가능).

## Phase 2 — 볼트 구축

```bash
mkdir -p <VAULT>
cp -R <저장소>/vault-starter/. <VAULT>/
cd <VAULT>/.system && npm install
npm run healthcheck        # JSON이 출력되면 정상
cd <VAULT> && git init     # 훅의 자동 커밋용
```

healthcheck가 실패하면 오류를 보고하고 멈춘다.

## Phase 3 — 선택한 제품 연결

**Claude Desktop (Chat 탭)** — `~/Library/Application Support/Claude/claude_desktop_config.json` (Windows: `%APPDATA%\Claude\claude_desktop_config.json`)을 백업 후, `mcpServers`에 아래 항목만 병합한다:

```json
"ai_memory": {
  "type": "stdio",
  "command": "node",
  "args": ["<VAULT>/.system/mcp/server.mjs"],
  "env": { "AI_MEMORY_HOME": "<VAULT>" }
}
```

병합 후 사용자에게 앱 완전 종료(Cmd+Q) 후 재실행을 요청한다.

**Claude Code** — 다음을 실행한다:

```bash
claude mcp add ai_memory --scope user --env AI_MEMORY_HOME=<VAULT> -- node <VAULT>/.system/mcp/server.mjs
claude mcp list
```

그리고 `~/.claude/CLAUDE.md`에 `<VAULT>/CLAUDE.md`의 규칙 블록이 없으면 추가한다(있으면 건너뛴다). 훅 연결을 원하는지 물어보고, 원하면 SETUP.md 5절의 hooks 설정을 `~/.claude/settings.json`에 병합한다.

**Codex** — `~/.codex/config.toml`에 SETUP.md 6절의 `[mcp_servers.ai_memory]` 블록을 병합한다.

## Phase 4 — 검증과 마무리

1. `cd <VAULT>/.system && npm run healthcheck` 를 다시 실행해 최종 확인.
2. 사용자에게 시험 문장을 알려준다: 연결한 AI에서 *"AI-Memory에서 볼트 구축 방법을 찾아 요약해줘"* — 검색 결과가 돌아오면 성공.
3. 기존 Claude Code 메모(`~/.claude/projects/*/memory/`)가 있으면 `npm run import-claude`로 가져올지 물어본다. 가져온 뒤에는 SETUP.md 7절의 단일 기억 원칙(MEMORY.md 리다이렉트)을 제안한다 — 원본 삭제는 절대 하지 않는다.
4. 만든 것 전체를 요약 보고하고, Obsidian에서 "Open folder as vault"로 `<VAULT>`를 열도록 안내한다.
