# Prisma

이 디렉터리는 NestJS API 서버의 Prisma schema, migration, seed를 둔다.

## Dev Auth Seed

실제 로그인/JWT 구현 전에도 모든 팀원이 같은 개발용 사용자로 API를 개발할 수 있도록 `seed.ts`는 아래 데이터를 항상 보장해야 한다.

| Name | ID Contract |
| --- | --- |
| Dev company user | `users.user_id=1`, `companies.company_id=1`, `companies.owner_user_id=1` |
| Dev candidate user | `users.user_id=2`, `candidate_profiles.candidate_id=1`, `candidate_profiles.user_id=2` |

Prisma schema가 확정되면 `package.json`에 아래 계약을 추가한다.

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
