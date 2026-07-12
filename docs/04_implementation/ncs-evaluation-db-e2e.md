# NCS Evaluation Database E2E

실제 PostgreSQL에서 다음 수직 경계를 검증한다.

```text
동일 평가 요청 2회
→ ai_process_logs 한 건 예약
→ local queue adapter
→ worker evidence-state 평가
→ guardrail PASS
→ ncs_evaluation_revisions 한 건 저장
→ immutable revision 리포트 조회
→ 완료 message 재전달은 handler 재실행 없이 ack
```

## Safety

- 전용 `NCS_E2E_DATABASE_URL`만 사용한다.
- 기본적으로 localhost 계열 DB만 허용한다.
- 비로컬 테스트 DB는 `NCS_E2E_ALLOW_NONLOCAL=1`을 추가로 명시해야 한다.
- 실행마다 격리된 PK와 email을 만들고 `finally`에서 삭제한다.

## Windows

```powershell
$env:NCS_E2E_DATABASE_URL = "postgresql://init:init@localhost:5432/init"
$env:DATABASE_URL = $env:NCS_E2E_DATABASE_URL

Set-Location backend/api
npx prisma migrate deploy
npm run build

Set-Location ../worker
npm run build

Set-Location ../..
node scripts/verify-ncs-evaluation-db-e2e.mjs --require-db
```

DB가 없는 일반 하네스에서는 아래 명령이 명시적으로 skip된다.

```powershell
node scripts/verify-ncs-evaluation-db-e2e.mjs
```
