# Scripts AGENTS

개발, 검증, 문서 생성 보조 스크립트 영역이다.

## Rules

- destructive command를 기본 동작으로 두지 않는다.
- Windows 경로와 UTF-8 출력을 고려한다.
- 스크립트는 실행 방법과 필요한 환경변수를 주석 또는 README에 남긴다.
- CI에서 사용하는 스크립트는 A와 PM 리뷰를 받는다.

## Local Harness

- 기본 진입점은 `scripts/check-local.ps1`이다.
- 각 담당자는 작업 종료 전 본인 role로 실행한다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-local.ps1 -Role A
```

- pre-commit hook을 설치하려면 다음을 실행한다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-hooks.ps1 -Role A
```

- 로컬 hook은 실수 방지 장치이며, 우회할 수 있다. 그래도 Codex 작업에서는 최종 보고 전에 반드시 `check-local.ps1` 결과를 확인한다.

## Harness Components

- `verify-docs.ps1`: 문서, 계약, AGENTS, ERD, 폴더 구조 검증
- `verify-ownership.ps1`: role별 담당 경로 검증
- `verify-prisma.ps1`: Prisma schema와 migration 준비 상태 검증
- `verify-docker.ps1`: Dockerfile 문법 최소 검증, 선택적 build
- `verify-env.ps1`: `.env.example` 필수 변수명 검증
- `verify-ai-golden.ps1`: AI mock/golden case 구조 검증
- `smoke-local.ps1`: `/health` smoke test

## Local Harness

- 기본 진입점은 `scripts/check-local.ps1`이다.
- 각 담당자는 작업 종료 전 본인 role로 실행한다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-local.ps1 -Role A
```

- pre-commit hook을 설치하려면 다음을 실행한다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-hooks.ps1 -Role A
```

- 로컬 hook은 실수 방지 장치이며, 우회할 수 있다. 그래도 Codex 작업에서는 최종 보고 전에 반드시 `check-local.ps1` 결과를 확인한다.
