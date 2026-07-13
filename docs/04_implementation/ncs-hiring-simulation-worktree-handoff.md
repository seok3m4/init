# NCS Evaluation And Hiring Simulation Worktree Handoff

## 1. Document Purpose

이 문서는 `feat/personality-rubric-design` 워크트리에서 계획한 범위, 실제 구현한 범위, 아직 구현하지 못한 범위와 다음 작업 순서를 한곳에 정리한다.

- 작성 기준일: 2026-07-13 KST
- 작업 브랜치: `feat/personality-rubric-design`
- 기능 커밋 범위: `d5aa0251`부터 본 문서 직전 `2c4c7a0a`까지 53개 커밋
- 공통 기준 브랜치와의 merge base: `da3fe8935f65f22be6a2a0f80594f97ff8c2110e`
- push 대상: `origin/feat/personality-rubric-design`
- 제외 파일: 기존 미추적 `docs/04_implementation/personality-question-rubric-design.md`

이 워크트리의 결과는 아래 두 트랙으로 구분해야 한다.

1. 지원자가 직접 사용하는 NCS 모의면접 답변 평가
2. 기업이 여러 지원자를 비교하는 채용 판정 시뮬레이션

첫 번째 트랙은 텍스트 화면과 STT 저장 답변 평가 경로까지 연결됐다. 두 번째 트랙은 질문별 NCS·인재상 평가인 M4까지 구현됐고, 지원자 종합점수와 최종 판정인 M5~M7은 남아 있다.

## 2. What Was Planned

### 2.1 NCS Mock Interview Evaluation

초기 계획은 다음 순서였다.

| Milestone | Planned outcome |
| --- | --- |
| M0 | 입력·출력 계약, 점수 의미, 골든 데이터, baseline과 hard gate 고정 |
| M1 | common-rubric, evidence-state, pairwise, hybrid 평가기 병렬 실험 |
| M2 | 동일 fixture 결과 비교와 제품 평가기 채택 |
| M3 | 채택 평가기를 API, SQS, worker, guardrail, polling 경계에 연결 |
| M4 | 직무 선택, 질문 생성, 텍스트 답변, 평가 결과를 한 route에서 제공 |
| M5 | 실제 화상면접의 저장 STT 답변을 평가하고 모의면접 리포트에 투영 |

사용자가 선택할 텍스트 연습 모드는 아래처럼 계획했다.

| Mode | Main questions | Session follow-up budget |
| --- | ---: | ---: |
| `QUICK` | 3 | 2 |
| `STANDARD` | 5 | 3 |
| `DEEP` | 7 | 4 |

각 본질문에는 필요한 경우 한 번의 꼬리질문을 사용하고, 꼬리답변은 별도 가산점 문항이 아니라 기존 질문의 누락 근거를 보완하도록 설계했다.

### 2.2 Hiring Decision Simulation

채용 판정 시뮬레이션은 다음 순서로 계획했다.

```text
M0 Policy Contract
-> M1 Data Model
-> (M2 Admin Configuration || M3 Talent Rubric)
-> M4 Question And Evaluator Integration
-> M5 Candidate Aggregation
-> M6 Cohort Ranking
-> M7 API, Views And E2E
```

핵심 요구사항은 다음과 같다.

- 관리자가 직무 점수와 인재상 점수의 반영 비율을 조절한다.
- 두 비율의 합은 정확히 100이어야 한다.
- 같은 코호트는 같은 본질문 ID, 순서, 개수와 평가 기준을 사용한다.
- 근거가 부족하면 0점이 아니라 `INSUFFICIENT_EVIDENCE`와 `null` 점수를 사용한다.
- 절대평가, 상대평가, 혼합평가를 지원한다.
- 동점자는 ID나 응시 시각으로 임의 분리하지 않는다.
- 눈동자, 표정, 억양과 같은 비언어 정보는 직무·인재상 점수에 섞지 않는다.
- 실제 채용 결과와 분리된 시뮬레이션 snapshot으로 저장한다.

## 3. What Was Implemented

### 3.1 NCS M0: Evaluation Contract And Baseline

M0는 구현 완료 상태다.

