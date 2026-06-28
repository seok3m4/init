# AI Job Contracts

E 파트 AI 작업을 로컬 개발과 팀 연동에서 호출할 때 필요한 최소 입력, 상태 조회, 출력 형태를 정리한다.

상세 필드의 최종 기준은 `docs/03_contracts/api-spec.md`이고, 이 문서는 구현자용 빠른 확인 자료다.

## Dev Auth Headers

| Caller | Headers |
| --- | --- |
| Company | `X-Dev-User-Id: 1`, `X-Dev-User-Type: COMPANY`, `X-Dev-Company-Id: 1` |
| Candidate | `X-Dev-User-Id: 2`, `X-Dev-User-Type: CANDIDATE`, `X-Dev-Candidate-Id: 1` |
| Admin/System | `X-Dev-User-Id: 9`, `X-Dev-User-Type: ADMIN` |

각 담당자는 임시 인증 값을 하드코딩해서 직접 쓰지 말고, API 서버의 공통 CurrentUser 계약을 통해 userId, userType, companyId, candidateId를 전달받는 구조를 유지한다.

## Async Response

장기 AI 작업 생성 API는 즉시 결과 본문을 만들지 않고 `202 Accepted`와 `processLogId`를 반환한다.

```json
{
  "data": {
    "processLogId": 101,
    "processType": "REPORT_GENERATE",
    "status": "PENDING",
    "queued": true,
    "inputRef": "{\"kind\":\"REPORT_PIPELINE_STEP\"}"
  }
}
```

화면은 아래 상태 조회 API를 polling한다.

```http
GET /api/v1/ai/jobs/101/status
```

완료 응답 예시는 다음과 같다.

```json
{
  "data": {
    "processLogId": 101,
    "processType": "QUESTION_GENERATE",
    "status": "COMPLETED",
    "output": {
      "sourceProcessLogId": 101,
      "items": ["Question 1", "Question 2"],
      "reviewRequired": true,
      "reviewStatus": "PENDING_REVIEW",
      "targetTables": ["question_bank"],
      "postingId": 2
    }
  }
}
```

실패 응답은 재시도 가능 여부를 포함한다.

```json
{
  "data": {
    "processLogId": 101,
    "processType": "REPORT_GENERATE",
    "status": "FAILED",
    "failure": {
      "category": "RETRYABLE",
      "reason": "SQS publish failed: timeout",
      "retryable": true
    }
  }
}
```

## Minimum Request Matrix

| API | Caller | Required Input | Final Save Policy |
| --- | --- | --- | --- |
| `POST /reports/{reportId}/evaluation-context` | Company | company, posting, criteria, application, answers, manualEvaluations? | status output에 context 반환 |
| `POST /reports/{reportId}/answer-evaluation` | Company | reportType, criteria, answers, documentText? | guardrail 통과 후 `report_scores`, `report_evidences` 저장 |
| `POST /reports/{reportId}/communication-analysis` | Company | reportType, consentConfirmed, mediaQuality, metrics? | 보조 지표로만 저장, decisionWeight는 0 |
| `POST /reports/{reportId}/generate` | Company | reportType=`RECRUITING_REPORT`, jobDescription, criteria, answers | guardrail 통과 후 리포트/점수/근거 최종 저장 |
| `POST /candidate/mock-interview/reports/{reportId}/generate` | Candidate | reportType=`MOCK_INTERVIEW_REPORT`, jobDescription, criteria, answers | 합격/탈락 판단 표현 금지 |
| `POST /candidate/documents/extract` | Candidate | applicationId, documentId, fileId, s3Key | 원본 파일은 DB 저장 금지, S3 key 참조 |
| `POST /candidate/mock-interviews/{sessionId}/stt` | Candidate | answerId, audioFileId, audioS3Key | transcript 없을 때만 저장 |
| `POST /candidate/interviews/{sessionId}/stt` | Candidate | answerId, audioFileId, audioS3Key | transcript 없을 때만 저장 |
| `POST /candidate/mock-interviews/{sessionId}/follow-up-question` | Candidate | answerId, previousQuestion, transcript | 모의면접 표현 정책 적용 |
| `POST /candidate/interviews/{sessionId}/follow-up-question` | Candidate | answerId, previousQuestion, transcript, jobDescription 또는 documentSummary | 채용면접 표현 정책 적용 |
| `POST /company/interviews/evaluation-criteria/suggest` | Company | postingId, jobDescription, talentProfile, evaluationPolicy | reviewRequired draft 반환, 확정 전 최종 저장 금지 |
| `POST /company/interviews/questions/generate` | Company | postingId, jobDescription, questionCount | reviewRequired draft 반환 |
| `POST /company/interviews/question-sets` | Company | postingId, questionCount, criteria, questionTypes | reviewRequired draft 반환 |
| `POST /candidate/mock-interviews/questions/generate` | Candidate | questionCount | JD/posting/기업 기준 없이 동작 |
| `POST /ai/guardrails/validate` | Admin/System | reportType, target, scores, summary? | PASS/BLOCKED/REGENERATED 기록 |

