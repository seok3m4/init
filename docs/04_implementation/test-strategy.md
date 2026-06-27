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
