---
type: inbox-guide
status: active
updated: 2026-07-14
tags:
  - area/ai-memory
  - type/inbox-guide
---

# Inbox

`_inbox`는 자동 Hook이 남긴 원본성 기록을 보관하는 공간입니다.  
여기 있는 문서는 대화의 일부를 빠르게 저장한 것이므로, 장기 기준 문서로 바로 믿지 말고 필요한 내용만 프로젝트 문서로 승격합니다.

## 폴더

- `auto`: Codex/Claude 종료 Hook이 `_inbox/auto`에 자동 저장한 기록.

## 처리 기준

| 상태 | 처리 |
|---|---|
| 테스트/잡담 | 그대로 보관하거나 필요 없으면 나중에 정리 |
| 중요한 결정 | `projects/<project>/decisions.md`로 요약 |
| 현재 상태 변경 | `projects/<project>/current-state.md`에 반영 |
| 실행 절차 | `projects/<project>/runbook.md`로 이동/요약 |
| 장애/복구 | `projects/<project>/incidents.md` 또는 runbook에 반영 |
| 민감정보 포함 | 즉시 마스킹 또는 원본 폐기 후 재발급 |

## 주의

- API 키, 토큰, 웹훅 URL, 비밀번호, 쿠키, 개인키는 저장하지 않는다.
- 자동 수집 문서는 검색 참고용이다. 실제 코드/서버 상태는 다시 확인한다.
- 중요한 내용은 `_inbox`에만 두지 말고 프로젝트 문서로 승격한다.
