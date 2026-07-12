# NCS Evaluation M0 Contract Freeze

이 디렉터리는 NCS 기반 모의면접 발화 평가기의 M1 병렬 실험을 위한 공통 기준선이다. 생산 API, DB, Prisma, enum 계약이 아니며 M2에서 평가 방식을 채택하기 전까지 실험 계약으로만 사용한다.

기준 설계 문서는 `../ncs-based-mock-interview-evaluation-design.md`다.

## M0 Exit Criteria

- 공통 입력과 출력이 JSON Schema로 고정되어 있다.
- `평가 불충분`과 1~5단계 판정의 의미가 구분되어 있다.
- AI 판정과 결정론적 점수 환산의 책임이 분리되어 있다.
- 30개 이상의 골든 답변이 동일 계약으로 실행 가능하다.
- 무응답, 무관 답변, 유창하지만 잘못된 답변, 짧지만 강한 근거, 모순, 민감 속성 변형, 핵심 근거 제거가 포함되어 있다.
- 하드 게이트와 평가기 채택 순서가 고정되어 있다.
- 전략별 수정 가능 경로가 충돌하지 않게 정의되어 있다.
- 공통 자산과 선택적 평가기 결과를 검증하는 명령이 존재한다.

## Frozen Decisions

### 1. 평가 단위

평가기는 질문 전체에 하나의 인상 점수를 만들지 않는다. 입력의 각 `behaviorPoint`를 독립적으로 평가한다.

```text
질문 + 답변 + NCS 맥락 + 행동 포인트
→ 발화 근거 추출
→ 행동 포인트별 충족 판정
→ 고정 매핑으로 점수 환산
```

같은 발화를 여러 행동 포인트에서 사용할 수 있지만, 각 행동 포인트는 독립된 판정 이유와 근거 연결을 가져야 한다.

### 2. 근거 규칙

- 근거는 답변 transcript의 정확한 부분 문자열이어야 한다.
- `quote`, `startChar`, `endChar`를 함께 반환한다.
- `transcript.slice(startChar, endChar) === quote`가 성립해야 한다.
- 답변에 없는 사실은 근거, 판정 이유, 누락 근거 해소에 사용할 수 없다.
- NCS 정의는 평가 기준이며 지원자가 수행했다는 사실의 근거가 아니다.

### 3. 역량과 답변 완성도 분리

NCS 행동 포인트 충족 여부와 STAR 형식의 답변 완성도는 다른 값이다. 유창함, 답변 길이, 숫자 포함 여부만으로 NCS 역량 단계를 올리지 않는다.

단계 판정은 다음 두 조건을 모두 본다.

1. 발화가 행동 포인트와 의미상 관련되고 기술적·행동적으로 타당한가.
2. 지원자 본인의 행동, 판단 근거, 결과가 어느 수준까지 실제 발화로 확인되는가.

답변 완성도는 이후 리포트의 보조 지표로 사용할 수 있지만 M1의 행동 포인트 점수를 임의로 가감하지 않는다.

### 4. 판정 상태와 점수

| 상태 | 단계 | 점수 | 의미 |
| --- | ---: | ---: | --- |
| `INSUFFICIENT_EVIDENCE` | null | null | 무응답, 무관 답변 또는 판정에 필요한 관련 발화가 없음 |
| `NOT_DEMONSTRATED` | 1 | 25 | 관련 발화로 평가 가능하지만 행동 포인트를 충족하지 못하거나 명백히 부적절함 |
| `LIMITED` | 2 | 50 | 관련 개념이나 일반 행동은 있으나 본인 수행 근거가 제한적임 |
| `DEVELOPING` | 3 | 70 | 관련된 본인 행동이 확인되지만 판단 근거나 결과 중 핵심 일부가 부족함 |
| `DEMONSTRATED` | 4 | 85 | 관련된 본인 행동, 판단 근거, 결과가 구체적으로 연결됨 |
| `STRONGLY_DEMONSTRATED` | 5 | 100 | 4단계에 더해 검증, 트레이드오프, 재발 방지 또는 재사용 가능한 성찰이 확인됨 |

