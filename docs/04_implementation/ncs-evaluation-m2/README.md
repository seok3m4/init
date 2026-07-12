# NCS Evaluation M2 Selection

M1 전략의 `results.json`을 검증하고 채택 결정을 준비하는 단계다. M1과 병렬로 운영하며 결과가 들어올 때마다 비교 리포트를 갱신한다.

M2는 현재 워크트리 안에서 사용할 평가기 전략을 고르는 내부 단계다. 다른 팀원이 같은 설계 문서로 만드는 별도 완성품과의 비교는 각 제품이 텍스트 수직 기능 또는 화상면접 수직 기능을 완료한 뒤 공통 사용자 시나리오로 별도 수행한다.

## Start Immediately

baseline만으로 비교기 smoke test:

```powershell
node scripts/compare-ncs-evaluation-results.mjs `
  --results backend/worker/src/experiments/ncs-evaluation/baseline/results.json
```

전략 결과가 추가되면 `--results`를 반복한다.

```powershell
node scripts/compare-ncs-evaluation-results.mjs `
  --results backend/worker/src/experiments/ncs-evaluation/baseline/results.json `
  --results backend/worker/src/experiments/ncs-evaluation/common-rubric/results.json `
  --results backend/worker/src/experiments/ncs-evaluation/evidence-state/results.json `
  --results backend/worker/src/experiments/ncs-evaluation/pairwise/results.json `
  --results backend/worker/src/experiments/ncs-evaluation/hybrid/results.json
```

기본 출력:

```text
docs/04_implementation/ncs-evaluation-m2/current-comparison.json
docs/04_implementation/ncs-evaluation-m2/current-comparison.md
```

## Selection State

- `AWAITING_CANDIDATES`: baseline 외 hard gate 통과 전략이 2개 미만
- `READY_FOR_DECISION`: baseline 외 hard gate 통과 전략이 2개 이상

`READY_FOR_DECISION` 전에는 `recommendedStrategy`를 만들지 않는다. `provisionalLeader`는 도구 검증과 진행 상황 확인용이다.

## Lexicographic Ranking

임의 가중 합산을 사용하지 않는다.

1. Hard gate PASS
2. Exact level rate
3. Expected quote coverage
4. Follow-up decision rate
5. Repeatability
6. p95 latency
7. Average estimated cost
8. Strategy ID 안정 정렬

## Owner Decision Checks

자동 순위가 나온 뒤 다음 항목을 decision record에 작성한다.

- baseline보다 의미 판정이 실제로 개선됐는가
- 합성 fixture에 과적합된 규칙이나 prompt가 있는가
- 실패 시 fallback과 재시도 비용이 허용 가능한가
- 근거와 판정 이유를 사용자에게 설명할 수 있는가
- 운영 모델과 prompt 버전을 재현할 수 있는가
- M3 이후 생산 계약으로 옮길 때 제거할 실험 코드가 무엇인가

팀 합의와 cross-owner 승인은 이 결정의 선행 조건이 아니다. 단일 구현자가 자동 비교 결과와 위 점검 항목을 근거로 채택하고, 생산 API·DB 경계를 실제로 바꾸는 시점에만 프로젝트 공통 ownership 규칙을 적용한다.

## Product Comparison Boundary

다른 팀원의 완성품과 비교할 때 M2의 내부 `strategyId` 순위를 그대로 사용하지 않는다. 모든 완성품에 동일한 직무, 질문, 답변과 실패 시나리오를 입력하고 다음 제품 수준 결과를 비교한다.

- 직무 선택부터 결과 표시까지 한 흐름으로 완료되는가
- 같은 답변에서 점수와 근거가 재현되는가
- 무응답과 근거 부족에서 꼬리질문 또는 평가 불충분 처리가 가능한가
- STT 실패와 민감 속성 입력을 안전하게 처리하는가
- 결과가 사용자가 이해할 수 있는 리포트로 연결되는가

## M2 Done

- baseline 외 2개 이상의 전략이 hard gate를 통과한다.
- 모든 전략이 48 case x 5 runs를 제출한다.
- 자동 비교 리포트가 생성된다.
- `decision-record-template.md`를 복사해 선택·탈락 사유를 작성한다.
- 채택 전략만 production 설계 대상으로 이동하고 나머지는 실험 브랜치에 유지한다.
