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

### Session Evaluation Snapshot

- 모의면접 시작 요청의 `jobRole`은 trim 후 최대 80자이며, 서버가 평가 가능한 질문별 프로필을 선택하는 입력이다.
- 텍스트 연습 화면이 제공하는 백엔드, 프론트엔드, 풀스택, AI/ML, 데이터, DevOps/SRE, QA, 보안 직무는 각각 다른 합성 직무 프로필을 사용한다.
- 서버는 세션 생성 시 평가 가능한 질문마다 `ncs_evaluation_snapshots` row를 생성하고 `jobRole`, 계약·snapshot 버전과 전체 snapshot JSON을 고정한다.
- 같은 `sessionId + questionId`의 최초 snapshot은 이후 프로필 코드나 질문 뱅크가 변경돼도 덮어쓰지 않는다.
- 마이그레이션 이전 세션처럼 snapshot row가 없는 경우에만 평가 요청 시 현재 서버 프로필을 한 번 생성해 원자적으로 예약한다.
- 현재 내장 프로필은 `SYNTHETIC_NCS_LIKE`이며 공식 NCS 코드·원문·인증으로 표시하지 않는다.

### Text Practice Modes

- `POST /candidate/mock-interviews`의 `ncsPracticeMode`는 `QUICK`, `STANDARD`, `DEEP` 중 하나다.
- 텍스트 연습 화면의 본질문 수와 세션 전체 꼬리질문 한도는 각각 `3/2`, `5/3`, `7/4`다.
- 꼬리질문은 별도 평가 문항이 아니라 같은 본질문의 누락 근거를 보완하며 문항당 최대 한 번만 허용한다.
- 전용 모드 요청은 일반 모의면접의 `questionTypes`와 함께 보낼 수 없다.
- 현재 질문은행과 평가 프로필은 서비스 합성 자료다. 공식 NCS 정보 API의 직무·능력단위·수행준거 KSA·평가지침을 수집한 뒤 면접용 행동지표와 점수 앵커로 변환해 snapshot을 교체한다.
- 공식 API는 평가 원천을 제공하지만 답변 점수, 근거 충족 규칙, 질문 구성은 제공하지 않으므로 이 변환 결과는 원문·코드·기준일과 함께 별도 버전으로 관리한다.
- 현재 세션 전체 꼬리질문 한도는 텍스트 연습 클라이언트가 적용한다. 서버 영구 상태 기반 강제는 practice mode를 세션에 저장하는 후속 계약에서 다룬다.

공식 원천 연동 시 한국산업인력공단 국가직무능력표준 정보 API의 직무(`ncsDutyInfo`), 능력단위(`ncsCompeUnitInfo`), 능력단위요소(`ncsCompeUnitFactrInfo`), 수행준거 KSA(`ncsKsaInfo`), 평가지침(`ncsEvalInfo`)을 함께 snapshot 입력으로 사용한다. 현재 화면의 개발 직무명은 합성 프로필 별칭이며 공식 NCS 세분류가 아니다. 직무 선택지는 공식 직무 수집·버전 고정 이후 NCS 코드와 명칭을 기준으로 교체한다.

### Input Quality Gate

API는 평가 작업을 만들기 전에 canonical transcript가 최소한의 평가 가능 조건을 충족하는지 확인한다.

- `[NO_ANSWER]`로 시작하는 녹화/STT 실패 placeholder는 평가하지 않는다.
- 문자·숫자 없이 문장부호나 공백만 있는 입력은 평가하지 않는다.
- `음`, `어`, `네`, `모르겠습니다` 같은 filler·응답 회피 표현만 있는 입력은 평가하지 않는다.
- 같은 문자 또는 같은 짧은 token을 반복한 입력은 평가하지 않는다.
- 짧다는 이유만으로 차단하지 않는다. 짧지만 구체적인 행동 근거는 worker가 정상 평가한다.
- quality gate가 차단한 요청은 process를 생성하지 않고 `409 COMMON_CONFLICT`를 반환해 재답변을 요구한다.

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

