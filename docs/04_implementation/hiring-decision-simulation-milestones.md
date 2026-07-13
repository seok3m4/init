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