- JSON 입력·출력 schema를 고정했다.
- `INSUFFICIENT_EVIDENCE`와 1~5단계 점수를 분리했다.
- 단계와 점수 매핑은 일반 코드가 결정하도록 했다.
- 7개 맥락, 48개 합성 case를 만들었다.
- 무응답, 무관 답변, 짧지만 강한 답변, 민감 속성, 자기모순, 근거 삭제 변형을 포함했다.
- baseline을 48 case x 5회, 총 240회 실행했다.
- M0 hard gate를 모두 통과했다.
- baseline의 기대 근거 인용률은 97.89%, 단계·꼬리질문·반복성은 100%였다.

대표 커밋은 `d5aa0251`이다.

### 3.2 NCS M1 And M2: Parallel Evaluators And Selection

다중 Codex 에이전트가 서로 다른 디렉터리에서 네 전략을 구현했다. 이것은 사람 팀원 간 기능 분담이 아니라 한 완성품 안에서 평가기를 비교하기 위한 실험이었다.

| Strategy | Result |
| --- | --- |
| common-rubric | 구현·반복 실행·비교 완료 |
| evidence-state | 구현·반복 실행·비교 완료, 최종 채택 |
| pairwise | 구현·반복 실행·비교 완료 |
| hybrid | 구현·반복 실행·비교 완료 |

채택 결과는 다음과 같다.

- 선택 전략: `evidence-state`
- 전략 버전: `evidence-state-rules-v1`
- 실행 모델: `deterministic-evidence-state-v1`
- 48 case x 5회 기준 exact level, quote coverage, follow-up, repeatability가 모두 100%였다.
- 중간 `BehaviorEvidenceState`가 있어 근거 추출, 누락 근거, 단계 판정 원인을 추적하기 쉬웠다.
- 외부 모델 호출 없이 결정론적으로 실행하므로 반복 비용은 0이었다.

대표 커밋은 `933cc91f`, `2be0b39c`, `693173ac`, `27d64097`, `8fa45056`이다.

### 3.3 NCS M3: Product Evaluation Pipeline

채택 평가기를 실제 제품 비동기 경로에 연결했다.

```text
TEXT_INPUT 또는 STORED_ANSWER
-> API-097
-> ai_process_logs
-> SQS
-> worker evidence-state evaluator
-> guardrail
-> immutable revision
-> polling output
```

구현된 주요 기능은 다음과 같다.

- 평가 요청 API: `POST /api/v1/candidate/mock-interviews/{sessionId}/ncs-evaluations`
- 상태 조회 API: `GET /api/v1/ai/jobs/{processLogId}/status`
- 제품 출력 계약: `ncs-evaluation-product.v1`
- worker queue kind: `MOCK_NCS_ANSWER_EVALUATION`
- `TEXT_INPUT`은 요청 transcript를 사용한다.
- `STORED_ANSWER`는 서버 DB에 저장된 STT transcript만 사용한다.
- 같은 입력은 deduplication key로 기존 작업을 재사용한다.
- 평가 완료 결과는 `ncs_evaluation_revisions`에 append-only로 저장한다.
- 가드레일 통과 전에는 최종 revision을 저장하지 않는다.
- 답변 속 실제 quote, 시작·종료 offset, 행동 포인트 연결을 검증한다.
- 민감 속성, 비언어 신호, 근거 없는 채용 판정 표현을 평가 근거에서 차단한다.
- filler, 무응답 placeholder, 문자 없는 transcript는 평가 작업을 만들지 않는다.

대표 커밋은 `a90c2806`, `81bd4885`, `72287b76`, `b111555e`, `3d4122a7`, `ef5e8c29`이다.

### 3.4 NCS M4: Text Practice View

실사용 가능한 route를 구현했다.

- 화면: `/candidate/mock-interview/ncs-practice`
- 입력: 직무, `QUICK | STANDARD | DEEP`, 본질문 답변, 선택적 꼬리답변
- 출력: 행동 기준, 실제 발화 근거, 상태, 단계·점수 또는 `null`, 누락 근거, 자연어 꼬리질문
- 새로고침이나 polling timeout 후 기존 `processLogId`를 다시 조회하는 복구 상태를 추가했다.
- 평가 버튼 중복 클릭과 같은 답변의 중복 평가 생성을 차단했다.
- 꼬리답변은 원 답변에 누적하고 동일 answer row를 갱신한다.
- 답변을 평가한 뒤에만 다음 본질문으로 이동할 수 있다.
- 세션 완료 전 질문별 결과 요약을 유지한다.

직무 적합성도 보강했다.

