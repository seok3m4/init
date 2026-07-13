# Hiring Evaluation Contract

## Scope

이 계약은 채용 판정 시뮬레이션의 M2 설정 snapshot, M3 인재상 루브릭, M4 답변 평가, M5 집계와 M6 순위 계산이 공유하는 계산 의미를 고정한다. 실제 전형의 `applications.screening_decision`은 변경하지 않는다.

## Versions

| Contract | Purpose |
| --- | --- |
| `hiring-question-set-configuration.v1` | M2 관리자 입력과 선택 질문 불변 복사본 |
| `hiring-evaluation-context.v1` | M4에서 NCS snapshot과 인재상 루브릭까지 포함해 잠근 최종 평가 컨텍스트 |
| `hiring-answer-evaluation.v1` | 질문 하나의 NCS·인재상 독립 평가 결과 |
| `hiring-candidate-summary.v1` | M5 지원자 단위 점수와 근거 충족률 |
| `hiring-ranking.v1` | M6 코호트 순위와 판정 snapshot |

## Score Rules

- 점수 범위는 `0~100`이고 `INSUFFICIENT_EVIDENCE`의 점수는 `null`이다.
- 직무 점수는 NCS 행동 포인트 유효 점수의 세부 가중 평균이다. 명시적 가중치가 없으면 동일 가중치다.
- 인재상 점수는 유효 criterion 점수를 `talent-rubric-snapshot.v1` weight로 가중 평균한다.
- `null` 항목은 점수 평균에서 제외하지만 근거 충족률에서는 미충족으로 남긴다.
- 종합 근거 충족률은 `(jobCoverage * jobWeight + talentCoverage * talentWeight) / 100`이다.
- 종합점수는 `(jobScore * jobWeight + talentScore * talentWeight) / 100`이다.
- 비중이 양수인 트랙 점수가 `null`이거나 종합 근거 충족률이 최소 기준 미만이면 최종 점수와 순위를 만들지 않는다.
- 중간값은 반올림하지 않고 저장·비교 값만 decimal half-up 소수 둘째 자리로 반올림한다.

## Mode Rules

| Mode | Rule |
| --- | --- |
| `ABSOLUTE` | 근거 gate와 양수 비중 트랙 최소점수를 통과하면 `PASS`, 아니면 `FAIL`; capacity 미사용 |
| `RELATIVE` | 근거 gate 통과자를 순위화하고 capacity를 적용; 트랙 최소점수 미사용 |
| `HYBRID` | 근거 gate와 양수 비중 트랙 최소점수를 통과한 지원자만 순위화하고 capacity 적용 |

## Tie Rules

1. 종합점수 내림차순
2. 관리자 비중이 더 높은 트랙 점수 내림차순
3. 해당 트랙 세부 점수 vector 사전식 내림차순
4. 종합 근거 충족률 내림차순
5. 전부 같으면 동일 competition rank

두 트랙 비중이 같으면 2~3단계를 생략한다. 세부 vector의 차원 순서는 세부 가중치 내림차순, 동일 가중치이면 snapshot 순서다. ID와 응시 시각은 점수 비교 값이 아니다.

동점 그룹이 capacity 경계를 가로지르면 전원 `WAITLIST`다. 경계 안에 완전히 포함된 그룹은 `PASS`, 경계 아래는 `FAIL`이다. 백분위는 rank가 있는 지원자만 `(eligibleCount - rank) / (eligibleCount - 1) * 100`으로 계산하며, eligibleCount가 1이면 `100`이다.

## Snapshot Lifecycle

- 모든 snapshot row는 append-only다.
- M2 snapshot에 M3/M4 필드를 update하지 않는다.
- M4 lock은 완성된 `hiring-evaluation-context.v1` row를 새로 만들고 같은 transaction에서 `OPEN -> LOCKED`와 코호트 참조 교체를 수행한다.
- M4 context는 정책 version, 질문 ID·순서·본문, NCS snapshot, 인재상 rubric, 꼬리질문 한도와 계산 계약 version을 포함한다.
- `LOCKED` 이후 context를 재생성하거나 현재 공고·질문·인재상 값으로 덮어쓰지 않는다.
- 동일 context와 동일 answer revision 재전달은 기존 결과를 재사용한다.

