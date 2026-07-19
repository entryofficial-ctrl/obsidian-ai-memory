---
type: project-index
status: active
tags:
  - area/ai-memory
  - type/project-index
---

# Projects

프로젝트별 현재 상태, 결정, 실행 절차, 세션 기록을 모아둔 공간입니다.

프로젝트 폴더 구조 (문서는 [[Templates/project|템플릿]]으로 시작):

```
projects/<project>/
├── README.md          ← 프로젝트 한 줄 소개 + 문서 목록
├── current-state.md   ← 지금 유효한 구현·실행·배포 상태
├── decisions.md       ← 선택한 방법과 이유
├── runbook.md         ← 반복 가능한 실행/배포/복구 명령
├── incidents.md       ← 오류 문자열, 원인, 해결, 검증
├── jobs/              ← 이 프로젝트 전용 반복 작업 노트
└── sessions/          ← 의미 있는 작업의 완료 기록 (memory_record가 저장)
```

## 프로젝트 목록

- (프로젝트가 생기면 여기에 한 줄씩 추가)
