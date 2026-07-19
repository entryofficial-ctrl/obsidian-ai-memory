# obsidian-ai-memory

Obsidian Vault 하나를 **여러 AI(Claude Desktop, Claude Code, Codex)가 함께 쓰는 장기기억**으로 만드는 로컬 MCP 서버 + 볼트 템플릿.

벡터 DB 없이 마크다운과 검색만으로 동작하는 로컬 RAG입니다. 모델을 재학습하는 게 아니라, 질문할 때 관련 문서만 검색해 문맥으로 쓰고, 의미 있는 작업이 끝나면 구조화된 요약을 남깁니다.

## 무엇이 들어있나

**`vault-starter/`** — 새 볼트에 통째로 복사하는 시작 구조:

- `.system/` — 로컬 stdio MCP 서버(Node), 자동 캡처 훅, 헬스체크·임포트 스크립트
  - MCP 도구 5종: `memory_search` / `memory_read` / `memory_record` / `memory_upsert` / `memory_status`
  - 쓰기 시 비밀정보(키·토큰·비밀번호 형태) 자동 마스킹
  - 종료 훅: 대화 요약 자동 저장(`_inbox/auto/`) + 볼트 로컬 git 자동 커밋
- `_index.md` — 모든 세션의 시작점이 되는 루트 인덱스
- `CLAUDE.md` / `AGENTS.md` — 볼트를 읽는 모든 AI가 따르는 공용 규칙 (검색 먼저, 작업 후 기록, 비밀정보 금지, 단일 기억 원칙)
- `projects/` 구조 — 프로젝트별 `current-state` / `decisions` / `runbook` / `incidents` / `sessions`
- `active-priorities.md` — 프로젝트 횡단 열린 작업 단일 큐
- `_jobs/` + `Templates/job.md` — 반복 작업 마스터 노트(절차 + 품질 기준 + 교정 누적 Lessons)
- `Templates/` — Obsidian용 문서 양식

## 가장 쉬운 시작 — 클로드한테 시키기

Claude Code(터미널 `claude` 또는 Claude Desktop의 Code 탭)가 있다면 직접 할 것 없이 **[INSTALL-WITH-AI.md](INSTALL-WITH-AI.md) 내용을 통째로 붙여넣고 "실행해줘"** 라고 하세요. AI가 환경 확인 → 볼트 구축 → MCP 연결 → 검증까지 물어가며 진행합니다.

일반 채팅(claude.ai 웹, Desktop의 Chat 탭)은 터미널이 없어서 실행은 못 하고, 아래 수동 절차를 안내받는 용도로만 쓸 수 있습니다.

## 빠른 시작 (수동)

```bash
# 1. 볼트 폴더를 만들고 스타터를 복사
mkdir -p ~/Documents/AI-Memory
cp -R vault-starter/ ~/Documents/AI-Memory/

# 2. MCP 서버 의존성 설치 + 점검
cd ~/Documents/AI-Memory/.system
npm install
npm run healthcheck

# 3. 볼트를 git으로 초기화 (훅이 자동 커밋에 사용)
cd ~/Documents/AI-Memory && git init

# 4. Obsidian에서 "Open folder as vault"로 이 폴더를 연다
```

그다음 쓰는 AI에 MCP 서버를 등록합니다 — 자세한 방법과 훅 연결은 **[SETUP.md](SETUP.md)** 참고.

```jsonc
// 예: Claude Desktop — ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "ai_memory": {
      "type": "stdio",
      "command": "node",
      "args": ["/절대경로/AI-Memory/.system/mcp/server.mjs"],
      "env": { "AI_MEMORY_HOME": "/절대경로/AI-Memory" }
    }
  }
}
```

## 동작 흐름

1. 과거 작업 질문 → AI가 `memory_search`로 관련 문서만 찾아 읽는다 (볼트 전체를 넣지 않는다)
2. 기억은 과거 문맥일 뿐 — 바뀔 수 있는 상태는 코드·git·로그·실제 시스템에서 재검증
3. 의미 있는 작업이 끝나면 `memory_record`가 `projects/<p>/sessions/`에 요약을 남긴다
4. 지속 상태가 바뀌면 `memory_upsert`로 `current-state`/`runbook`/`decisions`를 갱신
5. 종료 훅이 대화를 `_inbox/auto/`에 백업하고 볼트를 git에 커밋

## 안전 원칙

비밀번호, API 키, 토큰, 쿠키, 개인키, `.env` 전체 내용은 **저장하지 않습니다**. 쓰기 경로에 비밀정보 형태 자동 마스킹이 걸려 있고, 대신 환경변수 이름·파일 경로·오류 문자열·해결 명령만 기록합니다.

## License

MIT
