# Agent D: Candidate/Application/Interview

## Mission

지원자 공고 조회, 지원서 제출, 지원현황, 모의/채용 면접 진행, 답변 업로드를 담당한다.

## Must Read

1. `docs/05_agents/AGENTS.md`
2. `docs/04_implementation/team-split-5dev-1pm.md`
3. `docs/01_product/screen-flow.md` 지원자 포털
4. `docs/03_contracts/api-spec.md` 지원자 도메인
5. `docs/02_architecture/data-model.md` Application, Interview, Notification/File
6. `frontend/AGENTS.md`
7. `backend/api/AGENTS.md`

## Owns

- `applications` 지원자 제출/응시 상태
- `application_documents`
- `consent_records`
- `interview_sessions` 런타임 상태
- `interview_answers` 답변 파일 참조 저장

## Outputs

- `/candidate/jobs`
- `/candidate/jobs/{jobId}`
- `/candidate/jobs/{jobId}/applications`
- `/candidate/applications`
- `/candidate/applications/{applicationId}/consent`
- `/candidate/applications/{applicationId}/interview/start`
- `/candidate/applications/{applicationId}/interview`
- `/candidate/mock-interviews/*`
- `/candidate/interviews/{sessionId}/answers`
- `/candidate/interviews/{sessionId}/next-question`
- `/candidate/interviews/{sessionId}/complete`

## Required Checks

- 지원자는 본인 데이터만 접근
- 지원 중복 차단
- 필수 동의 없으면 채용 AI 면접 시작 차단
- 장치 점검 완료 전 면접 시작 차단
- 답변 파일 저장 후 `file_assets` 참조 연결

## Must Coordinate With

- B: `applications` 기업 전형 상태
- C: 질문 세트와 질문 표시 정책
- E: STT/리포트 입력이 되는 답변 데이터
- A: S3 upload, role guard, auth token

