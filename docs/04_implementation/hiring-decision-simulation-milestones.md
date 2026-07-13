# Hiring Decision Simulation Milestones

## Scope

공식 NCS 기반 답변 평가를 직무 적합도, 인재상 적합도, 코호트 상대평가와 최종 채용 판정 시뮬레이션으로 확장한다. 실제 채용 전형의 `applications.screening_decision`과 분리하고, 시뮬레이션 결과는 별도 snapshot으로 저장한다.

## M0 Decisions

- 기본 판정 방식은 `HYBRID`다. 절대 최소 기준을 통과한 지원자만 상대평가 대상으로 삼는다.
- 직무 적합도와 인재상 적합도 비중은 관리자가 설정하며 합계는 항상 100이다.
- 정책을 저장할 때 새 `policyVersion`을 만들고, 코호트가 `LOCKED`된 뒤에는 정책을 변경하지 않는다.
- 같은 코호트의 본질문 ID, 순서, 개수, NCS 능력단위와 인재상 루브릭은 동일한 질문 세트 snapshot으로 고정한다.
- 꼬리질문은 모든 지원자에게 동일한 최대 횟수와 생성 정책을 적용하지만, 실제 발생 여부는 근거 부족 상태에 따라 달라질 수 있다.
- 꼬리질문은 별도 가산점 문항이 아니라 본질문의 누락 근거를 보완하므로 종합점수 분모와 본질문 개수를 바꾸지 않는다.
- 동점 비교는 종합점수, 관리자가 더 높은 비중을 준 평가 트랙, 해당 트랙의 세부 가중치, 근거 충족률 순으로 수행한다.
- 모든 비교 값까지 같으면 동일 순위와 `WAITLIST`를 사용하며 임의 식별자나 응시 시각으로 순위를 결정하지 않는다.
- 코호트 상태는 `OPEN -> LOCKED -> EVALUATED -> FINALIZED` 단방향으로 전이한다.
- 최종 결과는 `PASS`, `WAITLIST`, `FAIL`, `INSUFFICIENT_EVIDENCE` 중 하나다.

## M0 Calculation Contract

### Track Scores And Coverage

- 모든 원시 행동 점수는 `0~100` 범위다. `INSUFFICIENT_EVIDENCE`는 `0`이 아니라 `null`로 유지한다.
- 직무 점수는 질문 snapshot에 고정된 NCS 행동 포인트의 유효 점수를 세부 가중치로 가중 평균한다. 세부 가중치가 없으면 동일 가중치를 사용한다.
- 인재상 점수는 `talent-rubric-snapshot.v1` criterion의 유효 점수를 criterion weight로 가중 평균한다.
- `null` 항목은 점수 분자와 분모에서 제외하되, 제외된 비중은 근거 충족률에서 그대로 미충족으로 계산한다. 따라서 일부 항목만 답해 점수를 높이는 효과는 최소 근거 gate로 차단한다.
- 직무 근거 충족률은 평가 완료 NCS 행동 포인트 가중치 합계 비율이고, 인재상 근거 충족률은 평가 완료 criterion weight 합계 비율이다.
- 종합 근거 충족률은 `직무 근거 충족률 * 직무 비중 + 인재상 근거 충족률 * 인재상 비중`을 `100`으로 나눈 값이다. 비중이 `0`인 트랙은 근거 gate에서 제외한다.
- 비중이 양수인 트랙의 점수가 `null`이거나 종합 근거 충족률이 관리자 최소값보다 낮으면 지원자 상태는 `INSUFFICIENT_EVIDENCE`다.
- 모든 중간 계산은 반올림하지 않는다. 저장·비교 직전 최종 트랙 점수, 종합점수와 근거 충족률만 decimal half-up 방식으로 소수 둘째 자리까지 반올림한다.
- 종합점수 공식은 `(직무 점수 * 직무 비중 + 인재상 점수 * 인재상 비중) / 100`이다.

### Decision Modes

| Mode | Evidence gate | Absolute score gate | Capacity ranking |
| --- | --- | --- | --- |
| `ABSOLUTE` | 적용 | 적용 | 미적용. gate 통과자는 `PASS`, 미통과자는 `FAIL` |
| `RELATIVE` | 적용 | 미적용 | 적용. 근거 gate 통과자를 동일 comparator로 순위화 |
| `HYBRID` | 적용 | 적용 | 적용. 절대 gate 통과자만 상대평가 진입 |

- 절대 score gate는 비중이 양수인 트랙에만 적용한다. 예를 들어 인재상 비중이 `0`이면 `minimumTalentScore`는 판정에 사용하지 않는다.
- `RELATIVE`에서도 근거 gate는 생략하지 않는다. 근거가 부족한 지원자는 순위 대상이 아니며 `INSUFFICIENT_EVIDENCE`다.
- `ABSOLUTE`의 `capacity`는 정책 snapshot에 보존하지만 판정에는 사용하지 않는다.

### Ranking, Ties And Percentile

