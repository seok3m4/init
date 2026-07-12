# NCS Evaluation M0 Readiness

측정 시점 기준 M0 항목별 준비 상태다. 요청에 따라 `골든 정답 팀 합의`와 `cross-owner 승인`은 완료율 산정에서 제외한다.

## Completion

| Item | Completion | Evidence |
| --- | ---: | --- |
| 공통 입력 계약 | 100% | `input.schema.json` parse 및 필수 필드 검증 통과 |
| 공통 출력 계약 | 100% | `output.schema.json` parse, 중첩 객체·추가 필드·null 정책 검증 통과 |
| 판정 상태와 점수 의미 | 100% | `INSUFFICIENT_EVIDENCE`와 1~5단계 분리, 고정 score map 검증 |
| AI 판정과 결정론적 계산 분리 | 100% | `NcsEvaluationStrategy`는 단계 반환, score map과 runner는 공통 코드로 고정 |
| 골든 데이터 수량 | 100% | 7개 맥락, 48개 case |
| 골든 데이터 다양성 | 100% | 무응답, 무관, 유창하지만 잘못된 답변, 짧지만 강한 답변, 민감 속성, 문체, 핵심 근거 제거, 자기모순, 다중 행동 포인트 포함 |
| 하드 게이트 | 100% | 실제 baseline 240회 결과가 10개 hard gate 통과 |
| 비교·채택 기준 | 100% | 임의 가중치 없이 lexicographic ranking 구현 |
| 브랜치·파일 충돌 방지 | 100% | 전략별 branch와 owned directory 고정, worktree setup dry-run 기본값 |
| M0 자산 검증기 | 100% | schema, dataset, relation, output, evidence offset, score mapping 검증 |
| 실제 평가기 | 100% | 기대 label과 case ID를 읽지 않는 deterministic baseline 구현 |
| 실제 평가 결과 | 100% | 48 case x 5 runs 결과 파일 생성 및 검증 통과 |
| 근거 인용 품질 | 97.89% | expected quote coverage 97.89%, 목표 95% 이상 |
| 단계·꼬리질문·반복 안정성 | 100% | exact level 100%, follow-up 100%, repeatability 100% |
| worker 실행 환경 | 100% | `npm ci` 완료, worker 91 tests 통과 |
| M1 병렬 시작 준비 | 100% | 공통 TypeScript contract·dataset loader·runner·CLI와 전략별 task README 준비 |
| M2 병렬 비교 준비 | 100% | baseline smoke comparison, JSON·Markdown report 생성 완료 |

## Effective M0 Completion

```text
최저 항목: 97.89%
95% 미만 항목: 0개
M0 상태: READY
```

위 수치는 합성 fixture와 로컬 실행 기준의 시스템 일관성이다. 공식 NCS 타당성, 실제 사용자 일반화, 채용 성과 예측력은 포함하지 않는다.

## Executed Validation

```text
node scripts/verify-ncs-evaluation-m0.mjs --self-test
node scripts/verify-ncs-evaluation-m0.mjs --results backend/worker/src/experiments/ncs-evaluation/baseline/results.json
npm test  # backend/worker, 91 passed
node scripts/compare-ncs-evaluation-results.mjs --results backend/worker/src/experiments/ncs-evaluation/baseline/results.json
PowerShell worktree setup parser: PASS
Git Bash worktree setup syntax: PASS
```

## Start Gate

M0 변경을 하나의 commit으로 만든 뒤 해당 commit 또는 branch를 `BaseRef`로 전달하면 M1 워크트리를 생성할 수 있다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-ncs-evaluation-worktrees.ps1 `
  -BaseRef <M0_COMMIT_OR_BRANCH> `
  -Apply
```

현재 스크립트가 commit된 M0 파일을 요구하므로 미커밋 상태에서 실수로 이전 기준의 워크트리를 만드는 것을 차단한다.
