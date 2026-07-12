# Deterministic Baseline

M1 전략 비교의 최소 기준선이다. 골든 case ID와 예상 결과를 읽지 않고 발화의 관련성, 부적절한 행동, 구체 행동, 판단 근거, 결과, 성찰을 결정론적 규칙으로 판정한다.

프로덕션 평가기로 사용하지 않는다. LLM 전략이 이 기준선보다 근거 정확도, 단계 정확도 또는 설명 가능성에서 개선되는지 확인하기 위한 비교 대상이다.

```powershell
cd backend/worker
npm run build
node dist/experiments/ncs-evaluation/baseline/run.js `
  --dataset ../../docs/04_implementation/ncs-evaluation-m0/golden-cases.json `
  --output src/experiments/ncs-evaluation/baseline/results.json `
  --runs 5
node ../../scripts/verify-ncs-evaluation-m0.mjs `
  --results src/experiments/ncs-evaluation/baseline/results.json
```
