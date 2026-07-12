# Pairwise Strategy

지원자 근거를 합성 기준 답변 또는 단계 앵커와 쌍대 비교해 최종 단계를 결정하는 전략이다.

## Deliverables

- `anchor-builder.ts`: 행동 포인트별 비교 앵커 생성 또는 고정
- `evaluator.ts`: 인접 단계 비교와 최종 단계 결정
- `evaluator.test.ts`: 비교 순서 변경 불변성, 단계 경계, 기준 답변 누출 테스트
- `run.ts`, `results.json`, 결과 분석

## Constraints

- 골든 답변의 expected 문장을 비교 앵커로 사용하지 않는다.
- 같은 답변을 단계별 앵커와 비교할 때 비교 순서를 무작위화하거나 상쇄한다.
- 인용 근거는 반드시 원문에서 별도로 검증한다.
- case ID, tags, expected 필드는 모델 입력에 전달하지 않는다.

## Hypothesis

절대 단계 판정보다 경계 안정성이 좋아질 수 있지만 호출 수와 앵커 관리 비용이 증가한다.
