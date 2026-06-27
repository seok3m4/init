# Module Boundaries

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

구현 모듈별 책임과 접근 가능한 테이블/API 경계를 정의한다.

| Module | Owns | Reads | Representative APIs | Notes |
| --- |--- |--- |--- |--- |
| auth-common | users, companies, candidate_profiles | Redis/TTL cache | /auth/* | 이메일 인증 코드는 DB 저장 금지 |
| company | postings, evaluation_criteria, question_bank, applications screening fields | reports, candidate_profiles | /company/* | 기업은 자기 회사 공고/지원자만 접근 |
| candidate-interview | interview_sessions, interview_answers, consent_records | applications, postings | /candidate/*interview* | 모의면접과 채용면접은 `interview_type`으로 분리 |
| ai-report | evaluation_reports, report_scores, report_evidences, ai_process_logs, ai_guardrail_logs, embeddings | documents, answers, criteria | /reports/*, /ai/* | 가드레일 통과 전 결과 저장 금지 |
| file-storage | file_assets | users | /candidate/resume, /company/profile/logo | 원본 파일은 Object Storage |
| notification | notifications | users, applications | invitation/notification endpoints | 메일 발송 실패 상태 기록 |

## API Distribution

| Domain | API Count |
| --- |--- |
| 인증/계정 | 9 |
| 기업 - 대시보드 | 1 |
| 기업 - 채용공고 | 5 |
| 기업 - 지원자/리포트 | 13 |
| 기업 - 면접관리 | 8 |
| AI/리포트 처리 | 5 |
| 기업 - 설정 | 3 |
| 지원자 - 모의면접 | 14 |
| 지원자 - 채용공고/지원 | 3 |
| 지원자 - 지원현황/채용면접 | 7 |
| 지원자 - 채용면접 | 7 |
| 지원자 - 마이페이지 | 4 |
