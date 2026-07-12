# Common Rubric Strategy

하나의 구조화 프롬프트가 transcript, NCS 맥락, 행동 포인트를 동시에 읽고 근거와 단계를 직접 반환하는 전략이다.

## Deliverables

- `evaluator.ts`: OpenAI provider를 사용하되 `NcsEvaluationStrategy` 구현
- `evaluator.test.ts`: provider mock, JSON 파싱 실패, 재시도, 근거 오프셋 테스트
- `run.ts`: `runNcsStrategyCli` 사용
- `results.json`: 48 case x 5 runs
- 이 README의 결과·실패 유형 갱신

## Constraints

- 모델이 임의 score를 생성해도 무시하고 level로 다시 매핑한다.
- 인용문이 transcript에 없으면 결과를 실패 처리하거나 재생성한다.
- case ID, tags, expected 필드는 모델 입력에 전달하지 않는다.
- 민감 속성과 비언어 신호는 prompt 입력에서 제거한다.

## Hypothesis

구현은 가장 단순하지만 근거 추출과 단계 판정이 한 호출에 결합돼 경계 사례의 재현성이 낮을 수 있다.
