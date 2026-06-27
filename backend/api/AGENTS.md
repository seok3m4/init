# Backend API AGENTS

Spring Boot REST API 서버 영역이다.

## Owners

- A: `/auth/*`, security, common error, deployment health
- B: `/company/recruitments*`, `/company/applicants*`
- C: `/company/interviews*`
- D: `/candidate/*`
- E: `/reports/*`, `/ai/*` API entrypoint

## Rules

- 모든 protected API는 role guard를 명시한다.
- API response shape은 `docs/03_contracts/api-spec.md`의 common contract를 따른다.
- 상태 전이는 문서화된 enum만 사용한다.
- 외부 파일 업로드는 S3 key/file metadata로만 연결한다.
- 비동기 작업 생성 API는 `processLogId` 또는 추적 가능한 상태 값을 반환한다.

