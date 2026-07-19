---
type: imports-guide
status: active
updated: 2026-07-14
tags:
  - area/ai-memory
  - type/imports-guide
---

# Imports

외부 또는 기존 도구에서 가져온 메모를 보관하는 공간입니다.

## 폴더

- `claude`: 기존 Claude 자동 메모를 `imports/claude`에 비밀정보 제거 후 가져온 사본.

## 사용 원칙

- imports 문서는 과거 맥락입니다. 현재 상태나 결정의 기준 문서는 `projects/*` 아래에 둡니다.
- imports 내용이 여전히 유효하면 `current-state`, `runbook`, `decisions`로 요약 승격합니다.
- 서로 충돌하는 기록이 있으면 최신 코드/서버/설정 확인 결과를 우선합니다.
