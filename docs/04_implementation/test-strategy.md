# Test Strategy

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

모듈별 검증 범위와 회귀 테스트 기준을 정의한다.

| Layer | Target | Required Checks |
| --- |--- |--- |
| Contract | API request/response shape | 03_contracts/api-spec.md 기준 path/method/status 검증 |
| Unit | Module business rules | 상태 전이, 권한, validation, enum mapping |
| Integration | DB and storage | FK 관계, 파일 메타 저장, Redis 인증 코드 TTL |
| E2E | User journeys | 회원가입/로그인, 기업 초대, 지원자 제출, 면접 진행, 리포트 조회 |
| Async | AI process state | PENDING -> RUNNING -> COMPLETED/FAILED, retry, guardrail blocked |
| Security | Access control | 기업 간 공고/지원자 접근 차단, 지원자 본인 데이터 제한 |
| Privacy | Consent and retention | 동의 없을 때 분석 차단, 삭제/보관 정책 검증 |

## Local Harness

GitHub Actions가 없어도 로컬에서 최소 검증을 강제하기 위한 진입점은 OS별로 나눈다. Windows는 `scripts/check-local.ps1`, macOS/Linux는 `scripts/check-local.sh`를 사용한다.

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File scripts\check-local.ps1 -Role A
```

```bash
# macOS/Linux
bash scripts/check-local.sh -Role A
```

| Harness | Purpose | Skip Rule |
| --- | --- | --- |
| `verify-docs.ps1` | 필수 문서, API 계약, ERDCloud SQL, 목표 폴더 구조 확인 | 핵심 문서는 없으면 실패 |
| `verify-ownership.ps1` | 역할별 허용 경로 외 변경 감지 | `-SkipOwnership` 지정 시 생략 |
| `verify-prisma.ps1` | Prisma schema validate, migration 폴더 확인 | schema가 아직 없으면 skip |
| `verify-docker.ps1` | Dockerfile 기본 구조와 선택적 build 확인 | Dockerfile이 아직 없으면 skip |
| `verify-env.ps1` | 필수 환경변수 이름 확인 | env example이 아직 없으면 skip |
| `verify-dev-auth-seed.ps1` | Dev Auth 계약과 Prisma seed 골격 확인 | seed 골격은 없으면 실패 |
| `verify-ai-golden.ps1` | AI golden case JSON shape 확인 | golden case가 없으면 skip |
| `smoke-local.ps1` | 실행 중인 API `/health` 확인 | base URL 없으면 skip |

macOS/Linux의 `check-local.sh`는 PowerShell Core 설치를 요구하지 않고 bash, git, grep/find/sed/awk, curl 또는 Node.js만 사용한다. 실행 권한(`chmod +x`)에 의존하지 않도록 문서상 표준 명령은 `bash scripts/check-local.sh`로 둔다.

pre-commit hook은 선택 사항이다. 설치하면 commit 전에 같은 Harness를 실행한다.

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File scripts\install-hooks.ps1 -Role A
```

```bash
# macOS/Linux
bash scripts/install-hooks.sh -Role A
```

## macOS Developer Requirements

Node.js가 설치되어 있다는 전제에서, macOS 개발자가 추가로 준비해야 하는 것은 작업 범위에 따라 다르다.

| 작업 | 추가 준비 | 이유 |
| --- | --- | --- |
| 문서/계약/폴더 구조 harness 실행 | 없음 | `bash scripts/check-local.sh`가 macOS 기본 도구와 Node.js만 사용한다. |
| Next.js/NestJS 앱 build/test | `npm ci` | 프로젝트 의존성은 저장소에 커밋하지 않으므로 각 package에서 설치해야 한다. |
| Prisma schema validate/generate | `npm ci` 이후 로컬 Prisma CLI | Prisma CLI는 프로젝트 dependency로 관리한다. 전역 설치는 요구하지 않는다. |
| Docker 기반 PostgreSQL/Redis/LocalStack 실행 | Docker Desktop 또는 호환 Docker Engine | DB, Redis, S3/SQS 로컬 대체 환경은 컨테이너 런타임이 필요하다. |
| 실제 AWS/OpenAI 호출 | 로컬 env 값 또는 팀 secret 주입 | 외부 서비스 인증 정보는 Git에 저장하지 않는다. |

macOS 호환성을 자동으로 강제하려면 `.github/workflows/ci.yml`에 `macos-latest` harness job을 추가한다. 문서는 실행 기준을 정하지만, 자동 보장은 CI runner가 담당한다.

## Critical E2E Scenarios

- 기업 회원가입 -> 로그인 -> 공고 관리 진입
- 기업 공고 상세 -> 지원자 등록 -> 초대 링크 발송 -> 면접 세션 생성
- 지원자 회원가입 -> 회사 리스트 -> 회사 상세 -> 기업별 이력서 제출
- 지원현황 -> 동의 -> 장치 점검 -> 채용 AI 면접 시작 -> 답변 저장 -> 완료
- AI 처리 실패 시 리포트 생성 실패 상태와 재시도 안내 표시
- 채용 리포트는 기업 상세에는 전체 노출, 지원자 결과 화면에는 제한 노출

## Harness

초기 구현 전에는 문서/계약/폴더 구조 하네스를 먼저 유지한다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-local.ps1 -Role A
```

이 하네스는 다음을 검증한다.

- 필수 `AGENTS.md`와 담당자별 agent 문서 존재
- 기술스택 기준 폴더 구조 존재
- `api-index.md`와 `api-spec.md`의 API ID 정합성
- ERDCloud SQL의 필수 테이블 존재
- ERDCloud SQL이 `docs/02_architecture/erdcloud`에 위치하는지 여부
- role별 허용 경로 밖의 생성/수정/삭제 감지
- Prisma schema/migration 준비 상태
- Dockerfile 존재 시 최소 문법과 선택적 build
- `.env.example` 필수 변수명
- AI golden case 구조
- `SMOKE_BASE_URL` 설정 시 `/health` smoke test

애플리케이션 코드가 추가되면 이 하네스에 backend test, frontend test, migration validation, smoke test를 단계적으로 연결한다.

### Local Ownership Guard

현재 GitHub Actions나 branch protection을 사용하지 않는 전제에서는 로컬 ownership guard를 실수 방지 장치로 사용한다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-ownership.ps1 -Role A -IncludeUntracked
```

pre-commit hook은 선택적으로 설치한다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-hooks.ps1 -Role A
```

로컬 hook은 우회 가능하므로 보안 경계가 아니다. 모든 Codex 작업자는 최종 답변에 실행한 하네스 명령과 결과를 보고한다.
