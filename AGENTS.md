# AGENTS

이 파일은 프로젝트 루트의 공통 AI/개발 운영 규칙이다. 모든 작업자는 작업 전에 이 파일과 담당 영역의 `AGENTS.md`를 먼저 확인한다.

## Project Stack

- Frontend: React + TypeScript
- Backend API: Java + Spring Boot
- Database: PostgreSQL
- Cache: Redis
- Object Storage: AWS S3
- Async Queue: AWS SQS
- Worker: Spring Boot worker 또는 별도 worker process
- AI Provider: OpenAI API 또는 팀 지정 AI API
- CI/CD: GitHub Actions
- Deployment: AWS ECS 또는 EC2
- Container: Docker

## Required Reading Order

1. `docs/05_agents/AGENTS.md`
2. `docs/04_implementation/team-split-5dev-1pm.md`
3. `docs/03_contracts`
4. `docs/02_architecture`
5. 담당 폴더의 `AGENTS.md`
6. 담당 역할별 `docs/05_agents/agent-*.md`

## Work Ownership

- A: Auth/Common + CI/CD/AWS
- B: Company Recruiting
- C: Company Interview/Criteria
- D: Candidate/Application/Interview
- E: AI Report/Pipeline
- PM: 발표, 검증, QA, 문서 계약 관리

## Collaboration Rules

- API path, request/response, enum, error code 변경은 `docs/03_contracts`를 먼저 수정한다.
- DB 테이블/상태 전이 변경은 `docs/02_architecture`와 `docs/04_implementation`을 먼저 수정한다.
- UI 구현은 `design.md`와 `docs/01_product`를 먼저 확인한다.
- AI 결과는 가드레일 검증 전 최종 저장하지 않는다.
- 파일 원본은 DB에 저장하지 않고 S3에 저장한다. DB에는 `file_assets` 메타데이터만 저장한다.
- 장기 작업은 API 서버에서 직접 오래 잡지 않고 SQS/worker와 `ai_process_logs` 상태 전이로 처리한다.
- 각 담당자는 본인 소유 테이블/API 외 변경 시 관련 담당자에게 리뷰를 요청한다.

## Folder Map

| Folder | Purpose |
| --- | --- |
| `frontend` | React + TypeScript 클라이언트 |
| `backend/api` | Spring Boot REST API 서버 |
| `backend/worker` | AI/비동기 worker |
| `backend/common` | 공통 Java 코드, DTO, enum, error, security helper |
| `infra` | AWS, Docker, DB migration, local infra |
| `scripts` | 개발/검증 보조 스크립트 |
| `docs` | 제품, 아키텍처, 계약, 분업 문서 |
| `assets` | 로고, 발표/문서용 정적 리소스 |

## Windows Command Notes

- Windows에서 로컬 명령 실행 시 가능하면 `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`를 명시한다.
- 한국어/UTF-8 파일을 PowerShell로 읽을 때는 UTF-8 출력을 명시한다:
  `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $OutputEncoding=[System.Text.Encoding]::UTF8`
- 한글, 공백, 대괄호가 포함된 경로는 `-LiteralPath`를 우선 사용한다.

