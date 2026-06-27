# Agent C: Company Interview/Criteria

## Mission

기업 면접 설정, 평가 기준, 질문 뱅크, JD 기반 질문 생성 요청부를 담당한다.

## Must Read

1. `docs/05_agents/AGENTS.md`
2. `docs/04_implementation/team-split-5dev-1pm.md`
3. `docs/03_contracts/api-spec.md` 기업 - 면접관리
4. `docs/02_architecture/data-model.md` Recruiting, Interview
5. `docs/02_architecture/async-ai-pipeline.md`
6. `frontend/AGENTS.md`
7. `backend/api/AGENTS.md`

## Owns

- `criterion_tags`
- `evaluation_criteria`
- `question_bank`
- 면접 시간 정책

## Outputs

- `/company/interviews/settings`
- `/company/interviews/evaluation-criteria/suggest`
- `/company/interviews/evaluation-criteria`
- `/company/interviews/questions`
- `/company/interviews/questions/generate`
- `/company/interviews/question-sets`
- `/company/interviews/time-policy`

## Required Checks

- 평가 기준 배점 합계 검증
- 질문 유형 enum 검증
- 공고별 질문 연결 검증
- JD 기반 생성 결과 저장 전 검증

## Must Coordinate With

- E: AI 질문 생성, 리포트 평가 기준 사용
- B: 공고/JD 데이터
- D: 면접 질문 표시와 질문 세트 소비