- 선택 직무와 무관한 답변은 유창하더라도 정상 직무 점수로 처리하지 않는다.
- 백엔드 질문에 프론트엔드·QA 경험만 답한 경우 관련성 gate를 적용한다.
- 행동, 선택 근거, 결과와 대안 비교가 부족하면 점수 대신 꼬리질문으로 근거를 요청한다.
- 첫 답변에 충분한 근거가 있는 경우와 꼬리답변으로 보완한 경우는 최종 누적 근거를 기준으로 평가하되, 실제 evidence span은 보존한다.

대표 커밋은 `d9592a16`, `13e41c57`, `3725f51b`, `05476efd`, `8af6b249`, `cd7e494c`, `a6e4a2d5`, `bbeeaf9b`이다.

### 3.5 Official NCS Reference Integration

공식 NCS Open API key를 환경변수로 주입할 수 있게 했고, 평가 snapshot resolver에 연결했다.

- API key는 저장소에 커밋하지 않고 `.env`에서 읽는다.
- API 시작 시 공식 활성 능력단위 catalog를 메모리에 적재한다.
- 2026-07-13 로컬 실행에서는 공식 활성 능력단위 revision 234개 로딩을 확인했다.
- 공식 자료에서 현재 직무·질문 유형을 해결할 수 있으면 `OFFICIAL_NCS` 근거를 사용한다.
- 공식 API 실패 또는 매핑 불가 시 결정론적 `SYNTHETIC_NCS_LIKE` profile로 fallback한다.
- 세션이 시작되면 질문별 평가 snapshot을 JSONB로 고정해 이후 catalog 변경과 서버 재시작의 영향을 막는다.

대표 커밋은 `b88d7227`, `6c1b4ba6`, `5736c580`이다.

### 3.6 NCS M5 Code Path: Stored STT And Report Projection

실제 저장 답변을 평가하는 코드 경로와 자동 테스트는 구현했다.

- 화상면접에서 저장된 answer ID와 STT transcript를 평가 입력으로 사용한다.
- `STORED_ANSWER -> NCS 평가 -> immutable revision` 경로를 구현했다.
- NCS 결과를 기존 모의면접 리포트 계약에 투영한다.
- 리포트 화면에 행동 근거를 표시한다.
- STT holdout과 실제 PostgreSQL 수직 E2E를 추가했다.

대표 커밋은 `64797667`, `14903cbd`, `23707d23`, `ae4a8915`, `1a92540a`이다.

이 단계에서 코드 연결과 자동 테스트는 완료됐지만, 실제 사용자 화상면접 표본을 이용한 STT calibration과 점수 타당성 검증은 완료되지 않았다.

### 3.7 Hiring M0: Policy And Calculation Contract

채용 판정 규칙을 문서 계약으로 고정했다.

- 기본 모드는 `HYBRID`다.
- `ABSOLUTE`, `RELATIVE`, `HYBRID` 계산 규칙을 정의했다.
- 관리자가 직무·인재상 비중, 최소점수, 최소 근거 충족률, 정원을 설정한다.
- 비중 합은 정확히 100이어야 한다.
- 본질문과 꼬리질문의 점수 분모 규칙을 분리했다.
- `null` 점수를 0점으로 바꾸지 않는다.
- 가중 종합점수, 근거 충족률, 반올림 시점을 정확히 정의했다.
- 동점 비교 순서는 더 높은 관리자 비중을 반영한다.
- 완전 동점은 competition ranking과 `WAITLIST`를 사용한다.
- 코호트 상태는 `OPEN -> LOCKED -> EVALUATED -> FINALIZED`다.

대표 커밋은 `00633c25`이다.

### 3.8 Hiring M1: Data Model

다음 저장 구조와 migration을 추가했다.

- immutable hiring evaluation policy
- immutable question set/context snapshot
- hiring evaluation cohort
- candidate evaluation summary 자리
- ranking snapshot과 ranking entry 자리
- immutable per-answer hiring evaluation revision

DB 제약으로 비중 합, 점수 범위, 정원, 상태별 timestamp와 revision uniqueness를 검증한다.

대표 커밋은 `c2643ea8`, `acf2f570`, `ee647630`, `15814b0c`, `0893f350`이다.

### 3.9 Hiring M2: Admin Configuration API

다음 API를 구현했다.

