# Hybrid Strategy

검증된 발화 근거와 행동 포인트 충족 상태를 만든 뒤 경계 사례에만 쌍대 비교를 적용하는 전략이다.

## Deliverables

- `evidence-extractor.ts`
- `state-evaluator.ts`
- `boundary-comparator.ts`
- `evaluator.ts`, `evaluator.test.ts`, `run.ts`, `results.json`
- 경계 비교가 실행된 case 비율과 추가 비용 분석

## Constraints

- 명확한 case에는 불필요한 pairwise 호출을 하지 않는다.
- 경계 판단 조건을 코드로 명시한다.
- 최종 근거는 원문 quote만 허용한다.
- case ID, tags, expected 필드는 모델 입력에 전달하지 않는다.

## Hypothesis

evidence-state의 설명 가능성을 유지하면서 제한된 추가 비용으로 단계 경계를 보강할 수 있다.
