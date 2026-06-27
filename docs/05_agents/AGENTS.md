# AGENTS

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

init 프로젝트를 여러 에이전트가 나눠 작업할 때의 공통 운영 규칙이다.

## Source Priority

1. `init/docs/00_source` 원본
2. `init/docs/03_contracts` API/enum/error 계약
3. `init/docs/02_architecture` 데이터 모델/파이프라인
4. `init/docs/01_product` 화면/기능 흐름
5. `init/docs/04_implementation` 작업 분할/테스트 전략

## Agent Map

| Agent | File | Primary Scope |
| --- |--- |--- |
| ci-cd | 05_agents/agent-ci-cd.md | 빌드, 테스트, 계약 검증, 배포 파이프라인 |
| auth-common | 05_agents/agent-auth-common.md | 공통 인증, 계정, 이메일 인증 |
| company | 05_agents/agent-company.md | 기업 포털, 공고, 지원자 관리, 면접 설정 |
| candidate-interview | 05_agents/agent-candidate-interview.md | 지원자 포털, 모의/채용 면접 |
| ai-report | 05_agents/agent-ai-report.md | AI 처리, 리포트, 근거, 가드레일 |

## Collaboration Rules

- API path, enum, error code 변경은 `03_contracts`를 먼저 갱신한다.
- DB 테이블 소유권은 `04_implementation/module-boundaries.md`를 따른다.
- AI 결과는 가드레일 검증 전 최종 저장하지 않는다.
- 지원자 화면은 채용 평가 상세 점수와 내부 메모를 제한 노출한다.
- 변경 후 해당 모듈 테스트와 관련 E2E 시나리오를 기록한다.