- 생성: `POST /api/v1/company/interviews/hiring-simulations`
- 조회: `GET /api/v1/company/interviews/hiring-simulations/{cohortId}`

생성 시 아래 내용을 검증하고 immutable snapshot으로 저장한다.

- 기업이 공고와 질문을 소유하는지
- 질문 세트가 활성 상태인지
- 질문 ID, 유형, 내용, 순서가 일치하는지
- 질문 ID가 중복되지 않는지
- 모드별 질문 수와 꼬리질문 한도가 맞는지
- 비중 합, 최소점수, 정원이 유효한지
- 같은 request key와 같은 입력은 기존 설정을 재사용하는지
- 같은 request key로 다른 입력을 보내면 conflict인지

대표 커밋은 `7324b501`, `acf2f570`, `ee647630`이다.

### 3.10 Hiring M3: Talent Rubric Generator

기업 인재상 문장을 답변 발화로 관찰 가능한 행동 기준으로 바꾸는 결정론적 생성기를 구현했다.

- 입력 항목은 1~6개다.
- criterion weight 합을 exact largest-remainder 방식으로 100에 맞춘다.
- 각 criterion은 `ACTION`, `RATIONALE`, `RESULT`, `REFLECTION` indicator를 가진다.
- 1~5 scoring anchor를 가진다.
- 필수 근거가 하나라도 없으면 `INSUFFICIENT_EVIDENCE`, 점수는 `null`이다.
- 민감 속성과 비언어 신호는 criterion과 점수에서 제거한다.
- 동일 입력은 동일 ID, source hash와 snapshot을 만든다.
- 전체 결과는 `talent-rubric-snapshot.v1` 런타임 validator를 통과해야 한다.

이 생성기는 일반 심리검사가 아니다. 기업이 선언한 인재상과 지원자가 말한 행동 근거의 연결만 평가한다.

대표 커밋은 `87b0d5c4`, `7d13739d`, `79558fa2`이다.

### 3.11 Hiring M4: Context Lock And Dual Evaluation

M2 정책·질문과 M3 루브릭을 실제 평가 실행 context에 결합했다.

### Context lock

- API: `POST /api/v1/company/interviews/hiring-simulations/{cohortId}/lock`
- `hiring-evaluation-context.v1` snapshot을 새 row로 append한다.
- 기존 M2 설정 snapshot은 수정하지 않는다.
- 같은 transaction에서 코호트를 `OPEN -> LOCKED`로 전이한다.
- canonical hash로 동일 요청을 재사용한다.
- 다른 rubric/context로 중복 잠금을 요청하면 conflict다.
- 조건부 update로 동시 잠금 경쟁에서 한 요청만 성공하도록 했다.

### Per-answer evaluation

- API: `POST /api/v1/company/interviews/hiring-simulations/{cohortId}/answer-evaluations`
- caller는 session ID, question ID, primary answer ID만 전달한다.
- transcript, 점수와 context는 서버 DB에서 조회한다.
- 실제 `RECRUITING` 세션과 저장 STT 답변만 허용한다.
- 공고, 질문 ID·유형·본문·순서가 잠긴 context와 같아야 한다.
- 허용된 immediate follow-up answer를 원 답변과 함께 canonical transcript로 만든다.
- 질문별 NCS 직무 평가와 인재상 평가를 서로 독립적으로 실행한다.
- 실제 quote offset과 turn identity를 저장한다.
- 근거 부족은 각 트랙에서 독립적으로 `null` 처리한다.
- context와 answer revision hash가 같으면 기존 결과를 재사용한다.
- 변경된 답변은 새 immutable revision을 만든다.

대표 커밋은 `15814b0c`, `82fd53b8`이다.

### 3.12 Live-Test Defects Fixed

실제 브라우저 테스트에서 발견한 두 오류를 수정했다.

### Question snapshot DB constraint

- 증상: 첫 답변 저장 시 PostgreSQL check constraint 위반으로 HTTP 500 발생
- 원인: 질문 뱅크 ID와 최초 질문 유형·본문 snapshot을 함께 저장하는 코드와 기존 DB 제약이 충돌
- 수정: 레거시 ID-only row와 새 ID+snapshot row를 모두 허용하고, runtime private question 형태는 계속 엄격하게 유지
- 커밋: `0893f350`

### Follow-up answer current-question conflict

