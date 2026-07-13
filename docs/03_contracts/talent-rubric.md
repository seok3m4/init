# Talent Rubric Snapshot Contract

## Scope

M3는 기업이 입력한 인재상 1~6개를 채용 면접 발화에서 확인 가능한 행동 루브릭 snapshot으로 변환한다. 이 단계는 provider/network 호출, 실제 답변 채점, 지원자 종합점수 계산, 채용 판정을 수행하지 않는다.

결정론적 baseline 진입점은 `backend/worker/src/talent-rubric/generator.ts`의 `generateTalentRubricSnapshot`이다. 추후 AI provider를 사용하더라도 이 문서의 `talent-rubric-snapshot.v1` 출력 계약과 불변식을 동일하게 만족해야 하며, provider별 알고리즘 버전은 별도 `rubricVersion`으로 식별한다.

## Input

```json
[
  {
    "name": "협업",
    "description": "서로 다른 의견을 조율해 공동 결과를 만든다.",
    "weight": 2
  }
]
```

| Field | Rule |
| --- | --- |
| items | 배열, 1~6개 |
| `name` | NFKC/공백 정규화와 trim 후 1~80자 |
| `description` | NFKC/공백 정규화와 trim 후 1~1,000자 |
| `weight` | 선택값, 유한한 양수. 생략 시 1 |
| name uniqueness | 정규화 후 대소문자를 무시해 중복 불가 |

민감 속성이나 비언어 신호를 제거한 뒤 발화로 평가할 의미가 전혀 남지 않는 항목은 `NO_ASSESSABLE_CONTENT`로 거부한다. 이 거부는 금지된 기준을 임의의 행동 역량으로 바꾸지 않기 위한 경계다.

## Output

아래 `sourceHash`와 ID는 형식을 보여 주는 예시다.

```json
{
  "contractVersion": "talent-rubric-snapshot.v1",
  "rubricVersion": "talent-rubric-deterministic.v1",
  "sourceHash": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "criteria": [
    {
      "id": "talent-criterion-stable-hash",
      "name": "협업",
      "definition": "서로 다른 의견을 조율해 공동 결과를 만든다.",
      "weight": 100,
      "behaviorIndicators": [
        {
          "id": "talent-criterion-...-action",
          "evidenceType": "ACTION",
          "observability": "ANSWER_TRANSCRIPT",
          "description": "\"협업\"의 정의인 \"서로 다른 의견을 조율해 공동 결과를 만든다.\"와 직접 연결되는 본인의 구체적 행동을 발화로 설명한다."
        },
        {
          "id": "talent-criterion-...-rationale",
          "evidenceType": "RATIONALE",
          "observability": "ANSWER_TRANSCRIPT",
          "description": "\"협업\"의 정의인 \"서로 다른 의견을 조율해 공동 결과를 만든다.\"에 따라 행동을 선택한 이유나 판단 근거를 발화로 설명한다."
        },
        {
          "id": "talent-criterion-...-result",
          "evidenceType": "RESULT",
          "observability": "ANSWER_TRANSCRIPT",
          "description": "\"협업\"의 정의인 \"서로 다른 의견을 조율해 공동 결과를 만든다.\"와 관련한 행동 뒤에 확인한 결과나 변화를 발화로 설명한다."
        },
        {
          "id": "talent-criterion-...-reflection",
          "evidenceType": "REFLECTION",
          "observability": "ANSWER_TRANSCRIPT",
          "description": "\"협업\"의 정의인 \"서로 다른 의견을 조율해 공동 결과를 만든다.\"와 관련한 경험에서 배운 점이나 이후 조정한 행동을 발화로 설명한다."
        }
      ],
      "requiredEvidence": ["ACTION", "RATIONALE", "RESULT", "REFLECTION"],
      "scoringAnchors": [
        { "level": 1, "evidenceStrength": 1, "label": "제한적", "description": "필수 발화 근거는 모두 있으나 내용이 추상적이고 기준 정의와의 연결이 약하다." },
        { "level": 2, "evidenceStrength": 2, "label": "부분적", "description": "필수 발화 근거가 일부 구체적이지만 근거 사이의 연결과 기준 정의의 입증이 제한적이다." },
        { "level": 3, "evidenceStrength": 3, "label": "충분", "description": "행동, 이유, 결과와 성찰이 구체적으로 연결되고 기준 정의를 일관되게 뒷받침한다." },
        { "level": 4, "evidenceStrength": 4, "label": "강함", "description": "근거 간 인과관계와 결과 확인, 성찰에 따른 조정이 명확해 기준 정의를 강하게 뒷받침한다." },
        { "level": 5, "evidenceStrength": 5, "label": "매우 강함", "description": "제시된 경험 전반의 근거가 매우 구체적이고 상호 일관되며 기준 정의를 지속적으로 입증한다." }
      ]
    }
  ],
  "evidencePolicy": {
    "source": "ANSWER_TRANSCRIPT",
    "requiredEvidenceRule": "ALL_REQUIRED",
    "missingRequiredEvidenceStatus": "INSUFFICIENT_EVIDENCE",
    "insufficientEvidenceScore": null
  },
  "prohibitedSignals": [
    {
      "category": "SENSITIVE_ATTRIBUTE",
      "signals": ["성별/성 정체성", "나이/연령", "출신 학교/학벌", "외모/용모", "장애 여부", "인종/민족/국적", "종교", "혼인/임신/가족 관계"],
      "detectedInSource": [],
      "disposition": "EXCLUDE_FROM_SCORING"
    },
    {
      "category": "NONVERBAL_SIGNAL",
      "signals": ["시선/눈맞춤", "표정", "목소리 톤/음색/억양", "자세/몸짓/제스처", "말하기 속도"],
      "detectedInSource": [],
      "disposition": "EXCLUDE_FROM_SCORING"
    }
  ]
}
```

