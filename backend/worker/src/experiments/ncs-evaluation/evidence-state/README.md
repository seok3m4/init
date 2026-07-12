# Evidence State Strategy

외부 모델이나 자격 증명 없이 동작하는 결정론적 M1 전략이다. 각 행동 포인트마다 발화 근거 상태를 먼저 만들고, 그 상태만 고정 규칙으로 판정 결과에 매핑한다.

## Separation And Traceability

`createEvidenceStateMaterial`은 transcript, 질문/NCS 의미, 행동 포인트 설명과 required evidence만 복사한다. case ID, question/answer ID, behavior-point ID, fixture tags, expected label, relation expectation은 평가 재료에 포함하지 않는다. frozen output 계약의 `caseId`와 `behaviorPointId`는 판정이 끝난 뒤 출력 어댑터가 그대로 연결한다.

1. `extractBehaviorEvidenceStates`가 행동 포인트별 `BehaviorEvidenceState`를 생성한다.
2. state에는 정확한 quote offset, 감지된 evidence type, supporting/contradicting 구분, 누락 근거만 있다. status, level, score, confidence는 없다.
3. `mapEvidenceState`가 state를 M0의 고정 level/status/score 규칙으로 변환한다.

중간 state를 순수 함수 반환값으로 유지하므로 테스트에서 근거 추출 오류와 단계 매핑 오류를 분리해서 추적할 수 있다.

## Guardrails

- 모든 evidence는 transcript 원문 구간이며 `slice(startChar, endChar) === quote`를 유지한다.
- 민감 속성 및 표정, 시선, 억양, 말속도, 목소리 톤은 scoring text에서 제거한다.
- 행동 포인트마다 relevance와 evidence state를 별도로 계산한다.
- 무응답/무관 답변은 `INSUFFICIENT_EVIDENCE`이며 follow-up budget을 별도로 확인한다.
- 합격 여부나 채용 가능성을 생성하지 않는다.
- case당 추정 비용은 `$0`이고 실행 결과는 동일 입력에 대해 결정론적이다.

## Run

```powershell
cd backend/worker
npm run build
node --test dist/experiments/ncs-evaluation/evidence-state/evaluator.test.js
node dist/experiments/ncs-evaluation/evidence-state/run.js `
  --dataset ../../docs/04_implementation/ncs-evaluation-m0/golden-cases.json `
  --output src/experiments/ncs-evaluation/evidence-state/results.json `
  --runs 5
node ../../scripts/verify-ncs-evaluation-m0.mjs `
  --results src/experiments/ncs-evaluation/evidence-state/results.json
```

## Results

48 case를 5회씩 실행한 결과 hard gate를 통과했고 M2 비교에서 1위로 채택됐다.

| Exact level | Quote coverage | Follow-up | Repeatability | p95 latency | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100.00% | 100.00% | 100.00% | 100.00% | 0.75ms | $0 |

## Remaining Risk

한국어 의미 판정은 설명 기반 domain profile과 evidence 표현 규칙을 사용하므로, 동의어·복합문·간접 표현이 많은 실제 transcript에서는 관련 근거나 claim type을 놓칠 수 있다. 이 전략은 fixture 식별자를 이용한 보정 없이 독립 규칙의 성능을 그대로 기록한다.
