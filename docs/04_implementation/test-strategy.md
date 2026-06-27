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
