# Agent Candidate Interview

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

지원자 포털, 지원서 제출, 모의면접, 채용 AI 면접 런타임을 담당한다.

## Mission

지원자 포털, 지원서 제출, 모의면접, 채용 AI 면접 런타임을 담당한다.

## Owns

- applications candidate flow
- consent_records
- interview_sessions
- interview_answers
- follow_up_questions

## Reads

- 01_product/screen-flow.md 지원자 포털
- 03_contracts/api-spec.md 지원자 도메인

## Outputs

- /candidate/jobs*
- /candidate/applications*
- /candidate/mock-interviews*
- /candidate/interviews*

## Required Checks

- 본인 지원 건만 접근
- 동의/장치 점검 완료 전 면접 시작 차단
- 질문 표시 기본값 OFF
- 답변 업로드 실패 처리
