# Backend Worker AGENTS

Node.js AI/비동기 worker 영역이다. E가 1차 소유하고 A가 배포/환경변수를 리뷰한다.

## Responsibilities

- SQS message consume
- OpenAI Agents SDK / GPT-4 class model 호출
- MediaPipe 기반 영상/비언어 보조 분석
- STT 처리
- 서류 텍스트 추출
- 꼬리질문 생성
- 리포트 생성
- 가드레일 검증
- 임베딩 생성

## Rules

- 모든 작업은 `ai_process_logs` 상태를 갱신한다.
- 작업 시작 전 `RUNNING`, 성공 시 `COMPLETED`, 실패 시 `FAILED`를 기록한다.
- AI 결과는 `ai_guardrail_logs` 검증 후 최종 저장한다.
- 재시도 가능한 실패와 불가능한 실패를 구분해 기록한다.
- 원본 파일은 S3 key로 읽고 DB에는 메타데이터와 결과만 저장한다.
