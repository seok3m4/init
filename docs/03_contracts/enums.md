# Enums

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

API와 DB에서 공유해야 하는 상태값을 정리한다.

| Enum | Values | Description |
| --- |--- |--- |
| user_type | ADMIN, COMPANY, CANDIDATE | 사용자 유형 |
| auth_provider | LOCAL, GOOGLE | 로그인/가입 방식 |
| user_status | ACTIVE, PENDING, SUSPENDED, DEACTIVATED | 계정 상태 |
| posting_status | DRAFT, OPEN, CLOSING_SOON, CLOSED, ARCHIVED | 공고 상태 |
| application_status | DRAFT, SUBMITTED, IN_REVIEW, INTERVIEW_WAITING, INTERVIEW_DONE, COMPLETED, CANCELED | 지원 진행 상태 |
| document_status | NOT_SUBMITTED, SUBMITTED, EXTRACTING, EXTRACTED, FAILED | 서류 제출/분석 상태 |
| interview_status | NOT_READY, READY, IN_PROGRESS, COMPLETED, FAILED | 면접 세션/응시 상태 |
| report_status | PENDING, GENERATING, COMPLETED, FAILED | 리포트 생성 상태 |
| screening_decision | UNDECIDED, PASS, HOLD, FAIL | 기업 담당자 전형 판정 |
| interview_type | MOCK, RECRUITING | 모의면접/채용면접 구분 |
| report_type | MOCK_INTERVIEW_REPORT, RECRUITING_REPORT | 리포트 구분 |
| document_type | RESUME, PORTFOLIO | 지원 서류 유형 |
| consent_type | PRIVACY_COLLECTION, AI_DOCUMENT_ANALYSIS, AI_INTERVIEW_RECORDING | 필수 동의 유형 |
| question_type | INTRO, TECHNICAL, EXPERIENCE, SITUATION, FOLLOW_UP, CLOSING | 면접 질문 유형 |
| notification_channel | EMAIL, IN_APP | 알림 채널 |
| ai_process_type | DOCUMENT_EXTRACT, STT, FOLLOW_UP, REPORT_GENERATE, EMBEDDING, GUARDRAIL_VALIDATE, CRITERIA_SUGGEST, QUESTION_GENERATE, QUESTION_SET_GENERATE | AI 처리 유형 |
| ai_process_status | PENDING, RUNNING, COMPLETED, FAILED | AI 처리 상태 |
| guardrail_result | PASS, BLOCKED, REGENERATED | AI 안전 검증 결과 |
| embedding_source_type | POSTING_JD, CRITERION_TAG, QUESTION, APPLICATION_DOCUMENT, INTERVIEW_ANSWER, EVALUATION_REPORT | 임베딩 원천 유형 |
