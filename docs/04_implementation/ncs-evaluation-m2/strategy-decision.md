# NCS Evaluation Strategy Decision

## Decision

- Selected strategy: `evidence-state`
- Decision date: 2026-07-12
- M0 contract version: `ncs-evaluation-m0.v1`
- Golden dataset version: `ncs-evaluation-golden.v1`
- Selected strategy version: `evidence-state-rules-v1`
- Runtime model: `deterministic-evidence-state-v1`

## Candidate Results

`current-comparison.md`의 48 case x 5 runs 비교를 기준으로 네 실험 전략이 모두 hard gate를 통과했다.

| Strategy | Exact level | Quote coverage | Follow-up | Repeatability | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| `evidence-state` | 100.00% | 100.00% | 100.00% | 100.00% | 선택 |
| `hybrid-evidence-anchor-deterministic` | 98.04% | 97.89% | 100.00% | 100.00% | 보류 |
| `common-rubric-deterministic` | 96.08% | 100.00% | 100.00% | 100.00% | 보류 |
| `pairwise-anchor-deterministic` | 96.08% | 98.95% | 100.00% | 100.00% | 보류 |

baseline은 M0 기준선이므로 실험 후보 채택 표에서는 제외했다.

## Why Selected

- 단계, 상태, 필수 인용, 꼬리질문 판단이 fixture에서 모두 정확했다.
- 근거 추출과 단계 매핑이 중간 `BehaviorEvidenceState`로 분리돼 오판 원인을 추적하기 쉽다.
- 정확한 transcript quote와 누락 근거가 같은 state에 있어 STT 입력, 꼬리질문, report evidence로 연결하기 쉽다.
- 결정론적 로컬 실행으로 5회 반복 결과가 동일하고 외부 호출 비용이 없다.
- p95 0.75ms는 다른 후보보다 느리지만 제품 체감이나 worker 처리량에 영향을 줄 수준이 아니다.

## Rejected Alternatives

| Strategy | Rejection reason | Reusable component |
| --- | --- | --- |
| Hybrid | 추가 arbitration 복잡도에도 정확도와 인용률이 더 낮음 | 경계 진단과 도메인 오분류 테스트 |
| Common rubric | 구조는 단순하지만 단계 경계 정확도가 더 낮음 | 공통 feature 신호와 민감 문장 제거 |
| Pairwise | 가장 빠른 후보지만 앵커 비교가 인용과 단계 정확도를 개선하지 못함 | 인접 앵커 설명과 짧은 강한 답변 테스트 |

## Known Limitations

- 합성 NCS 유사 fixture에 대한 100%이며 공식 NCS 타당성이나 실제 사용자 일반화를 증명하지 않는다.
- 한국어 domain profile과 표현 규칙 밖의 동의어, 간접 표현, STT 오류에서 근거를 놓칠 수 있다.
- 실제 NCS 카탈로그와 다양한 직무를 적용하기 전 domain profile의 확장 전략이 필요하다.
- 비언어 정보는 NCS 점수에서 제외하며 별도 전달 방식 코칭으로만 다룬다.

## Production Migration

- 실험 입력·출력에서 제품 API DTO로 옮기기 전 `docs/03_contracts`를 먼저 갱신한다.
- 긴 평가 작업은 기존 `ai_process_logs → SQS → worker → guardrail` 경계를 사용한다.
- 텍스트 데모 route는 채택 평가기와 동일한 입력을 사용하고, 이후 textarea transcript를 STT transcript로 교체한다.
- 평가 결과는 `evaluation_reports`, `report_scores`, `report_evidences` 저장 계약에 맞춘다.
- 미채택 전략은 회귀 비교용 실험 코드로 유지하고 생산 실행 경로에서는 import하지 않는다.
- M3 진입 조건: 제품 API 경계, 질문 생성 입력, 평가 결과 DTO, 비동기 상태 전이를 문서로 고정한다.
