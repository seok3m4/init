# Error Codes

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

공통 오류 코드와 도메인별 오류 코드를 정의한다.

| Code | HTTP | Meaning | Handling |
| --- |--- |--- |--- |
| COMMON_VALIDATION_FAILED | 400 | 입력값 형식 또는 필수값이 잘못됨 | 필드별 오류를 `details`에 담는다. |
| COMMON_UNAUTHORIZED | 401 | 토큰 없음 또는 만료 | 로그인 화면으로 이동한다. |
| COMMON_FORBIDDEN | 403 | 권한 없음 | 기업/지원자 역할 불일치도 여기에 포함한다. |
| COMMON_NOT_FOUND | 404 | 리소스 없음 | 삭제된 공고, 없는 지원서, 없는 리포트 |
| COMMON_CONFLICT | 409 | 중복 또는 상태 충돌 | 중복 이메일, 이미 지원한 공고, 진행 중 상태 충돌 |
| COMMON_RATE_LIMITED | 429 | 요청 횟수 초과 | 이메일 코드 재발송, AI 재생성 제한 |
| AUTH_INVALID_CREDENTIALS | 401 | 이메일/비밀번호 불일치 | 로그인 화면에 사용자 표시 메시지 노출 |
| AUTH_USER_TYPE_MISMATCH | 403 | 선택한 사용자 유형과 계정 유형 불일치 | 기업/지원자 선택값 확인 |
| AUTH_EMAIL_DUPLICATED | 409 | 이미 가입된 이메일 | 회원가입 이메일 인증 전에 차단 |
| AUTH_EMAIL_CODE_INVALID | 400 | 인증 코드 불일치 또는 만료 | Redis TTL 코드 기준 |
| FILE_INVALID_TYPE | 400 | 허용하지 않는 파일 형식 | PDF/DOCX/JD 이미지 정책에 맞춰 검증 |
| FILE_SIZE_EXCEEDED | 400 | 파일 용량 초과 | 업로드 제한 안내 |
| APPLICATION_ALREADY_SUBMITTED | 409 | 이미 지원한 공고 | 중복 지원 방지 |
| INTERVIEW_SESSION_EXPIRED | 409 | 응시 기간 만료 또는 비활성 세션 | 재초대 또는 고객지원 안내 |
| DEVICE_PERMISSION_DENIED | 400 | 카메라/마이크 권한 거부 | 브라우저 권한 해결 안내 |
| AI_PROCESS_NOT_FOUND | 404 | AI 작업 로그 없음 | 상태 조회 중 삭제되었거나 잘못된 processLogId |
| AI_PROCESS_FAILED | 500 | AI 처리 실패 | `ai_process_logs.status=FAILED`와 재시도 안내 |
| AI_GUARDRAIL_BLOCKED | 422 | AI 출력 정책 위반 | 저장하지 않고 재생성 또는 수동 검토 |
| REPORT_NOT_READY | 409 | 리포트 생성 전 조회 | 생성중 상태와 재조회 안내 |

## Hiring Simulation Configuration Details

API-039C/039D는 공통 오류 코드와 아래 `details[].reason`을 사용한다. 별도 도메인 오류 코드를 추가하지 않는다.

| Error Code | HTTP | Detail Reason | Meaning |
| --- | ---: | --- | --- |
| COMMON_VALIDATION_FAILED | 400 | WEIGHT_SUM_MUST_EQUAL_100 | 직무/인재상 비중 합이 100이 아님 |
| COMMON_VALIDATION_FAILED | 400 | OUT_OF_RANGE | 최소점수, 근거 충족률 또는 정수 입력이 계약 범위를 벗어남 |
| COMMON_VALIDATION_FAILED | 400 | CUSTOM_COUNTS_REQUIRED | CUSTOM 모드의 질문 수 또는 꼬리질문 한도가 누락됨 |
| COMMON_VALIDATION_FAILED | 400 | FIXED_MODE_COUNTS_NOT_ALLOWED | 고정 질문 모드에 CUSTOM 전용 개수 필드가 전달됨 |
| COMMON_VALIDATION_FAILED | 400 | QUESTION_COUNT_MISMATCH | 정렬 질문 ID 수가 모드의 본질문 수와 다름 |
| COMMON_VALIDATION_FAILED | 400 | DUPLICATED | `orderedQuestionIds`에 중복 질문이 있음 |
| COMMON_VALIDATION_FAILED | 400 | QUESTION_NOT_IN_ACTIVE_SET | 질문 ID가 지정된 활성 질문 세트에 포함되지 않음 |
| COMMON_VALIDATION_FAILED | 400 | POSTING_MISMATCH | 질문 세트와 공고 연결이 요청과 다름 |
| COMMON_FORBIDDEN | 403 | COMPANY_OWNERSHIP_MISMATCH | 공고, 질문 세트 또는 코호트가 현재 기업 소유가 아님 |
| COMMON_NOT_FOUND | 404 | RESOURCE_NOT_FOUND | 공고, 질문 세트 또는 코호트가 존재하지 않음 |
| COMMON_CONFLICT | 409 | QUESTION_SET_NOT_ACTIVE | 지정한 질문 세트가 현재 ACTIVE 상태가 아님 |

## Error Shape

```json
{
  "error": {
    "code": "COMMON_VALIDATION_FAILED",
    "message": "입력값을 확인해주세요.",
    "details": [
      { "field": "email", "reason": "INVALID_FORMAT" }
    ]
  }
}
```