- API dispatcher는 위 값을 hash한 `deduplicationKey`를 `ai_process_logs.deduplication_key`에 저장한다.
- 같은 key의 `PENDING`, `RUNNING`, `COMPLETED` process가 있으면 새 process와 queue message를 만들지 않고 기존 `processLogId`를 반환한다.
- 같은 key의 `FAILED` process는 새 row를 만들지 않고 실패 정보를 초기화한 뒤 같은 `processLogId`를 재큐잉한다.
- DB unique 제약과 repository 예약 연산이 동시 요청에서도 process 한 개만 생성되도록 보장한다.

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

### Immutable Evaluation Revision

가드레일을 통과한 제품 NCS 평가는 `ncs_evaluation_revisions`에 append-only revision으로 저장한다.

- `processLogId`당 revision은 한 개이며 기존 revision을 덮어쓰지 않는다.
- revision은 session, question, 선택적 answer 식별자와 contract/snapshot/strategy version을 보존한다.
- `inputSnapshotJson`에는 worker가 받은 canonical `kind + payload`를, `outputJson`에는 검증된 제품 output을 저장한다.
- 리포트는 같은 process의 mutable `ai_process_logs.output_ref`보다 immutable revision을 우선 사용한다.
- 가드레일 `BLOCKED` 또는 worker 실패 결과는 revision을 만들지 않는다.

## Polling Output

완료 결과는 기존 `GET /api/v1/ai/jobs/{processLogId}/status`를 사용한다.

- 클라이언트는 진행 중 `processLogId`, session/question 식별자와 복구에 필요한 화면 context를 sessionStorage에 보관한다.
- 새로고침 또는 polling timeout 뒤에는 새 평가 요청을 생성하지 않고 같은 `processLogId`를 다시 조회한다.
- polling timeout은 작업 실패가 아니라 `DELAYED` 화면 상태다. 저장된 복구 정보는 `COMPLETED` 또는 명시적 `FAILED`에서만 제거한다.
- 기본 polling은 점진적 backoff를 적용하며 약 2분의 지연을 허용한다.

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
      "evaluationBasis": {
        "sourceKind": "SYNTHETIC_NCS_LIKE",
        "sourceVersion": "service-ncs-starter-v2",
        "categoryType": "JOB_PERFORMANCE",
        "jobRole": "백엔드 개발자",
        "unit": {
          "code": "SERVICE-JOB-BACKEND-TECHNICAL-DECISION",
          "name": "백엔드 개발자 - 기술 의사결정",
          "level": null,
          "definition": "API, 데이터와 서버 운영 제약을 고려해 기술 대안을 선택하고 결과를 검증하는 능력"
        },
        "behaviorPoints": [
          {
            "behaviorPointId": "backend-technical-decision-bp-01",
            "description": "서버 운영 제약과 대안을 구분하고 선택 근거, 실행 행동과 검증 결과를 연결해 설명한다.",
            "sourceElementCodes": ["SERVICE-JOB-BACKEND-TECHNICAL-DECISION-01"],
            "requiredEvidence": ["ACTION", "RATIONALE", "RESULT", "TRADEOFF"]
          }
        ]
      },
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
- 새로 생성한 결과의 `evaluationBasis`는 해당 process 입력의 immutable snapshot에서만 복사하며, source·unit·행동 기준을 새로 추론하지 않는다.
- 기존 `ncs-evaluation-product.v1` revision과의 호환을 위해 `evaluationBasis`가 없는 과거 결과도 읽을 수 있지만 새 worker 결과에는 항상 포함한다.

## Error Mapping

| HTTP | Error code | Condition |
| ---: | --- | --- |
| 400 | `COMMON_VALIDATION_FAILED` | source 조합 위반, 잘못된 ID, 빈 transcript, 길이 초과 |
| 403 | `COMMON_FORBIDDEN` | 다른 지원자의 세션 접근 |
| 404 | `COMMON_NOT_FOUND` | 세션, 질문 또는 answer 없음 |
| 409 | `COMMON_CONFLICT` | 세션 상태 불일치, 평가 스냅샷 없음, 저장 transcript 미완료, 평가 불가 transcript |

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
        "contractVersion": "ncs-evaluation-product.v1",
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
        },
        "guardrail": {
          "unsupportedFactDetected": false,
          "sensitiveAttributeUsed": false,
          "nonverbalSignalUsed": false,
          "hiringDecisionLanguageDetected": false
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