## Invariants

1. 같은 입력 순서와 정규화된 값은 항상 동일한 전체 결과와 `sourceHash`를 만든다.
2. `sourceHash`는 정규화한 `name`, `description`, 유효 weight(생략 시 1)를 입력 순서대로 JSON 직렬화한 값의 SHA-256이다. 원문은 snapshot에 별도로 복제하지 않는다.
3. criterion ID는 정규화한 해당 항목의 이름과 설명으로 만든 안정적인 SHA-256 기반 ID다.
4. weight는 exact decimal largest-remainder 방식으로 정수화하고, 나머지가 같으면 입력 순서를 우선한다. 모든 criterion weight 합계는 정확히 100이다.
5. criterion마다 4개의 indicator가 있으며 허용 evidence type은 `ACTION`, `RATIONALE`, `RESULT`, `REFLECTION`뿐이다. 모든 indicator의 관찰 원천은 `ANSWER_TRANSCRIPT`다.
6. 원문의 안전한 의미는 criterion `name`과 `definition`에 유지한다. baseline은 직무, 성과 수치, 상황 또는 경험을 새 사실로 보충하지 않는다.
7. 성별, 나이, 출신 학교, 외모, 장애 등 민감 속성과 시선, 표정, 목소리 톤 등 비언어 신호는 criterion, indicator, anchor에 남기지 않는다. 탐지한 범주는 `prohibitedSignals.detectedInSource`에만 기록한다.
8. scoring anchor는 `level`과 `evidenceStrength`가 1부터 5까지 함께 단조 증가한다. 필수 근거 충족 전에는 anchor를 적용하지 않는다.
9. snapshot 생성은 점수, 합격 가능성, 채용 결정을 반환하지 않는다.

## M4 Consumption

1. M4는 코호트 질문 세트를 고정할 때 이 전체 결과를 `hiring_question_set_snapshots.snapshot_json` 내부의 `talentRubric`에 복사하고 `sourceHash`와 `rubricVersion`을 보존한다.
2. 공통 질문과 인재상 평가기는 criterion `id`를 참조한다. 코호트가 `LOCKED`된 뒤에는 rubric을 재생성하거나 최신 기업 인재상으로 덮어쓰지 않는다.
3. 평가기는 transcript의 실제 span만 evidence로 연결하고 criterion별 `requiredEvidence`를 모두 확인한다.
4. required evidence 중 하나라도 없으면 해당 criterion은 `INSUFFICIENT_EVIDENCE`, level/score는 `null`이다. 누락을 level 1이나 0점으로 환산하지 않는다.
5. 필수 근거를 모두 충족한 criterion만 1~5 anchor 평가 대상으로 삼는다. NCS 직무 평가와 인재상 평가는 독립 결과로 유지한다.
6. 꼬리질문은 누락 근거를 보완할 수 있지만 별도 가산점이나 새로운 점수 분모가 아니다.

## Limitations

- 이 baseline은 사전 기반 금지 신호 제거와 공통 행동 프레임을 사용한다. 자유 문장의 복합 의미, 부정 표현, 은유를 완전하게 해석하지 않는다.
- 금지 신호 사전은 명시한 한국어/영어 표현의 결정론적 집합이며 모든 우회 표현을 탐지하는 안전 분류기가 아니다. provider를 추가해도 출력 후 별도 guardrail 검증이 필요하다.
- 원문이 추상적이면 생성된 criterion도 추상적이다. baseline은 이를 임의의 구체적 사실로 확장하지 않는다.
- M3는 답변 evidence 추출, anchor 선택, 점수 환산, 코호트 집계와 채용 판정을 구현하지 않는다.
