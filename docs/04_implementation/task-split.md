# Task Split

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

팀/에이전트가 병렬로 나눠 구현할 수 있는 단위로 작업을 분리한다.

| Task | Owner | Scope | Main Data | Done Criteria |
| --- |--- |--- |--- |--- |
| T0 | contracts | API/enum/error docs freeze | 03_contracts/* | API ID와 endpoint가 고정됨 |
| T1 | auth-common | 로그인, OAuth, 회원가입, 이메일 인증, 비밀번호 재설정 | users, companies, candidate_profiles, Redis | 인증 플로우 E2E 통과 |
| T2 | company | 공고 목록/상세, 지원자 등록/초대, 전형 판정 | postings, applications, notifications | 기업 주요 화면 API 통과 |
| T3 | company | 면접 설정, 평가 기준, 질문 뱅크 | criterion_tags, evaluation_criteria, question_bank | 공고별 질문 세트 생성 가능 |
| T4 | candidate-interview | 지원자 공고 조회, 기업별 이력서 제출, 지원현황 | applications, application_documents, consent_records | 지원서 제출 후 상태 확인 가능 |
| T5 | candidate-interview | 모의면접/채용면접 진행, 답변 저장, 다음 질문 | interview_sessions, interview_answers | 질문 표시 토글과 답변 업로드 통과 |
| T6 | ai-report | 서류 추출, STT, 꼬리질문, 리포트 생성 | ai_process_logs, evaluation_reports | 비동기 상태 전이 통과 |
| T7 | ai-report | 가드레일, 근거, 임베딩 | ai_guardrail_logs, report_evidences, embeddings | 정책 위반 결과 미저장 검증 |
| T8 | ci-cd | 테스트/빌드/계약 검증 자동화 | .github/workflows | PR에서 필수 검증 실행 |

## Dependency Order

1. T0 contracts
2. T1 auth-common
3. T2/T3 company and T4 candidate application
4. T5 candidate interview
5. T6/T7 ai-report
6. T8 ci-cd hardening
