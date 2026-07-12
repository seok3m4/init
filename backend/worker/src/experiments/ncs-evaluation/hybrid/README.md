# Self-contained Hybrid Strategy

발화별 evidence-state pass와 인접 단계 anchor 비교를 결합한 로컬 결정론적 전략이다. 외부 API나 자격 증명을 사용하지 않으며 다른 전략 디렉터리의 구현을 import하지 않는다.

## Evaluation Flow

1. transcript를 소수점 내부의 마침표를 보존하면서 원문 offset 기반 문장 구간으로 나눈다.
2. 민감 속성과 표정, 시선, 억양, 말속도 표현을 평가 텍스트에서 제외한다.
3. 행동 포인트 설명으로 평가 도메인을 선택하고, 각 행동 포인트마다 관련 구간과 `ACTION`, `RATIONALE`, `RESULT`, `REFLECTION`, `CONSTRAINT`, `TRADEOFF` 상태를 독립 생성한다.
4. 무관/무응답, 상충 행동, 일반론, 부분 수행, 완전한 행동 사슬, 재발 방지 순으로 evidence-state 단계를 정한다.
5. 2~4단계 경계에서만 잠정 단계와 바로 아래/현재/바로 위 anchor를 비교한다.

평가 함수는 입력에서 `caseId`를 먼저 분리하고 case-blind 함수에 질문, 행동 포인트, transcript와 정책만 전달한다. `caseId`는 M0 출력 계약을 위한 envelope echo에만 사용한다. 골든 `expected`, `tags`, `relations`는 런타임 입력에 존재하지 않으며 평가기가 읽지 않는다.

## Arbitration

evidence-state와 인접 anchor가 충돌하면 낮은 단계를 선택한다. anchor가 더 높은 경우에는 그 단계의 직접 근거 gate가 모두 충족될 때만 상향한다. 상충/자기모순은 항상 1단계, 관련 발화 부재는 항상 `INSUFFICIENT_EVIDENCE`로 고정한다.

## Run

```powershell
cd backend/worker
npm run build
node --test dist/experiments/ncs-evaluation/hybrid/evaluator.test.js
node dist/experiments/ncs-evaluation/hybrid/run.js `
  --dataset ../../docs/04_implementation/ncs-evaluation-m0/golden-cases.json `
  --output src/experiments/ncs-evaluation/hybrid/results.json `
  --runs 5
node ../../scripts/verify-ncs-evaluation-m0.mjs `
  --results src/experiments/ncs-evaluation/hybrid/results.json
```

## Results

48 case를 5회씩 실행한 결과 hard gate를 통과했다. 첫 실행에서 요구사항 행동 포인트를 커뮤니케이션 도메인으로 오분류한 문제를 발견해, 요구·수용 기준 판별을 일반 관계자 커뮤니케이션보다 먼저 적용하도록 수정했다.

| Exact level | Quote coverage | Follow-up | Repeatability | p95 latency | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 98.04% | 97.89% | 100.00% | 100.00% | 0.37ms | $0 |