- 증상: NCS 꼬리질문 답변 저장 시 HTTP 409 `Answer must match the current question.`
- 원인: 첫 답변 저장 뒤 서버가 다음 미응답 본질문으로 이동했지만, UI는 이전 질문의 답변을 보강하려고 이전 question ID를 사용
- 수정: 기존 text answer 보강은 같은 answer row를 갱신하고, 처음 답하는 질문에는 기존 current-question 검사를 유지
- 실제 DB smoke 결과: 첫 답변과 보강 답변이 동일 answer ID로 저장되고 worker 평가가 `COMPLETED`
- 커밋: `2c4c7a0a`

## 4. Current Input And Output Boundaries

### 4.1 Candidate NCS Text Practice

Input:

- 직무
- 연습 모드
- 본질문 텍스트 답변
- 필요한 경우 한 번의 꼬리답변

Output:

- 평가 기준의 출처와 직무·능력단위
- 행동 포인트
- 실제 답변 quote와 offset
- 행동 포인트별 상태, 1~5단계, 환산점수 또는 `null`
- 판정 이유와 신뢰도
- 평가 근거 충족률
- 누락 근거와 꼬리질문
- 민감 속성·비언어·채용 판정 표현 guardrail 결과

이 화면의 점수는 해당 질문에서 확인한 행동 근거의 수준이다. 실제 채용 합격·불합격이나 지원자의 전체 직무 능력을 의미하지 않는다.

### 4.2 Hiring Simulation M4

Input:

- 잠긴 관리자 정책
- 잠긴 본질문 세트
- 질문별 NCS snapshot
- 검증된 인재상 rubric snapshot
- DB에 저장된 실제 recruiting session과 STT 답변

Output:

- 질문 하나의 NCS 직무 평가 결과
- 질문 하나의 인재상 criterion 평가 결과
- 실제 evidence span과 누락 근거
- immutable answer evaluation revision

현재 M4는 지원자의 전체 종합점수, 순위, 백분위나 `PASS | WAITLIST | FAIL`을 반환하지 않는다.

## 5. What Is Not Implemented

### 5.1 Hiring M5: Candidate Aggregation

다음 기능은 아직 없다.

- 대상 지원자와 recruiting session 집합을 transaction에서 고정
- 각 질문의 최신 유효 M4 revision 선택
- 질문별 NCS·인재상 결과를 지원자 단위로 집계
- 직무 점수, 인재상 점수, 종합 근거 충족률 계산
- 관리자 비중을 적용한 가중 종합점수 계산
- `candidate_evaluation_summaries` 저장
- 고정된 모든 지원자 결과가 terminal일 때 `LOCKED -> EVALUATED` 전이

### 5.2 Hiring M6: Ranking And Decision

다음 기능은 아직 없다.

- 절대 minimum score gate 실행
- 상대평가 comparator 실행
- competition rank와 percentile 계산
- 동점 그룹과 정원 경계 처리
- `PASS | WAITLIST | FAIL | INSUFFICIENT_EVIDENCE` 확정
- ranking snapshot과 entry 저장
- `EVALUATED -> FINALIZED` 전이

### 5.3 Hiring M7: Product Views And Full E2E

다음 화면과 전체 사용자 흐름은 아직 없다.

- 관리자용 채용 시뮬레이션 설정 화면
- 인재상 rubric 생성·검토 화면
- 코호트 잠금과 평가 실행 화면
- 지원자별 직무·인재상 종합 결과 화면
- 순위·백분위·동점·정원 판정 화면
- 지원자에게 제공할 최종 리포트 화면
- 가상 지원자 여러 명을 이용한 M2~M6 전체 E2E

M2와 M4 API는 존재하지만 모든 답변을 자동 순회하는 batch orchestrator는 아직 없다. 현재는 질문별 answer evaluation API를 호출해야 한다.

### 5.4 NCS Data And Real-Interview Validation

다음은 구현 또는 검증이 남아 있다.

- 공식 NCS 전체 catalog의 RDS 영속 동기화
- 정기 동기화 scheduler와 운영 실패 이력
- 다양한 실제 직무를 공식 NCS 세분류·능력단위에 매핑하는 운영 품질 검증
- 실제 화상면접 음성·STT 오류가 포함된 사용자 표본 calibration
- 실제 사용자 답변에 대한 질문 적합성, 점수 분포와 꼬리질문 품질 검토
- 동일 사용자 재도전 전후 변화 검증
- 실제 채용 성과와의 상관관계 검증

