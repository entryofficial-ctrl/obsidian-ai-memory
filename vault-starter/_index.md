---
type: vault-index
status: active
tags:
  - area/ai-memory
  - type/vault-index
---

# AI Memory Index

여러 AI(Claude, Codex 등)가 함께 쓰는 Obsidian 기반 장기기억 Vault입니다.
과거 작업을 찾을 때는 이 문서를 시작점으로 보고, 실제 코드/서버 상태는 항상 현재 상태로 다시 확인합니다.

## 바로가기

### 운영 문서

- [[CLAUDE|Vault 사용 규칙 (Claude)]]
- [[active-priorities|열린 작업 큐 (Active Priorities)]]
- [[_jobs/README|반복 작업 마스터 노트 (Jobs)]]
- [[_maps/README|주제별 지도]]
- [[projects/README|프로젝트 목록]]
- [[_inbox/README|자동 수집함 정리 규칙]]
- [[imports/README|가져온 메모]]

## 현재 핵심 상태

- (이 볼트의 지금 가장 중요한 사실을 3~5줄로 유지한다. AI가 세션 시작 시 여기서 방향을 잡는다.)

## 최근 기록

<!-- AUTO-RECENT:START -->
<!-- AUTO-RECENT:END -->

## 정리 규칙

- `projects/<name>/current-state.md`: 지금 상태와 다음 작업.
- `projects/<name>/decisions.md`: 오래 남길 결정.
- `projects/<name>/runbook.md`: 실행/배포/복구 절차.
- `projects/<name>/incidents.md`: 오류, 원인, 해결, 검증.
- `projects/<name>/sessions/*.md`: 의미 있는 작업 단위 요약.
- `_inbox/auto/*.md`: 자동 저장 원본. 정리 전까지 보존한다.
- `imports/*`: 외부에서 가져온 메모. 새 결정의 기준 문서는 `projects/*` 쪽에 둔다.