## Evidence Rules

- NCS와 인재상 결과는 별도 배열과 점수 공간으로 유지한다.
- 모든 evidence는 실제 transcript의 `quote`, `startChar`, `endChar`를 가진다.
- 민감 속성과 비언어 신호는 두 트랙의 점수와 tie-break에 사용하지 않는다.
- 꼬리질문 답변은 누락 evidence를 보완하지만 새 본질문이나 가산점으로 계산하지 않는다.
- M4는 질문별 evidence와 판정을 만들고, M5만 여러 질문 결과를 지원자 점수로 집계한다.

## M4 Context Contract

`hiring-evaluation-context.v1`은 다음 값을 한 번에 고정한다.

- 코호트, 기업, 공고와 M2 `configurationHash`
- 정책 ID·version과 `hiring-evaluation.v1` 계산 계약
- 원본 M2 질문 snapshot ID·version
- 질문 ID·순서·유형·본문·criterion 연결과 질문별 NCS snapshot
- 직무, 질문 모드, 본질문 수와 지원자별 최대 꼬리질문 수
- 검증된 `talent-rubric-snapshot.v1` 전체

`contextHash`는 `contextVersion`, `contextHash`를 제외한 위 객체를 key-sorted canonical JSON으로 직렬화한 SHA-256이다. API와 worker는 같은 ASCII key 정렬을 사용하고 worker는 평가 전 hash를 다시 계산한다.

## M4 Answer Input

`hiring-answer-evaluation.v1` 입력은 `context`, `candidateId`, `sessionId`, `questionId`, `followUpsUsed`, `turns[]`로 구성한다.

- 첫 turn은 반드시 저장된 본질문 답변인 `PRIMARY`다.
- 이후 turn은 해당 본질문 직후의 저장된 꼬리질문 답변인 `FOLLOW_UP`만 허용한다.
- `followUpsUsed`는 현재 질문 turn 수가 아니라 세션 전체에서 이미 생성된 꼬리질문 수다.
- API는 transcript를 요청에서 받지 않고 DB의 `interview_answers.transcript`만 사용한다.
- 실제 답변 평가 실행은 `IN_PROGRESS` 또는 `COMPLETED` 상태의 `RECRUITING` 세션만 허용한다.
- 세션의 본질문 ID·유형·본문·순서가 context와 하나라도 다르면 실행하지 않는다.
- API는 `interview_session_questions.question_type/content`에 처음 저장된 질문 표현을 보존해 이후 질문 뱅크 수정과 구분한다.

## M4 Answer Output And Revision

`hiring-answer-evaluation.v1` 출력은 context·answer revision identity, transcript turn 범위, `jobEvaluation`, `talentEvaluation`, guardrail과 evaluator version을 포함한다.

- NCS와 인재상 criterion은 서로 독립 평가하며 한 트랙의 근거를 다른 트랙 점수로 변환하지 않는다.
- 인재상 criterion은 ACTION/RATIONALE/RESULT/REFLECTION 필수 근거가 모두 있을 때만 1~5 anchor와 25/50/70/85/100 점수를 가진다.
- 질문·직무 관련성이 없거나 필수 근거가 부족하면 점수는 `null`이다.
- evidence quote는 PRIMARY/FOLLOW_UP을 줄바꿈 하나로 결합한 canonical transcript의 정확한 `startChar/endChar`를 가진다.
- 세션 전체 꼬리질문 한도를 소진하면 근거가 부족해도 추가 질문을 제안하지 않는다.
- `answerRevisionHash`는 context version, 지원자, 세션, 질문, 세션 전체 꼬리질문 사용 수와 모든 turn을 포함한다.
- 가드레일 통과 결과만 `hiring_answer_evaluation_revisions`에 저장한다. 같은 process와 같은 answer revision은 unique 제약으로 중복 저장하지 않는다.
- M4는 같은 공고와 잠긴 질문 context에 일치하는 개별 답변 revision을 만든다. 상대평가 대상 지원자·세션 집합은 M5 집계 시작 transaction에서 별도로 고정한다.
- M4 결과는 합격/불합격을 만들지 않는다. M5가 질문별 revision을 집계하고 M6가 정책과 코호트 순위를 적용한다.