- 상대평가 comparator는 `종합점수 -> 더 높은 관리자 비중 트랙 점수 -> 해당 트랙 세부 점수 vector -> 종합 근거 충족률` 순서다.
- 세부 점수 vector는 snapshot에 고정된 세부 가중치 내림차순, 동일 가중치이면 snapshot 순서로 정렬한 점수를 앞에서부터 사전식 비교한다. ID나 응시 시각은 값 비교에 사용하지 않는다.
- 두 트랙 비중이 같으면 특정 트랙 점수와 세부 vector 비교를 모두 생략한다.
- 모든 comparator 값이 같으면 competition ranking(`1, 2, 2, 4`)으로 동일 순위를 부여한다.
- 동점 그룹이 합격 정원 경계를 가로지르면 그룹 전체를 `WAITLIST`로 둔다. 정원 안에 완전히 포함된 상위 그룹은 `PASS`, 경계 아래 그룹은 `FAIL`이다. 이 규칙은 정원을 억지로 채우기 위해 동점을 임의 분리하지 않는다.
- 백분위는 절대 gate를 통과해 실제 순위가 있는 지원자만 계산한다. 공식은 지원자 수가 1명이면 `100`, 그 외에는 `(eligibleCount - rank) / (eligibleCount - 1) * 100`이다.
- 절대 gate 미통과자와 `INSUFFICIENT_EVIDENCE`는 rank와 percentile이 `null`이다. `RELATIVE`에서 정원 밖 `FAIL`은 실제 rank와 percentile을 유지한다.

### Snapshot And State Lifecycle

1. M2는 관리자 입력과 선택 질문을 `hiring-question-set-configuration.v1` 불변 snapshot으로 생성하고 `OPEN` 코호트에 연결한다.
2. M4는 `OPEN` 코호트를 잠글 때 공식/대체 NCS 평가 snapshot과 검증된 인재상 루브릭을 포함한 `hiring-evaluation-context.v1` 새 row를 생성한다. 기존 M2 snapshot row는 수정하지 않는다.
3. 같은 transaction에서 코호트의 `question_set_snapshot_id`를 M4 snapshot으로 교체하고 상태를 `LOCKED`로 전이한다.
4. `LOCKED` 이후에는 정책, 질문 순서, NCS 단위, 인재상 루브릭, 꼬리질문 한도와 지원자 집합을 변경하지 않는다.
5. M4 답변 평가는 이 최종 context version과 질문 identity가 일치할 때만 실행한다.
6. M5 집계 결과가 모두 terminal이면 `EVALUATED`, M6 최종 ranking snapshot을 선택하면 `FINALIZED`로 전이한다.
7. `EVALUATED` 상태에서는 입력이 같은 재실행은 기존 revision을 재사용하고, 입력 변경 재평가는 새 revision을 만든다. `FINALIZED` 이후에는 새 판정 revision을 만들지 않는다.

## Milestone Order

| Order | Milestone | Deliverable | Dependency |
| ---: | --- | --- | --- |
| 1 | M0 Policy Contract | 판정 모드, 관리자 비중, 질문 통일, 동점 규칙, 상태 계약 | none |
| 2 | M1 Data Model | 정책, 질문 세트 snapshot, 코호트, 지원자 집계, 순위 snapshot 저장 기반 | M0 |
| 3 | M2 Admin Configuration | 비중, 질문 모드, 절대 최소점수, 합격 정원 설정 API | M1 |
| 4 | M3 Talent Rubric | 인재상 입력을 행동 기준, 세부 가중치와 필수 근거로 변환 | M1; M2와 병렬 가능 |
| 5 | M4 Question and Evaluator Integration | 동일 질문 세트 배정과 NCS/인재상 독립 평가 | M2, M3 |
| 6 | M5 Candidate Aggregation | 질문별 결과를 직무/인재상 점수와 근거 충족률로 집계 | M4 |
| 7 | M6 Cohort Ranking | 절대 gate, 가중 종합점수, 순위, 백분위, 동점, 정원 판정 | M5 |
| 8 | M7 API, Views, E2E | 관리자 순위표, 지원자 리포트, 가상 코호트 전체 검증 | M6 |

권장 실행 경로는 `M0 -> M1 -> (M2 || M3) -> M4 -> M5 -> M6 -> M7`이다. M2와 M3만 병렬로 진행하고, M4 이후는 앞 단계의 고정 계약을 소비하므로 순차 통합한다.

## M1 Boundary

M1은 저장 구조와 무결성 제약까지만 구현한다.

- 관리자 점수 비중과 절대 gate를 immutable 정책 snapshot으로 저장한다.
- 코호트 전체가 소비할 본질문과 꼬리질문 한도를 immutable 질문 세트 snapshot으로 저장한다.
- 코호트 상태와 합격 정원을 저장한다.
- 지원자별 집계 점수와 근거 충족률을 저장할 자리를 마련한다.
- 최종 순위 계산 입력과 결과를 revision snapshot 및 entry로 분리한다.
- M2 관리자 API, M3 인재상 생성, 실제 점수 집계와 순위 계산은 구현하지 않는다.

## Commit Boundaries

각 커밋을 되돌렸을 때 아래 기능 하나만 사라지도록 유지한다.

1. M1 데이터 모델과 migration
2. M2 관리자 평가 정책 API
3. M3 인재상 루브릭 생성과 snapshot
4. M4 NCS/인재상 이중 평가
5. M5 지원자 종합점수 집계
6. M6 코호트 상대평가와 판정
7. M7 관리자/지원자 화면 및 E2E
