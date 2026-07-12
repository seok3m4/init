# NCS Answer Evaluation API Contract

## Scope

M3에서 채택한 `evidence-state` 평가기를 기존 모의면접 세션과 AI worker 경계에 연결하기 위한 제품 계약이다. API는 텍스트 입력 화면과 기존 화상면접 STT 결과를 같은 평가 작업으로 수렴시킨다.

```text
직접 입력 transcript ─┐
                      ├─ API-097 → ai_process_logs → SQS → worker → polling output
저장 answer의 STT ────┘
```

클라이언트는 transcript 원천만 선택한다. NCS 원천, 행동 포인트, score map, 평가 전략과 평가 스냅샷은 서버 소유 데이터다.

## Endpoint

```text
POST /api/v1/candidate/mock-interviews/{sessionId}/ncs-evaluations
Authorization: candidate bearer token
```

### Stored Answer Request

```json
{
  "questionId": 501,
  "answerSource": "STORED_ANSWER",
  "answerId": 701
}
```

### Text Input Request

```json
{
  "questionId": 501,
  "answerSource": "TEXT_INPUT",
  "transcript": "실행 계획에서 풀스캔을 확인하고 복합 인덱스를 적용했습니다. 같은 부하에서 p95가 줄었는지 다시 측정했습니다."
}
```

### Source Invariants

| answerSource | answerId | transcript |
| --- | --- | --- |
| `STORED_ANSWER` | required | forbidden |
| `TEXT_INPUT` | forbidden | required |

- `questionId`, `answerId`, `sessionId`는 양의 정수다.
- 직접 입력 transcript는 trim 후 1~20,000자다.
- 저장 answer의 transcript는 API가 DB에서 읽으며 요청 body로 덮어쓸 수 없다.
- 질문은 해당 세션의 질문 목록에 있어야 한다.
- 저장 answer는 해당 세션과 questionId에 동시에 속해야 한다.

## Accepted Response

```json
{
  "data": {
    "accepted": true,
    "processType": "REPORT_GENERATE",
    "step": "NCS_ANSWER_EVALUATION",
    "status": "PENDING",
    "queued": true,
    "processLogId": 9001,
    "sessionId": 101,
    "questionId": 501,
    "answerId": 701,
    "callbackTopic": "ai.interview.ncs-answer-evaluation.requested"
  },
  "meta": {
    "traceId": "trace-id",
    "timestamp": "2026-07-12T06:00:00.000Z"
  }
}
```

`TEXT_INPUT` 요청은 `answerId`를 반환하지 않는다. 동일 요청의 중복 방지는 다음 키를 사용한다.

```text
STORED_ANSWER: sessionId + questionId + answerId + evaluationSnapshotVersion
TEXT_INPUT: sessionId + questionId + transcriptHash + evaluationSnapshotVersion
```

## Queue Contract

Prisma `AiProcessType`은 M3에서 추가하지 않는다. 기존 `REPORT_GENERATE` process type 아래 step과 kind로 분기한다.

```json
{
  "kind": "MOCK_NCS_ANSWER_EVALUATION",
  "payload": {
    "step": "NCS_ANSWER_EVALUATION",
    "sessionId": 101,
    "questionId": 501,
    "answerId": 701,
    "transcript": "서버가 확정한 transcript",
    "evaluationSnapshot": {
      "contractVersion": "ncs-evaluation-product.v1",
      "snapshotVersion": "snapshot-hash-or-version",
      "locale": "ko-KR",
      "question": {},
      "ncsContext": {},
      "behaviorPoints": [],
      "evaluationPolicy": {}
    }
  }
}
```

- API가 세션·질문·answer 소유권을 확인한 뒤 canonical payload를 만든다.
- worker는 client body를 다시 해석하지 않고 canonical snapshot과 transcript만 사용한다.
- `evaluationSnapshot`은 API가 저장 데이터로 구성하며 요청 body에서 복사하지 않는다.
- 가드레일 `PASS` 또는 `REGENERATED` 전에는 최종 결과를 저장하지 않는다.

## Polling Output

완료 결과는 기존 `GET /api/v1/ai/jobs/{processLogId}/status`를 사용한다.

```json
{
  "data": {
    "processLogId": 9001,
    "processType": "REPORT_GENERATE",
    "status": "COMPLETED",
    "output": {
      "contractVersion": "ncs-evaluation-product.v1",
      "evaluationSnapshotVersion": "snapshot-hash-or-version",
      "sessionId": 101,
      "questionId": 501,
      "answerId": 701,
      "evidences": [
        {
          "evidenceId": "evidence-1",
          "quote": "풀스캔을 확인하고 복합 인덱스를 적용했습니다.",
          "startChar": 7,
          "endChar": 34,
          "claimType": "ACTION",
          "behaviorPointIds": ["behavior-point-id"]
        }
      ],
      "behaviorEvaluations": [
        {
          "behaviorPointId": "behavior-point-id",
          "status": "DEMONSTRATED",
          "level": 4,
          "score": 85,
          "rationale": "행동, 선택 근거와 확인 결과가 연결됩니다.",
          "supportingEvidenceIds": ["evidence-1"],
          "contradictingEvidenceIds": [],
          "missingEvidence": [],
          "confidence": "HIGH"
        }
      ],
      "coverage": {
        "assessableBehaviorPointCount": 1,
        "evaluatedBehaviorPointCount": 1,
        "ratio": 1,
        "status": "SUFFICIENT"
      },
      "followUp": {
        "required": false,
        "reason": null,
        "missingEvidence": [],
        "suggestedQuestion": null
      },
      "guardrail": {
        "unsupportedFactDetected": false,
        "sensitiveAttributeUsed": false,
        "nonverbalSignalUsed": false,
        "hiringDecisionLanguageDetected": false
      },
      "metadata": {
        "strategyId": "evidence-state",
        "strategyVersion": "evidence-state-rules-v1"
      }
    }
  }
}
```

