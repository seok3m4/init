# Common Rubric Strategy

transcript와 행동 포인트 설명을 하나의 공통 구조화 루브릭으로 직접 판정하는 결정론적 전략이다. 외부 API나 baseline 구현을 사용하지 않는다.

## Judgment

1. 행동 포인트 설명과 연결된 NCS 요소명에서 일반 의미 개념을 추출한다.
2. transcript 문장마다 의미 관련성을 계산하고 민감 속성·비언어 신호만 있는 문장을 제외한다.
3. 관련 문장에서 `action`, `rationale`, `result`, `verification`, `reflection`, `contradiction` 신호를 각각 계산한다.
4. M0의 고정 단계 의미와 score map으로 행동 포인트를 독립 판정한다.
5. 선택한 원문 문장만 정확한 UTF-16 문자 오프셋과 함께 근거로 반환한다.

`caseId`는 출력 계약을 위한 불투명 transport 값으로만 되돌려 준다. 판정과 evidence ID 생성에는 case ID, answer ID, question ID, tags, expected, relation을 사용하지 않는다.

## Run

```powershell
cd backend/worker
npm run build
node dist/experiments/ncs-evaluation/common-rubric/run.js `
  --dataset ../../docs/04_implementation/ncs-evaluation-m0/golden-cases.json `
  --output src/experiments/ncs-evaluation/common-rubric/results.json `
  --runs 5
```

## Tradeoffs

- 장점: 비용과 자격 증명이 필요 없고 동일 입력에 완전히 반복 가능하며 신호별 판정 이유를 설명할 수 있다.
- 한계: 한국어 어휘 기반 의미 개념이므로 새로운 표현이나 간접적인 인과 관계를 놓칠 수 있다.
- 실패 원칙: fixture 식별자나 기대값으로 정확도를 보정하지 않고 일반 루브릭 규칙의 실제 결과를 유지한다.

## Measured Results

48 case를 5회씩 실행한 결과 hard gate를 통과했다.

| Exact level | Quote coverage | Follow-up | Repeatability | p95 latency | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 96.08% | 100.00% | 100.00% | 100.00% | 0.91ms | $0 |
