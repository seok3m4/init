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