## Payload Examples

평가 컨텍스트 입력:

```json
{
  "reportType": "RECRUITING_REPORT",
  "company": {
    "companyId": 1,
    "name": "Init Corp",
    "talentProfile": "Pragmatic problem solver"
  },
  "posting": {
    "postingId": 2,
    "title": "Backend Engineer",
    "jobDescription": "NestJS and PostgreSQL backend engineer"
  },
  "application": {
    "applicationId": 3,
    "candidateId": 4,
    "documentText": "Built Redis cache and improved API latency."
  },
  "criteria": [
    {
      "criterionId": 1,
      "name": "Backend ownership",
      "description": "Owns server-side design and operations",
      "weight": 50
    }
  ],
  "answers": [
    {
      "answerId": 10,
      "question": "How did you use Redis?",
      "transcript": "I used Redis cache to reduce repeated database reads."
    }
  ],
  "manualEvaluations": [
    {
      "reviewerUserId": 7,
      "decision": "HOLD",
      "memo": "Needs additional system design discussion."
    }
  ]
}
```

서류 추출 입력:

```json
{
  "applicationId": 3,
  "documentId": 8,
  "fileId": 9,
  "s3Key": "candidate/4/resume.pdf"
}
```

STT 입력:

```json
{
  "answerId": 10,
  "audioFileId": 11,
  "audioS3Key": "candidate/4/answer-10.wav"
}
```

채용 꼬리질문 입력:

```json
{
  "answerId": 10,
  "previousQuestion": "How did you use Redis?",
  "transcript": "I improved read performance with Redis cache.",
  "jobDescription": "Backend engineer with Redis operations."
}
```

질문 생성 draft 출력:

```json
{
  "sourceProcessLogId": 101,
  "items": ["Question 1", "Question 2"],
  "reviewRequired": true,
  "reviewStatus": "PENDING_REVIEW",
  "targetTables": ["question_bank"],
  "postingId": 2
}
```

리포트 생성 완료 출력:

```json
{
  "report": {
    "reportId": 1,
    "reportType": "RECRUITING_REPORT",
    "status": "COMPLETED",
    "summary": "Evidence-backed backend ownership is strong.",
    "totalScore": 84
  },
  "scores": [
    {
      "criterionId": 1,
      "criterionName": "Backend ownership",
      "score": 84,
      "rationale": "The answer included concrete Redis cache evidence.",
      "evidences": [
        {
          "sourceType": "INTERVIEW_ANSWER",
          "answerId": 10,
          "text": "I used Redis cache to reduce repeated database reads."
        }
      ]
    }
  ],
  "guardrail": {
    "result": "PASS",
    "reason": null
  }
}
```

## Coordination Notes

- A는 SQS queue URL, S3 bucket, AI provider secret, worker 배포/재시작을 제공한다.
- C는 평가 기준/질문 생성 화면에서 `reviewRequired=true` 결과를 사용자 확정 전 draft로 취급한다.
- D는 STT와 꼬리질문 입력으로 `answerId`, `audioFileId`, `audioS3Key`, transcript를 넘긴다.
- B는 리포트 화면에서 `evaluation_reports.status`와 `GET /ai/jobs/{processLogId}/status` 결과를 함께 표시한다.
- E는 guardrail PASS/REGENERATED 전에는 `evaluation_reports`, `report_scores`, `report_evidences`, `question_bank`, `evaluation_criteria`에 최종 저장하지 않는다.