현재 공식 NCS 연동은 API startup catalog와 질문별 snapshot 수준이다. 공식 매핑을 해결하지 못하면 synthetic fallback을 사용하므로 모든 질문을 공식 NCS 원문이라고 표현하면 안 된다.

### 5.5 Personality And Nonverbal Track

- 기업 인재상 기반 `talent-rubric-snapshot.v1`은 구현했다.
- 별도의 일반 인성질문 심리 루브릭 제품은 구현하지 않았다.
- 기존 미추적 `personality-question-rubric-design.md`는 이번 브랜치 커밋과 push에서 제외했다.
- eye tracker, 시선 기반 cheating detection과 비언어 점수는 이 워크트리에 구현하지 않았다.
- 비언어 정보는 현재 NCS·인재상 점수에서 의도적으로 제외한다.
- 향후 eye tracker를 추가해도 cheating 의심 신호나 전달 방식 코칭처럼 별도 결과로 유지해야 하며, 현재 점수 계약에 자동 합산하면 안 된다.

## 6. Important Decisions And Reasons

| Decision | Reason |
| --- | --- |
| evidence-state 평가기 채택 | 합성 fixture 정확도, 인용, 꼬리질문, 반복성이 모두 100%이고 오판 추적이 쉬움 |
| 근거 부족을 `null`로 보존 | 답변하지 않은 역량을 0점 역량으로 오해하지 않기 위해서 |
| 직무와 인재상 평가 분리 | 한 트랙의 강한 근거가 다른 트랙의 누락을 숨기지 못하게 하기 위해서 |
| immutable snapshot과 revision | 질문·루브릭·답변 변경 후에도 당시 평가를 재현하기 위해서 |
| 꼬리질문을 보완 수단으로 처리 | 꼬리질문 횟수가 점수 분모나 가산점으로 작동하지 않게 하기 위해서 |
| 비언어 신호를 점수에서 제외 | 답변 transcript 근거와 다른 관찰 신호를 섞지 않고 별도 검증 경계를 유지하기 위해서 |
| 완전 동점을 유지 | 식별자나 응시 순서로 근거 없이 합격자를 나누지 않기 위해서 |

## 7. Verification Performed

### 7.1 Earlier Full Verification

M4 통합 직후 확인한 전체 검증 기록은 다음과 같다.

- API: 44 suites, 265 tests passed
- worker: 157 tests passed
- API/worker typecheck passed
- Prisma validate/generate passed
- 당시 신규 PostgreSQL에서 28개 migration 적용 확인

이 전체 검증은 마지막 두 live-test fix 이전 기록이다.

### 7.2 Verification After Live-Test Fixes

마지막 수정 뒤에는 다음을 확인했다.

- `PrismaInterviewRepository` focused suite: 4 tests passed
- `InterviewController` focused suite: 16 tests passed
- backend API typecheck passed
- Prisma schema validate passed
- 실제 PostgreSQL에서 질문 snapshot constraint SQL 실행 성공
- 실제 API에서 첫 text answer 저장 성공
- 같은 질문의 follow-up text가 동일 answer ID로 update됨
- 누적 transcript 평가 작업이 worker에서 `COMPLETED`
- polling output contract가 `ncs-evaluation-product.v1`임을 확인
- frontend route HTTP 200
- API health HTTP 200
- 공식 NCS 활성 unit revision 234개 startup load 확인

### 7.3 Harness And Local DB Limits

- D harness의 `verify-docs`는 통과했다.
- D ownership 검사는 기존 미추적 `docs/04_implementation/personality-question-rubric-design.md` 때문에 실패했다.
- 해당 파일은 사용자 소유 기존 파일로 판단해 수정·삭제·커밋하지 않았다.
- 현재 로컬 DB에는 다른 브랜치에서 적용된 migration이 있고 이 브랜치에만 있는 migration도 있어 migration history가 일치하지 않았다.
- 따라서 로컬 DB 전체에 `prisma migrate deploy`를 강행하지 않고, live-test 오류를 고치는 check constraint SQL만 `prisma db execute`로 적용했다.
- 새 migration 파일은 저장소에 포함했지만, 마지막 fix까지 포함한 전체 clean-database migration 재실행은 별도로 수행해야 한다.

