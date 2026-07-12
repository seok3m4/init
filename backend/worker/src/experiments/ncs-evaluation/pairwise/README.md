# Pairwise Anchor Strategy

행동 포인트별 관련 발화에서 근거 상태를 추출하고 일반화된 1~5단계 앵커를 인접 단계끼리 비교하는 결정론적 전략이다. 외부 API와 인증 정보가 필요하지 않으며 실험용 구현이다.

## Independence

- 판정 코어에는 transcript, 행동 포인트 설명, 필수 근거 유형만 전달한다.
- `caseId`는 출력 계약을 맞추기 위해 외부 어댑터에서 그대로 복사할 뿐 판정, 인용, evidence ID에 사용하지 않는다.
- `answerId`, `questionId`, tags, expected, relation 데이터는 판정 코어가 읽지 않는다.
- 행동 포인트 ID는 판정 후 결과 연결과 evidence ID namespace에만 사용한다.
- 테스트는 판정이 끝난 뒤 정확도 측정에만 golden expected를 사용한다.

## Method

1. 행동 포인트 설명의 의미 단서로 일반 주제 어휘를 선택한다.
2. 민감 속성과 표정, 시선, 억양 등 비언어 신호만 있는 문장을 제외한다.
3. 관련 transcript 문장을 정확한 원문 offset과 함께 추출한다.
4. 부적절한 행동/자기모순, 본인 행동, 판단 근거, 결과, 후속 개선 여부를 이진 profile로 만든다.
5. profile과 인접한 두 단계 앵커의 가중 거리를 양방향으로 계산해 순서 효과를 상쇄하고, 동률이면 낮은 단계에 둔다.

| Level | Generic anchor |
| ---: | --- |
| 1 | 관련 발화가 있으나 부적절한 행동 또는 자기모순이 확인됨 |
| 2 | 관련 개념이나 상황은 있으나 구체적인 본인 행동이 부족함 |
| 3 | 구체적인 본인 행동은 있으나 판단 근거 또는 결과가 불완전함 |
| 4 | 행동, 판단 근거, 결과가 연결됨 |
| 5 | 4단계 근거에 재발 방지나 재사용 가능한 후속 개선이 더해짐 |

답변 길이, 유창함, 숫자 자체는 단계 상승 조건이 아니다. 각 행동 포인트는 별도의 관련 문장 집합과 profile로 독립 평가한다.

## Run

```powershell
cd backend/worker
npm run build
node --test dist/experiments/ncs-evaluation/pairwise/evaluator.test.js
node dist/experiments/ncs-evaluation/pairwise/run.js `
  --dataset ../../docs/04_implementation/ncs-evaluation-m0/golden-cases.json `
  --output src/experiments/ncs-evaluation/pairwise/results.json `
  --runs 5
node ../../scripts/verify-ncs-evaluation-m0.mjs `
  --results src/experiments/ncs-evaluation/pairwise/results.json
```

## Limits

- 한국어 규칙 어휘 기반이므로 새로운 직무 표현과 동의어에서 관련 근거를 놓칠 수 있다.
- 문장 하나에 민감 속성과 직무 근거가 함께 있으면 보수적으로 그 문장 전체를 제외한다.
- 일반 앵커는 설명 가능성과 재현성을 우선하며 실제 산업 타당성을 보장하지 않는다.

## Measured Results

48 case를 5회씩 실행한 결과 hard gate를 통과했다.

| Exact level | Quote coverage | Follow-up | Repeatability | p95 latency | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 96.08% | 98.95% | 100.00% | 100.00% | 0.32ms | $0 |
