# NCS Evaluation M3 Product Integration

## Status

M2에서 채택한 **evidence-state** 평가기를 모의면접 제품 경로에 연결했다.

~~~text
TEXT_INPUT ─────┐
                ├─ API-097 → ai_process_logs → SQS → worker → guardrail → polling output
STORED_ANSWER ──┘
~~~

- Product contract: **ncs-evaluation-product.v1**
- Worker strategy: **evidence-state**
- Strategy version: **evidence-state-rules-v1**
- Runtime model: **deterministic-evidence-state-v1**
- Process type: **REPORT_GENERATE**
- Process step: **NCS_ANSWER_EVALUATION**
- Queue kind: **MOCK_NCS_ANSWER_EVALUATION**

## Implemented

| Boundary | Implementation | Verification |
| --- | --- | --- |
| Snapshot | 질문 유형을 서버 소유 NCS 유사 프로필과 고정 점수표로 변환 | 동일 질문의 결정적 version hash, 비평가 질문 차단 |
| API | POST /api/v1/candidate/mock-interviews/{sessionId}/ncs-evaluations | source 조합, 세션·질문·답변 소유권, transcript 상태 검증 |
| Queue | client 설정을 제거한 canonical payload 생성 | snapshot, transcript, source identity를 worker 입력으로 고정 |
| Worker | 제품 snapshot을 M0 입력으로 검증·변환 후 evidence-state 실행 | quote offset, evidence 참조, level-score map 재검증 |
| Guardrail | 민감 속성·비언어 신호·채용 판단 표현을 점수 근거에서 제외 | 금지 신호가 evidence quote에 섞이면 process 완료 차단 |
| Polling | 기존 GET /api/v1/ai/jobs/{processLogId}/status 사용 | input/output identity와 snapshot version이 일치한 결과만 노출 |
| Session snapshot | 세션 생성 시 질문별 직무 평가 프로필을 JSONB로 고정 | 같은 session/question 최초값 재사용, 서버 재시작·프로필 변경 격리 |
| Transparency | 결과의 evaluationBasis에 source, 직무, 능력단위와 행동 기준 포함 | worker output과 immutable input snapshot 일치 검증 |

**INTRO**, **CLOSING**은 현재 NCS 점수 대상이 아니다. **TECHNICAL**, **EXPERIENCE**, **SITUATION**, **FOLLOW_UP** 질문만 평가 snapshot을 가진다.

## Source Invariants

| Source | Canonical transcript | answerId |
| --- | --- | --- |
| **TEXT_INPUT** | 요청 transcript를 trim하고 1~20,000자로 검증 | 금지 |
| **STORED_ANSWER** | repository에 저장된 STT transcript만 사용 | 필수 |

두 source는 worker 이후 같은 **ncs-evaluation-product.v1** output 구조를 사용한다. **TEXT_INPUT** 결과만 answerId를 생략한다.

## Validation

패키지 build 후 제품 경계 왕복 하네스를 실행한다.

~~~powershell
Set-Location backend/common
npm run build

Set-Location ../api
npm run build

Set-Location ../worker
npm run build

Set-Location ../..
node scripts/verify-ncs-evaluation-m3.mjs
~~~

현재 검증 범위:

- API NCS route 및 snapshot resolver 테스트
- API typecheck
- worker typecheck와 전체 worker 테스트
- polling parser 및 기존 AI job polling 회귀 테스트
- TEXT_INPUT API → worker → polling 왕복
- STORED_ANSWER API → worker → polling 왕복

## Decisions

- 제품 평가 전략은 M2 자동 비교 1위인 **evidence-state** 하나만 사용한다.
- AiProcessType migration 없이 기존 **REPORT_GENERATE** 아래 step으로 분기한다.
- confidence는 설명용이며 점수 가중치로 사용하지 않는다.
- 비언어 정보는 NCS 점수에 포함하지 않는다. 별도 전달 방식 코칭을 추가하더라도 NCS 행동 근거와 분리한다.
- 근거가 부족하면 점수를 억지로 만들지 않고 **INSUFFICIENT_EVIDENCE**와 꼬리질문 후보를 반환한다.
- worker 완료 결과와 polling 노출 경계에서 같은 불변식을 이중 검증한다.

## Known Limits

- 현재 snapshot source는 **SYNTHETIC_NCS_LIKE**다. 공식 NCS 카탈로그 코드·버전·원문 연결은 아직 없다.
- 규칙 기반 한국어 evaluator이므로 실제 사용자 발화와 STT 오류에 대한 별도 calibration이 필요하다.
- 내장 직무 프로필은 8개 개발 직무의 합성 기준이며 NCS 전문가 검증, NCS 인증 또는 채용 성과 예측력을 의미하지 않는다.
- 실제 화상면접에서 수집한 발화·STT·재답변 데이터가 없어 현장 분포의 오탐·미탐과 사용자 이해도는 아직 검증하지 못했다.

## Post-M3 Hardening

- 동일 deduplication key의 PENDING, RUNNING, COMPLETED process를 DB unique 제약으로 재사용한다.
- 가드레일 통과 결과를 `ncs_evaluation_revisions`에 append-only로 저장한다.
- `STORED_ANSWER` 최신 유효 revision을 모의면접 리포트의 `ncsEvaluations`에 투영한다.
- 텍스트 route의 polling context를 sessionStorage에 보관하고 timeout·새로고침 뒤 같은 process를 재조회한다.
- API 시작 시 선택한 직무 프로필을 `ncs_evaluation_snapshots`에 고정하고 결과 화면에서 합성/공식 출처를 구분한다.

## M4 Ready

M4 텍스트 route는 다음 경계만 사용한다.

1. 직무와 질문 유형을 선택해 기존 mock session을 시작한다.
2. 질문을 표시하고 답변 textarea를 받는다.
3. TEXT_INPUT으로 API-097을 호출한다.
4. 기존 AI job status를 polling한다.
5. level, score, quote, missing evidence와 follow-up을 사용자용 결과로 표시한다.

M4 client는 NCS context, behavior point, score map, strategy 또는 snapshot을 생성하거나 전송하지 않는다.
