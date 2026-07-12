# NCS Evaluation M1 Parallel Start

M0 계약을 공통 기준으로 네 평가 전략을 독립 구현하는 실행 가이드다. M0 커밋을 기준으로 워크트리를 만든 뒤 각 팀은 자신의 전략 디렉터리만 수정한다.

## Prerequisites

```text
docs/04_implementation/ncs-evaluation-m0/*
scripts/verify-ncs-evaluation-m0.mjs
backend/worker/src/experiments/ncs-evaluation/shared/*
backend/worker/src/experiments/ncs-evaluation/baseline/*
```

M0 공용 파일은 M1 브랜치에서 수정하지 않는다. 계약 변경이 필요하면 구현을 멈추지 말고 전략 README에 `CONTRACT_CHANGE_PROPOSAL`로 기록한 뒤 현재 계약으로 가능한 범위까지 진행한다.

## Baseline

`baseline-deterministic`은 48개 case를 5회씩 실행해 다음 결과를 기록했다.

| Metric | Result |
| --- | ---: |
| Hard gates | PASS |
| Exact status | 100.00% |
| Exact level | 100.00% |
| Expected quote coverage | 97.89% |
| Follow-up decision | 100.00% |
| Repeatability | 100.00% |
| p95 latency | 0.24ms |
| Estimated cost | $0 |

이 수치는 합성 fixture에 대한 baseline 결과이며 산업현장 타당성을 의미하지 않는다. LLM 전략이 단순히 같은 fixture를 외우지 않고 더 일반적인 의미 판정과 근거 품질을 제공하는지 확인하는 비교 기준이다.

## Parallel Work Packages

| Strategy | Branch | Owned Directory | Main Question |
| --- | --- | --- | --- |
| Common rubric | `experiment/ncs-eval-common-rubric` | `backend/worker/src/experiments/ncs-evaluation/common-rubric/` | 단일 구조화 프롬프트로 직접 단계 판정이 가능한가 |
| Evidence state | `experiment/ncs-eval-evidence-state` | `backend/worker/src/experiments/ncs-evaluation/evidence-state/` | 근거 추출과 충족 판정을 분리하면 설명력이 좋아지는가 |
| Pairwise | `experiment/ncs-eval-pairwise` | `backend/worker/src/experiments/ncs-evaluation/pairwise/` | 기준 답변과 비교하면 단계 경계가 안정적인가 |
| Hybrid | `experiment/ncs-eval-hybrid` | `backend/worker/src/experiments/ncs-evaluation/hybrid/` | 근거 상태와 기준 답변 비교를 결합하면 추가 가치가 있는가 |

각 디렉터리의 `README.md`가 바로 실행할 작업 명세다.

## Worktree Setup

M0 변경을 커밋한 브랜치 또는 commit을 `BaseRef`로 전달한다. 스크립트는 기본적으로 dry-run이며 `-Apply` 또는 `--apply`를 줘야 실제 브랜치와 워크트리를 만든다.

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-ncs-evaluation-worktrees.ps1 `
  -BaseRef <M0_COMMIT_OR_BRANCH>

powershell -ExecutionPolicy Bypass -File scripts/setup-ncs-evaluation-worktrees.ps1 `
  -BaseRef <M0_COMMIT_OR_BRANCH> `
  -Apply
```

macOS/Linux:

```bash
bash scripts/setup-ncs-evaluation-worktrees.sh --base-ref <M0_COMMIT_OR_BRANCH>
bash scripts/setup-ncs-evaluation-worktrees.sh --base-ref <M0_COMMIT_OR_BRANCH> --apply
```

## Strategy Implementation Contract

각 전략은 최소 다음 파일을 만든다.

```text
<strategy>/evaluator.ts
<strategy>/evaluator.test.ts
<strategy>/run.ts
<strategy>/results.json
<strategy>/README.md
```

`evaluator.ts`는 `NcsEvaluationStrategy`를 구현한다. `run.ts`는 공통 CLI를 사용한다.

```typescript
import { resolve } from "node:path";
import { runNcsStrategyCli } from "../shared/cli";
import { StrategyEvaluator } from "./evaluator";

runNcsStrategyCli(
  new StrategyEvaluator(),
  process.argv.slice(2),
  resolve(__dirname, "results.json"),
).catch((error) => {
  console.error(error);
  process.exit(1);
});
```

## Required Commands

```powershell
cd backend/worker
npm ci
npm test
node dist/experiments/ncs-evaluation/<strategy>/run.js `
  --dataset ../../docs/04_implementation/ncs-evaluation-m0/golden-cases.json `
  --output src/experiments/ncs-evaluation/<strategy>/results.json `
  --runs 5
cd ../..
node scripts/verify-ncs-evaluation-m0.mjs `
  --results backend/worker/src/experiments/ncs-evaluation/<strategy>/results.json
```

## M1 Done

- 공통 output 계약을 변경하지 않는다.
- 48개 case를 5회 실행한 `results.json`이 있다.
- M0 verifier의 hard gate를 모두 통과한다.
- prompt, model, latency, 비용이 결과에 기록된다.
- 실패·재시도도 최종 비교 비용에 포함한다.
- 전략 README에 강점, 실패 유형, 남은 위험을 기록한다.
- M2 비교기에 결과 경로를 바로 전달할 수 있다.

## M1 And M2 Overlap

M2 도구 개발은 완료되어 있으므로 전략 하나가 끝날 때마다 비교 리포트를 갱신할 수 있다. 최종 채택은 baseline 외 전략이 최소 2개 이상 hard gate를 통과한 뒤에만 수행한다.
