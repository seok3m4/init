# Dev Auth Contract

실제 로그인/JWT 구현 전에도 B/C/D/E가 같은 인증 컨텍스트로 개발할 수 있도록 개발용 인증 계약을 고정한다.

## CurrentUser

모든 protected API는 인증 방식과 무관하게 아래 형태의 현재 사용자 객체를 기준으로 권한을 판단한다.

```ts
type UserType = "ADMIN" | "COMPANY" | "CANDIDATE";

type CurrentUser = {
  userId: number;
  userType: UserType;
  companyId: number | null;
  candidateId: number | null;
};
```

JWT 구현 전에는 Dev Auth가 `X-Dev-*` 헤더를 읽어 `CurrentUser`를 만든다. JWT 구현 후에는 JWT guard가 같은 `CurrentUser`를 만든다. controller/service는 두 구현 차이를 몰라야 한다.

## Fixed Development Users

로컬 개발 DB에는 아래 두 사용자가 항상 존재해야 한다.

| Name | userId | userType | companyId | candidateId | Purpose |
| --- | ---: | --- | ---: | ---: | --- |
| `DEV_COMPANY_USER` | 1 | COMPANY | 1 | null | B/C/E 기업 권한 API 개발 |
| `DEV_CANDIDATE_USER` | 2 | CANDIDATE | null | 1 | D/E 지원자 권한 API 개발 |

## Dev Auth Headers

기업 사용자:

```http
X-Dev-User-Id: 1
X-Dev-User-Type: COMPANY
X-Dev-Company-Id: 1
```

지원자 사용자:

```http
X-Dev-User-Id: 2
X-Dev-User-Type: CANDIDATE
X-Dev-Candidate-Id: 1
```

## Required Behavior

- Dev Auth는 local/dev 환경에서만 활성화한다.
- production/staging에서는 `X-Dev-*` 헤더를 무시하거나 요청을 거부한다.
- 인증 정보가 없거나 잘못되면 `COMMON_UNAUTHORIZED`와 HTTP 401을 반환한다.
- 인증은 되었지만 role이 맞지 않으면 `COMMON_FORBIDDEN`과 HTTP 403을 반환한다.
- B/C는 `COMPANY`만 접근 가능한 API를 구현한다.
- D는 `CANDIDATE`만 접근 가능한 API를 구현한다.
- E는 API 호출자가 `COMPANY`, `CANDIDATE`, `SYSTEM` 중 무엇인지 API 계약에 따라 확인한다.
- 각 담당자는 `companyId=1`, `candidateId=1`을 직접 하드코딩하지 않고 `CurrentUser`에서 읽는다.

## Seed Requirement

Prisma schema가 생기면 `backend/api/prisma/seed.ts`는 `DEV_COMPANY_USER`, `DEV_CANDIDATE_USER`를 `upsert`로 생성해야 한다.

팀원 로컬 초기화 명령은 migration 이후 seed를 실행해야 한다.

```bash
npm run dev:init
```

권장 `package.json` 계약:

```json
{
  "scripts": {
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset --force",
    "dev:init": "prisma migrate dev && prisma db seed"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```
