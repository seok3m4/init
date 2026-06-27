# Team Split: 5 Developers + 1 PM

6명 중 1명이 발표/검증 PM을 맡는 전제로, 개발 5명은 기능 도메인 중심으로 나눈다.

## Roles

| Member | Role | Scope | Main Tables/APIs |
| --- | --- | --- | --- |
| A | Auth/Common + CI/CD/AWS | 로그인, 회원가입, 이메일 인증, 비밀번호 재설정, JWT/권한, 공통 에러, Docker, GitHub Actions, AWS 배포 | `users`, `companies`, `candidate_profiles`, Redis, `/auth/*`, ECR, ECS, CloudFront, RDS PostgreSQL, Redis, S3, SQS |
| B | Company Recruiting | 기업 공고, 공고 상세, 지원자 등록/CSV, 초대 메일, 전형 상태 | `postings`, `applications`, `notifications`, `/company/recruitments`, `/company/applicants` |
| C | Company Interview/Criteria | 면접 설정, 평가 기준, 질문 뱅크, JD 기반 질문 생성 요청부 | `criterion_tags`, `evaluation_criteria`, `question_bank`, `/company/interviews/*` |
| D | Candidate/Application/Interview | 공고 조회, 지원서 제출, 지원현황, 모의/채용 면접 진행, 답변 업로드 | `applications`, `application_documents`, `interview_sessions`, `interview_answers`, `/candidate/*` |
| E | AI Report/Pipeline | 서류 추출, STT, 꼬리질문, 리포트 생성, 가드레일, 임베딩, worker/SQS 연동 | `ai_process_logs`, `ai_guardrail_logs`, `evaluation_reports`, `report_scores`, `report_evidences`, `embeddings`, `/reports/*`, `/ai/*` |
| PM | 발표/검증 PM | 요구사항 우선순위, API 계약 변경 관리, 테스트 시나리오, 발표 자료, 데모 플로우, QA 체크리스트, PR 검증 기준 | `docs/*`, 발표/검증 산출물 |

## Tech Stack

아래 스택을 MVP 개발 기준으로 사용한다. 실제 팀 결정이 달라지면 이 표를 먼저 갱신한 뒤 구현한다.

| Area | Stack | Owner | Notes |
| --- | --- | --- | --- |
| Frontend | React + Next.js + TypeScript | B/C/D | 기업/지원자 화면 구현. Next.js App Router, API client, 상태 관리 규칙은 초기에 공통화한다. |
| Runtime | Node.js 20 LTS | A | frontend, backend/api, backend/worker의 공통 실행 기반이다. `.nvmrc`와 `.node-version`을 함께 유지한다. |
| Package Manager | npm | A | 모든 package는 `package-lock.json`과 `npm ci` 기준으로 설치/검증한다. pnpm/yarn/bun은 팀 합의 전 사용하지 않는다. |
| Backend API | NestJS + TypeScript | A/B/C/D/E | REST API, 인증/인가, 도메인 비즈니스 로직 구현. |
| ORM | Prisma | A/B/C/D/E | PostgreSQL schema/migration/client generation 기준이다. |
| Database | PostgreSQL + pgvector | A/E | `docs/02_architecture/data-model.md` 기준. 리포트/질문/증거 임베딩은 pgvector 사용을 전제로 설계한다. |
| Cache | Redis | A | 이메일 인증 코드 TTL, 임시 상태, rate limit 보조 용도. |
| Object Storage | AWS S3 | A/D/E | 이력서, 포트폴리오 첨부, 면접 영상/음성 원본 저장. 원본 파일은 DB에 저장하지 않는다. |
| Async Queue | AWS SQS | A/E | STT, 서류 추출, 꼬리질문, 리포트 생성 등 장기 작업 큐. |
| Worker | NestJS worker 또는 Node.js worker process | E | `ai_process_logs` 상태 전이를 소유한다. API 서버와 장기 AI 작업을 분리한다. |
| AI Services | OpenAI Agents SDK, GPT-4 class model, MediaPipe | E | STT, 질문 생성, 평가/리포트 생성, 임베딩, 미디어 분석 전처리. prompt/model/tool version 관리가 필요하다. |
| CI/CD | GitHub Actions | A | test/build, Docker image build, AWS 배포 자동화. |
| Deployment | AWS ECR + ECS + CloudFront + S3 | A | API 서버/worker는 ECS, 정적 asset은 S3/CloudFront 기준으로 검증한다. |
| Container | Docker | A | 로컬/배포 실행 환경을 맞춘다. |
| Test | npm scripts, Jest/Vitest, Playwright/API/E2E 테스트 | 각 담당자, PM 검증 | 각 담당 API 단위 테스트와 핵심 happy path 검증. |

## Rationale

기업 영역을 한 명에게 모두 몰면 범위가 커진다. 따라서 기업 쪽은 `공고/지원자 운영`과 `면접 설정/평가 기준`으로 나눈다.

지원자 영역은 화면 수는 많지만 `공고 조회 -> 지원서 제출 -> 지원현황 -> 면접 진행` 흐름이 이어지므로 한 명이 end-to-end로 잡는 편이 낫다.

AI 처리는 일반 API와 병목 성격이 다르다. STT, 꼬리질문, 리포트 생성, 가드레일, 임베딩은 별도 담당자가 큐/worker 기반으로 묶어서 관리한다.

CI/CD와 AWS 배포는 A가 1차 담당한다. 인증/인가, JWT/OAuth, CORS, HTTPS, secret, Redis 인증 코드가 모든 API의 앞단에 걸리므로 배포 런타임 안정성은 Auth/Common 담당자가 소유하는 편이 명확하다.

E는 AI worker, SQS 작업 메시지, S3 파일 참조, AI provider 환경변수, 비동기 처리 상태 전이를 A와 함께 검증한다. PM은 배포 성공 여부와 데모 시나리오를 검증한다.

## MVP Priority

1. A: 인증/권한과 배포 뼈대 먼저 완성
2. B: 기업 공고/지원자 등록/초대
3. D: 지원자 공고 조회/지원서 제출/면접 세션 진행
4. C: 평가 기준/질문 뱅크/면접 설정
5. E: 비동기 AI 처리와 리포트 생성

## Collision Points

### `applications`

B와 D가 함께 사용한다.

- B: 기업 관점 전형 판정, 지원자 관리, 초대 상태
- D: 지원자 제출, 응시 상태, 지원현황

상태 전이 규칙은 구현 전에 문서로 합의해야 한다.

### `interview_sessions`, `interview_answers`

D와 E가 함께 사용한다.

- D: 세션 진행, 질문 이동, 답변 파일 저장
- E: STT, 분석, 꼬리질문, 리포트 생성

D는 면접 런타임까지, E는 AI 분석 이후를 담당한다.

### `question_bank`, `evaluation_criteria`

C와 E가 함께 사용한다.

- C: 설정 CRUD, 질문 뱅크 관리, 평가 기준 관리
- E: AI 생성/추천 결과 저장 규칙, 리포트 평가 기준 사용

## Branch Strategy

```text
dev
feature/auth-common
feature/company-recruiting
feature/company-interview-criteria
feature/candidate-application-interview
feature/ai-report-pipeline
feature/infra-cicd
```

각 개발자는 담당 feature 브랜치에서 작업하고, PR은 `dev`로 보낸다. PM은 기능 기준으로 PR을 검증하고, 발표 데모 흐름을 고정한다.

## Demo Flow

발표 데모는 다음 happy path를 기준으로 한다.

```text
회원가입 -> 기업 공고 생성 -> 지원자 지원 -> AI 면접 -> 리포트 확인
```