### Result Invariants

- `quote === transcript.slice(startChar, endChar)`가 모든 evidence에서 성립한다.
- `INSUFFICIENT_EVIDENCE`의 level과 score는 `null`이다.
- 1~5단계 score는 각각 25, 50, 70, 85, 100으로 서버가 환산한다.
- confidence는 점수 가중치로 사용하지 않는다.
- 민감 속성·비언어 신호·합격 가능성은 점수 입력이나 출력 판단에 사용하지 않는다.
- 질문과 답변에 없는 사실은 rationale이나 evidence로 반환하지 않는다.

## Error Mapping

| HTTP | Error code | Condition |
| ---: | --- | --- |
| 400 | `COMMON_VALIDATION_FAILED` | source 조합 위반, 잘못된 ID, 빈 transcript, 길이 초과 |
| 403 | `COMMON_FORBIDDEN` | 다른 지원자의 세션 접근 |
| 404 | `COMMON_NOT_FOUND` | 세션, 질문 또는 answer 없음 |
| 409 | `COMMON_CONFLICT` | 세션 상태 불일치, 평가 스냅샷 없음, 저장 transcript 미완료 |

## M3 Implementation Order

1. 세션 질문에서 immutable NCS evaluation snapshot을 조회하는 resolver를 정의한다.
2. API-097 DTO, route, 소유권 검증과 canonical queue payload를 구현한다.
3. worker의 `NCS_ANSWER_EVALUATION` step을 제품용 evidence-state adapter에 연결한다.
4. polling output parser와 guardrail을 추가한다.
5. `STORED_ANSWER`와 `TEXT_INPUT` 계약 테스트를 같은 fixture로 실행한다.

M4 route는 `TEXT_INPUT`, M5 화상면접은 `STORED_ANSWER`를 사용하되 결과 DTO는 동일하게 유지한다.

## M6 Mock Report Projection

`GET /api/v1/candidate/mock-interview/reports/{reportId}/feedback` 응답은 검증을 통과한 화상면접 NCS 결과를 `ncsEvaluations` 배열로 투영한다.

```json
{
  "data": {
    "reportId": 101,
    "totalScore": 78,
    "ncsEvaluations": [
      {
        "processLogId": 9001,
        "sessionId": 101,
        "questionId": 501,
        "answerId": 701,
        "questionType": "EXPERIENCE",
        "questionContent": "새로운 기술을 배워 적용한 경험을 설명해 주세요.",
        "evaluationSnapshotVersion": "snapshot-hash-or-version",
        "behaviorEvaluations": [
          {
            "behaviorPointId": "behavior-point-id",
            "behaviorPointDescription": "학습한 내용을 실제 문제에 적용하고 결과를 확인한다.",
            "status": "DEMONSTRATED",
            "level": 4,
            "score": 85,
            "rationale": "행동과 결과가 발화에서 연결됩니다.",
            "supportingEvidenceIds": ["evidence-1"],
            "contradictingEvidenceIds": [],
            "missingEvidence": [],
            "confidence": "HIGH"
          }
        ],
        "evidences": [],
        "coverage": {
          "assessableBehaviorPointCount": 1,
          "evaluatedBehaviorPointCount": 1,
          "ratio": 1,
          "status": "SUFFICIENT"
        },
        "followUp": {
          "required": false,
          "reason": null,
          "missingEvidence": [],
          "suggestedQuestion": null
        }
      }
    ],
    "visibilityPolicy": {
      "candidateFacingOnly": true,
      "excludesHiringDecision": true,
      "excludesInternalScores": true,
      "excludesCompanyMemo": true,
      "ncsPracticeScoreExcludedFromTotal": true
    }
  }
}
```

- `ncsEvaluations` 항목은 `COMPLETED` 상태이고 strict output 검증을 통과한 `STORED_ANSWER` 작업만 포함한다.
- 같은 `answerId`를 재평가한 경우 가장 최근 유효 결과 하나만 노출한다.
- `behaviorPointDescription`은 클라이언트 입력이 아닌 해당 process의 immutable evaluation snapshot에서 읽는다.
- NCS 점수는 연습용 행동 근거 지표이며 기존 리포트 `totalScore`나 합격 판단에 가중하지 않는다.
- NCS process는 `REPORT_GENERATE` type을 공유하지만 `kind=MOCK_NCS_ANSWER_EVALUATION`이므로 `MOCK_REPORT_GENERATE`의 상태 판정에서 제외한다.
- 유효한 결과가 없으면 `ncsEvaluations` 배열은 빈 배열이며 기존 리포트는 그대로 노출한다.
