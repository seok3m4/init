# Evidence State Strategy

1차 호출에서 발화 근거만 추출하고 2차 단계에서 행동 포인트 충족 상태를 판정하는 전략이다.

## Deliverables

- `evidence-extractor.ts`: quote와 offset, claim type만 생성
- `evaluator.ts`: 추출 근거를 입력으로 단계 판정
- `evaluator.test.ts`: 근거 환각, 누락 근거, 다중 행동 포인트 독립성 테스트
- `run.ts`, `results.json`, 결과 분석

## Constraints

- 1차 추출기는 단계와 score를 알 수 없다.
- 2차 판정기는 원문 전체 대신 검증된 quote와 NCS 기준을 우선 사용한다.
- quote offset 검증 실패 시 해당 case를 재시도하며 비용에 포함한다.
- case ID, tags, expected 필드는 모델 입력에 전달하지 않는다.

## Hypothesis

호출 비용은 늘지만 근거 환각을 줄이고 꼬리질문용 누락 근거를 더 정확하게 생성할 수 있다.
