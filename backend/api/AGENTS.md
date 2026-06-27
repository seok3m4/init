# Backend API AGENTS

NestJS + TypeScript REST API 서버 영역이다. Prisma를 통해 PostgreSQL/pgvector 모델과 migration을 관리한다.

## Owners

- A: `/auth/*`, security, common error, deployment health
- B: `/company/recruitments*`, `/company/applicants*`
- C: `/company/interviews*`
- D: `/candidate/*`
- E: `/reports/*`, `/ai/*` API entrypoint

## Rules

- 모든 protected API는 role guard를 명시한다.
- JWT 구현 전에는 `docs/03_contracts/dev-auth-contract.md`의 Dev Auth 헤더로 `CurrentUser`를 만든다.
- API response shape은 `docs/03_contracts/api-spec.md`의 common contract를 따른다.
- 상태 전이는 문서화된 enum만 사용한다.
- Prisma model, DTO, controller, service 이름은 도메인 경계를 따라간다.
- DB 접근은 Prisma service/repository 경유를 기본으로 하고 raw query는 pgvector 등 필요한 경우에만 사용한다.
- Prisma seed는 `DEV_COMPANY_USER`, `DEV_CANDIDATE_USER`를 항상 upsert해야 한다.
- 외부 파일 업로드는 S3 key/file metadata로만 연결한다.
- 비동기 작업 생성 API는 `processLogId` 또는 추적 가능한 상태 값을 반환한다.