## 8. Recommended Next Steps

다음 구현은 아래 순서로 진행한다.

1. 최신 `origin/dev`와 통합하고 C/D/E/PM 소유 영역 conflict와 계약 변경을 검토한다.
2. 깨끗한 임시 PostgreSQL에서 전체 migration chain을 처음부터 적용한다.
3. M5 대상 지원자·세션 집합 고정과 candidate aggregation을 구현한다.
4. M0 계산 계약의 직무 점수, 인재상 점수, 근거 충족률, 가중 종합점수를 테스트한다.
5. M6 comparator, competition rank, percentile, 동점 정원 경계와 최종 판정을 구현한다.
6. M7 관리자 설정·순위 화면과 지원자 결과 화면을 연결한다.
7. 최소 3명 이상의 가상 지원자와 다양한 답변 revision으로 전체 E2E를 수행한다.
8. 실제 면접 데이터가 준비되면 STT calibration과 질문·점수 품질 검토를 별도 수행한다.

M5 시작 시 반드시 지켜야 할 조건은 다음과 같다.

- 집계 대상 지원자와 세션을 한 transaction에서 고정한다.
- 질문별 최신 유효 M4 revision만 사용한다.
- 비중이 있는 트랙의 점수가 `null`이면 종합점수를 만들지 않는다.
- 중간 계산은 반올림하지 않고 최종 저장·비교 직전에만 소수 둘째 자리로 반올림한다.
- 모든 고정 구성원이 terminal일 때만 코호트를 `EVALUATED`로 바꾼다.

## 9. Integration Risks

- 현재 브랜치와 최신 `origin/dev`는 공통 merge base 이후 각각 많은 커밋이 있어 직접 merge 시 conflict 가능성이 높다.
- 변경 범위가 frontend, candidate interview, company interview, worker, Prisma와 공용 문서에 걸쳐 있어 D, C, E와 PM review가 필요하다.
- 합성 fixture의 높은 정확도는 실제 사용자·공식 NCS 타당성을 증명하지 않는다.
- runtime 공식 API 장애 시 fallback이 동작하지만 source kind를 UI와 결과에 계속 표시해야 한다.
- M5/M6 없이 질문별 점수를 합격·불합격으로 해석하면 현재 구현 경계를 위반한다.
- eye tracker나 비언어 신호를 기존 점수에 바로 합산하면 현재 evidence·공정성 계약을 위반한다.

## 10. Commit Map

| Area | Representative commits |
| --- | --- |
| M0 baseline | `d5aa0251` |
| M1 strategy implementations | `933cc91f`, `2be0b39c`, `693173ac`, `27d64097`, `e1caf310` |
| M2 comparison and selection | `8fa45056` |
| Product API and worker | `a90c2806`, `81bd4885`, `72287b76`, `b111555e`, `3d4122a7` |
| Text practice UI | `d9592a16`, `13e41c57` |
| STT and report integration | `64797667`, `14903cbd`, `23707d23` |
| Idempotency and revisions | `9ee54a2d`, `ef5e8c29` |
| DB vertical E2E | `1a92540a` |
| Job-specific snapshots and evidence | `5736c580`, `8af6b249`, `cd7e494c` |
| Three practice modes and official NCS | `bbeeaf9b`, `b88d7227`, `6c1b4ba6` |
| Hiring M1 data model | `c2643ea8` |
| Hiring M2 admin API | `7324b501`, `acf2f570`, `ee647630` |
| Hiring M3 talent rubric | `87b0d5c4`, `7d13739d`, `79558fa2` |
| Hiring M4 dual evaluation | `15814b0c`, `82fd53b8` |
| Live DB constraint fix | `0893f350` |
| Follow-up answer 409 fix | `2c4c7a0a` |

전체 세부 커밋은 다음 명령으로 확인한다.

```powershell
$base = git merge-base HEAD origin/dev
git log --oneline --reverse "$base..HEAD"
```

## 11. Final Worktree State Before Shutdown

- NCS practice frontend, API와 worker는 종료 전에 정상 응답을 확인했다.
- 현재 작업 종료 시 frontend, API, worker와 이번 작업에서 시작한 Redis를 중지한다.
- 커밋·push 대상에는 이 문서와 현재 브랜치의 추적 파일만 포함한다.
- 기존 미추적 인성 루브릭 문서는 로컬에 그대로 남긴다.
