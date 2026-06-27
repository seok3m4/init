# Backend AGENTS

Node.js + TypeScript 백엔드 영역이다. NestJS API 서버, worker, common 모듈로 나눈다.

## Structure

- `api`: NestJS REST API 서버
- `worker`: SQS/AI 비동기 worker
- `common`: 공통 enum, DTO, error, security helper

## Rules

- API 구현 전 `docs/03_contracts/api-spec.md`의 API ID를 확인한다.
- DB 변경 전 `docs/02_architecture/data-model.md`와 `docs/02_architecture/erd.md`를 확인한다.
- 공통 enum/error 변경은 `docs/03_contracts/enums.md`, `docs/03_contracts/error-codes.md`를 먼저 수정한다.
- DB schema 변경은 Prisma schema와 migration을 함께 갱신한다.
- 장기 AI 작업은 API 요청 스레드에서 직접 처리하지 않는다.
- 파일 원본은 DB에 저장하지 않는다.
