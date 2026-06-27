# AGENTS

init 프로젝트를 5명 개발자와 1명 PM이 나눠 작업할 때의 중앙 AI 라우팅 문서다. 각 담당자는 본인 작업 전에 이 문서와 담당 agent 파일을 먼저 읽는다.

## Document Priority

1. `docs/03_contracts` API/enum/error 계약
2. `docs/02_architecture` 데이터 모델/파이프라인
3. `docs/01_product` 화면/기능 흐름
4. `design.md` 디자인 시스템/공통 UI 토큰
5. `docs/04_implementation` 작업 분할/테스트 전략
6. 담당 폴더의 `AGENTS.md`

## Developer Agent Map

| Member | Role | Agent File | Must Read First |
| --- | --- | --- | --- |
| A | Auth/Common + CI/CD/AWS | `agent-a-auth-infra.md` | `docs/03_contracts/*`, `docs/02_architecture/data-model.md`, `docs/04_implementation/team-split-5dev-1pm.md`, `backend/AGENTS.md`, `infra/AGENTS.md` |
| B | Company Recruiting | `agent-b-company-recruiting.md` | `docs/01_product/feature-spec.md`, `docs/03_contracts/api-spec.md`, `docs/02_architecture/data-model.md`, `backend/api/AGENTS.md`, `frontend/AGENTS.md` |
| C | Company Interview/Criteria | `agent-c-company-interview-criteria.md` | `docs/03_contracts/api-spec.md`, `docs/02_architecture/data-model.md`, `docs/02_architecture/async-ai-pipeline.md`, `backend/api/AGENTS.md`, `frontend/AGENTS.md` |
| D | Candidate/Application/Interview | `agent-d-candidate-application-interview.md` | `docs/01_product/screen-flow.md`, `docs/03_contracts/api-spec.md`, `docs/02_architecture/data-model.md`, `backend/api/AGENTS.md`, `frontend/AGENTS.md` |
| E | AI Report/Pipeline | `agent-e-ai-report-pipeline.md` | `docs/02_architecture/async-ai-pipeline.md`, `docs/03_contracts/api-spec.md`, `docs/03_contracts/enums.md`, `backend/worker/AGENTS.md`, `backend/api/AGENTS.md` |
| PM | 발표/검증/QA | `team-split-5dev-1pm.md` | `docs/01_product/*`, `docs/03_contracts/*`, `docs/04_implementation/test-strategy.md` |

## Folder Routing

| Folder | Main Owner | Reviewers |
| --- | --- | --- |
| `frontend` | B/C/D | PM for UX flow, A for auth integration |
| `backend/api` | A/B/C/D/E by domain | A for security, owner of touched domain |
| `backend/common` | A | all developers when shared DTO/enum/error changes |
| `backend/worker` | E | A for infra/env, D for interview answer inputs |
| `infra` | A | E for SQS/worker/S3, PM for deployment validation |
| `docs` | PM | owner of changed domain |
| `.github` | A | PM for PR/check requirements |
| `assets` | PM | frontend owner when used in UI |

## Collaboration Rules

- API path, request/response, enum, error code 변경은 `docs/03_contracts`를 먼저 갱신한다.
- UI 구현 및 스타일 변경은 `design.md`를 먼저 확인한다.
- DB 테이블 소유권은 `docs/04_implementation/module-boundaries.md`와 `docs/04_implementation/team-split-5dev-1pm.md`를 따른다.
- 공유 테이블인 `applications`, `interview_sessions`, `interview_answers`, `question_bank`, `evaluation_criteria` 변경은 관련 담당자 리뷰를 받는다.
- AI 결과는 가드레일 검증 전 최종 저장하지 않는다.
- 지원자 화면은 채용 평가 상세 점수와 내부 메모를 제한 노출한다.
- 변경 후 해당 모듈 테스트와 관련 E2E 시나리오를 기록한다.
- AI에게 구현을 요청할 때는 담당 API ID, 읽어야 할 문서, 소유 테이블, 상태 전이, 테스트 기준을 함께 제공한다.
