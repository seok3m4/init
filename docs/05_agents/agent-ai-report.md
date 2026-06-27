# Agent AI Report

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

AI 서류 추출, STT, 꼬리질문, 리포트 생성, 근거, 가드레일, 임베딩을 담당한다.

## Mission

AI 서류 추출, STT, 꼬리질문, 리포트 생성, 근거, 가드레일, 임베딩을 담당한다.

## Owns

- ai_process_logs
- ai_guardrail_logs
- evaluation_reports
- report_scores
- report_evidences
- embeddings

## Reads

- 02_architecture/async-ai-pipeline.md
- 03_contracts/api-spec.md AI/리포트 처리

## Outputs

- /reports/*
- /ai/guardrails/validate
- 비동기 processLogId

## Required Checks

- 가드레일 통과 전 최종 저장 금지
- 채용/모의 리포트 표현 정책 분리
- FAILED 상태와 재시도 사유 기록
- 근거 없는 점수 저장 금지
