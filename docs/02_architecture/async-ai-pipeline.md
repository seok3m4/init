# Async AI Pipeline

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

AI 처리와 비동기 작업의 실행 흐름을 정리한다.

## Pipeline Principles

- 장기 작업은 `ai_process_logs`에 작업 유형, 상태, 입력 참조, 출력 참조를 기록한다.
- AI 결과 저장 전 `POST /ai/guardrails/validate`로 정책 위반 여부를 검증한다.
- 실패한 작업은 `FAILED` 상태와 재시도 가능 사유를 화면에 노출한다.
- 임베딩은 원문 해시(`source_text_hash`)로 중복 생성을 방지한다.

## Main Flows

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Log as ai_process_logs
  participant Queue as SQS
  participant Worker as AI worker
  participant Guard as ai_guardrail_logs
  UI->>API: 요청
  API->>Log: PENDING 작업 로그 생성
  API->>Queue: processLogId, processType, inputRef 발행
  API-->>UI: processLogId 반환
  Worker->>Queue: 메시지 수신
  Worker->>Log: RUNNING 기록
  Worker->>Worker: 서류 추출/STT/질문 생성/평가
  Worker->>Guard: 정책 검증
  Guard-->>Worker: PASS/BLOCKED/REGENERATED
  Worker->>Log: COMPLETED 또는 FAILED 기록
  Worker-->>Queue: 성공 처리 후 메시지 삭제
```

## Async Endpoint Map

| API ID | Method | Path | Purpose | Related Tables |
| --- |--- |--- |--- |--- |
| API-028 | POST | /reports/{reportId}/evaluation-context | 평가 컨텍스트 구성 | companies, candidate_profiles, postings, criterion_tags, evaluation_criteria, applications, application_documents, interview_answers, evaluation_reports, report_scores, report_evidences, manual_evaluations, ai_process_logs |
| API-029 | POST | /reports/{reportId}/answer-evaluation | 답변 채점 및 근거 생성 | companies, candidate_profiles, postings, criterion_tags, evaluation_criteria, applications, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, manual_evaluations, ai_process_logs |
| API-030 | POST | /reports/{reportId}/communication-analysis | 비언어/음성 지표 보조 분석 | companies, candidate_profiles, file_assets, postings, applications, consent_records, evaluation_reports, report_scores, report_evidences, ai_process_logs |
| API-031 | POST | /reports/{reportId}/generate | 리포트 생성 | companies, candidate_profiles, postings, criterion_tags, evaluation_criteria, applications, application_documents, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, ai_process_logs |
| API-035 | POST | /company/interviews/evaluation-criteria/suggest | AI 평가 역량 태그 추천 | companies, postings, criterion_tags, evaluation_criteria, interview_sessions, ai_process_logs, embeddings |
| API-038 | POST | /company/interviews/questions/generate | JD 기반 직무 질문 생성 | companies, postings, criterion_tags, evaluation_criteria, question_bank, applications, interview_sessions, manual_evaluations, ai_process_logs |
| API-039 | POST | /company/interviews/question-sets | 면접 질문 목록 구성 | companies, postings, criterion_tags, evaluation_criteria, question_bank, application_documents, interview_sessions, manual_evaluations, ai_process_logs |
| API-045 | POST | /candidate/mock-interviews/questions/generate | 연습용 질문 목록 구성 | companies, candidate_profiles, postings, criterion_tags, evaluation_criteria, question_bank, applications, interview_sessions, ai_process_logs |
| API-050 | POST | /candidate/mock-interviews/{sessionId}/stt | STT 처리 | candidate_profiles, file_assets, applications, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, ai_process_logs |
| API-051 | POST | /candidate/mock-interviews/{sessionId}/follow-up-question | 꼬리질문 생성 | candidate_profiles, postings, question_bank, applications, interview_sessions, interview_answers, follow_up_questions, ai_process_logs |
| API-057 | POST | /candidate/mock-interview/reports/{reportId}/generate | 피드백 리포트 생성 | candidate_profiles, postings, criterion_tags, evaluation_criteria, question_bank, applications, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, manual_evaluations, ai_process_logs |
| API-070 | POST | /candidate/interviews/{sessionId}/stt | STT 처리 | companies, candidate_profiles, file_assets, postings, applications, interview_sessions, interview_answers, ai_process_logs |
| API-071 | POST | /candidate/interviews/{sessionId}/follow-up-question | 꼬리질문 생성 | candidate_profiles, postings, question_bank, applications, application_documents, interview_sessions, interview_answers, follow_up_questions, ai_process_logs |
| API-076 | POST | /candidate/documents/extract | 서류 텍스트 추출 | candidate_profiles, file_assets, applications, application_documents, manual_evaluations, ai_process_logs |
