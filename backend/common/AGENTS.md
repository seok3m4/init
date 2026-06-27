# Backend Common AGENTS

공통 TypeScript 코드 영역이다. A가 1차 소유하며 shared 변경은 모든 관련 담당자 리뷰를 받는다.

## Contents

- common enum
- common error response
- shared DTO
- security helper
- validation helper
- time/id utility
- Prisma/shared type helper

## Rules

- 공통 enum은 `docs/03_contracts/enums.md`와 일치해야 한다.
- error code는 `docs/03_contracts/error-codes.md`와 일치해야 한다.
- 특정 도메인에만 쓰는 코드는 common에 넣지 않는다.
- common 변경은 영향 범위가 넓으므로 PR 설명에 영향 API를 적는다.