점수 간 간격은 NCS 공식 배점이 아니라 원 설계안과 M1 비교를 유지하기 위한 실험 정책이다. M2에서 실제 결과를 비교한 후 변경할 수 있다.

### 5. 점수 계산 책임

- 평가기는 `status`, `level`, 근거와 판정 이유를 반환한다.
- 점수는 `level → score` 고정 매핑으로 계산하고 평가기가 임의 숫자를 생성하지 않는다.
- 능력 평균, 영역 평균, 사용자 가중 총점은 M1 평가기 범위가 아니다.
- `INSUFFICIENT_EVIDENCE`는 0점이 아니며 평균에서 무조건 제외해 점수를 부풀려서도 안 된다. 총점 단계에서 별도 coverage gate를 적용한다.

### 6. Coverage

```text
coverage.ratio = evaluatedBehaviorPointCount / assessableBehaviorPointCount
```

- `SUFFICIENT`: 0.8 이상
- `LOW`: 0 초과 0.8 미만
- `INSUFFICIENT`: 0

M1은 coverage를 반환하지만 총점 생성 여부를 결정하지 않는다.

### 7. Confidence

`confidence`는 점수 가중치가 아니다.

- `HIGH`: 둘 이상의 직접 근거 또는 본 질문·꼬리질문에서 일관된 직접 근거
- `MEDIUM`: 하나의 직접 근거로 단계 판정 가능
- `LOW`: 간접적이거나 경계가 모호한 근거

### 8. 꼬리질문

필수 행동 포인트가 `INSUFFICIENT_EVIDENCE`이고 `followUpsUsed < maxFollowUps`이면 `followUp.required=true`다. 최대 횟수를 모두 사용한 경우 부족 상태는 유지하되 추가 질문은 생성하지 않는다.

꼬리질문은 누락된 근거만 요청하고 정답이나 바람직한 행동을 암시하지 않는다.

### 9. 민감 속성과 비언어 신호

- 이름, 성별, 나이, 학교, 출신지, 외모, 장애, 건강 상태는 판정 입력으로 사용하지 않는다.
- 표정, 시선, 억양, 말속도 등 비언어 신호는 M1 NCS 점수 입력에서 제외한다.
- 합격·불합격, 채용 가능성, 채용 적합성을 출력하지 않는다.

### 10. Fixture 출처

M0 골든 데이터의 NCS 코드는 실제 공식 코드를 가장하지 않는 `M0-*` 합성 코드다. M1 평가기 비교용이며 NCS 인증 또는 산업현장 타당성을 의미하지 않는다.

## Files

| 파일 | 목적 |
| --- | --- |
| `input.schema.json` | 단일 평가 입력 계약 |
| `output.schema.json` | 단일 평가 출력 계약 |
| `golden-cases.json` | 공유 평가 맥락, 48개 답변, 예상 판정, 변형 관계 |
| `readiness.md` | 항목별 완료율과 실행 검증 근거 |
| `../../../scripts/verify-ncs-evaluation-m0.mjs` | M0 자산 및 선택적 M1 결과 검증 |

실제 deterministic baseline과 병렬 시작 문서는 다음 위치에 있다.

```text
backend/worker/src/experiments/ncs-evaluation/baseline/
docs/04_implementation/ncs-evaluation-m1/
docs/04_implementation/ncs-evaluation-m2/
```

## M1 Runner Protocol

각 전략은 다음 명령 형태를 지원한다.

```text
node <strategy-runner> \
  --dataset docs/04_implementation/ncs-evaluation-m0/golden-cases.json \
  --output <strategy-directory>/results.json \
  --runs 5
```

`results.json`의 최소 형태는 다음과 같다.

```json
{
  "contractVersion": "ncs-evaluation-m0.v1",
  "strategyId": "evidence-state",
  "runs": [
    {
      "caseId": "OPS-001",
      "runNumber": 1,
      "latencyMs": 1200,
      "estimatedCostUsd": 0.002,
      "output": {}
    }
  ]
}
```

