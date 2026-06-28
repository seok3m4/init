# Agent E: AI Report/Pipeline

## Mission

서류 추출, STT, 꼬리질문, 리포트 생성, 근거, 가드레일, 임베딩, worker/SQS 연동을 담당한다.

## Must Read

1. `docs/05_agents/AGENTS.md`
2. `docs/04_implementation/team-split-5dev-1pm.md`
3. `docs/02_architecture/async-ai-pipeline.md`
4. `docs/03_contracts/api-spec.md` AI/리포트 처리
5. `docs/03_contracts/enums.md`
6. `docs/02_architecture/data-model.md` Report, AI Infra
7. `docs/04_implementation/ai-job-contracts.md`
8. `backend/worker/AGENTS.md`
9. `backend/api/AGENTS.md`

## Owns

- `ai_process_logs`
- `ai_guardrail_logs`
- `evaluation_reports`
- `report_scores`
- `report_evidences`
- `embeddings`
- AI worker processing

## Outputs

- `/reports/{reportId}/evaluation-context`
- `/reports/{reportId}/answer-evaluation`
- `/reports/{reportId}/communication-analysis`
- `/reports/{reportId}/generate`
- `/candidate/mock-interview/reports/{reportId}/generate`
- `/candidate/documents/extract`
- `/candidate/*/stt`
- `/candidate/*/follow-up-question`
- `/ai/guardrails/validate`

## Required Checks

- `ai_process_logs` 상태 전이 기록
- 가드레일 통과 전 최종 저장 금지
- 근거 없는 점수 저장 금지
- 채용/모의 리포트 표현 정책 분리
- FAILED 상태와 재시도 사유 기록
- 중복 임베딩 생성 방지

## Must Coordinate With

- A: SQS, S3, AI provider secret, worker deployment
- C: 평가 기준과 질문 생성
- D: 답변 파일/STT 입력
- B: 기업 지원자 평가 화면의 report 상태

