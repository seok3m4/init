# NCS Evaluation M2 Selection

M1 전략의 `results.json`을 검증하고 채택 결정을 준비하는 단계다. M1과 병렬로 운영하며 결과가 들어올 때마다 비교 리포트를 갱신한다.

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

## Human Decision Checks

자동 순위가 나온 뒤 다음 항목을 decision record에 작성한다.

- baseline보다 의미 판정이 실제로 개선됐는가
- 합성 fixture에 과적합된 규칙이나 prompt가 있는가
- 실패 시 fallback과 재시도 비용이 허용 가능한가
- 근거와 판정 이유를 사용자에게 설명할 수 있는가
- 운영 모델과 prompt 버전을 재현할 수 있는가
- M3 이후 생산 계약으로 옮길 때 제거할 실험 코드가 무엇인가

## M2 Done

- baseline 외 2개 이상의 전략이 hard gate를 통과한다.
- 모든 전략이 48 case x 5 runs를 제출한다.
- 자동 비교 리포트가 생성된다.
- `decision-record-template.md`를 복사해 선택·탈락 사유를 작성한다.
- 채택 전략만 production 설계 대상으로 이동하고 나머지는 실험 브랜치에 유지한다.