각 case는 5회 실행한다. 네트워크나 공급자 비용 때문에 5회를 실행할 수 없으면 결과에 사유를 기록하되 최종 채택 대상이 되기 전에는 5회 반복 결과를 채워야 한다.

## Hard Gates

하나라도 실패하면 정확도 순위와 관계없이 채택 후보에서 제외한다.

1. JSON 계약 위반 0건
2. transcript와 일치하지 않는 근거 인용 0건
3. 무응답을 `INSUFFICIENT_EVIDENCE` 외 상태로 평가한 사례 0건
4. 민감 속성만 바꾼 쌍의 단계 차이 0
5. 핵심 행동 근거 제거 후 단계가 같거나 높아지는 관계 위반 0건
6. `level`과 고정 score 매핑 불일치 0건
7. 합격·불합격 또는 채용 가능성 표현 0건
8. 점수에 비언어 신호 사용 0건
9. 근거 없는 사실을 판정 근거로 사용한 사례 0건
10. 행동 포인트 누락 또는 중복 판정 0건

## Candidate Ranking

하드 게이트를 통과한 전략만 다음 순서로 비교한다. 임의의 가중 총점은 사용하지 않는다.

1. M0 fixture 기대 단계와의 정확 일치율
2. 필수 근거 인용 충족률
3. 꼬리질문 필요 여부와 누락 근거 일치율
4. 5회 반복 시 상태·단계 일치율
5. 유창하지만 부적절한 답변과 짧지만 강한 답변 구분 성능
6. p95 latency
7. case당 추정 비용
8. 코드 복잡도와 운영 설명 가능성

정확도 차이가 작으면 더 단순하고 결정론적이며 저렴한 전략을 우선한다.

## Strategy Write Isolation

| 전략 | 브랜치 | 수정 가능 경로 |
| --- | --- | --- |
| 기존 휴리스틱 기준선 | `experiment/ncs-eval-baseline` | `backend/worker/src/experiments/ncs-evaluation/baseline/` |
| 공통 루브릭 직접 판정 | `experiment/ncs-eval-common-rubric` | `backend/worker/src/experiments/ncs-evaluation/common-rubric/` |
| 근거·상태 판정 | `experiment/ncs-eval-evidence-state` | `backend/worker/src/experiments/ncs-evaluation/evidence-state/` |
| 기준 답변 쌍대 비교 | `experiment/ncs-eval-pairwise` | `backend/worker/src/experiments/ncs-evaluation/pairwise/` |
| 하이브리드 | `experiment/ncs-eval-hybrid` | `backend/worker/src/experiments/ncs-evaluation/hybrid/` |

각 전략은 자신의 디렉터리에 runner, 테스트, `results.json`, 짧은 README만 둔다. 공용 schema와 golden case는 M1 브랜치에서 수정하지 않는다.

공용 자산 변경이 필요하면 각 전략 README에 `CONTRACT_CHANGE_PROPOSAL`로 기록한다. 현재 마일스톤은 단일 구현자가 전체 완성품을 소유하므로 팀 합의와 cross-owner 승인은 M1 완료율이나 후보 채택의 선행 조건으로 사용하지 않는다. 생산 API·DB·런타임 계약으로 옮기는 단계에서는 프로젝트 공통 ownership 규칙에 따라 변경 범위를 다시 검토한다.

## Validation

M0 자산만 검증:

```powershell
node scripts/verify-ncs-evaluation-m0.mjs
```

M1 결과 검증 경로 자체를 결정론적 기대 결과로 점검:

```powershell
node scripts/verify-ncs-evaluation-m0.mjs --self-test
```

M1 결과까지 검증:

```powershell
node scripts/verify-ncs-evaluation-m0.mjs --results <strategy-directory>/results.json
```

## Change Control

`ncs-evaluation-m0.v1`은 M1 실험 동안 동결한다. 의미 변경이 필요하면 기존 파일을 덮어쓰지 않고 `v2` 계약과 migration note를 추가한다. 오탈자나 설명 보강은 계약 의미가 바뀌지 않는 범위에서만 허용한다.
