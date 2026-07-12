# NCS Evaluation M2 Current Comparison

- Status: `READY_FOR_DECISION`
- Experimental candidates passing hard gates: 4
- Provisional leader: `evidence-state`
- Recommended strategy: `evidence-state`

| Rank | Strategy | Hard gate | Exact level | Quote coverage | Follow-up | Repeatability | p95 latency | Avg. cost |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | evidence-state | PASS | 100.00% | 100.00% | 100.00% | 100.00% | 0.75ms | $0.000000 |
| 2 | baseline-deterministic | PASS | 100.00% | 97.89% | 100.00% | 100.00% | 0.24ms | $0.000000 |
| 3 | hybrid-evidence-anchor-deterministic | PASS | 98.04% | 97.89% | 100.00% | 100.00% | 0.37ms | $0.000000 |
| 4 | common-rubric-deterministic | PASS | 96.08% | 100.00% | 100.00% | 100.00% | 0.91ms | $0.000000 |
| 5 | pairwise-anchor-deterministic | PASS | 96.08% | 98.95% | 100.00% | 100.00% | 0.32ms | $0.000000 |

## Decision Rule

Hard gate를 통과한 전략만 정확 단계, 근거 인용, 꼬리질문, 반복성, latency, 비용 순으로 비교한다. 실험 전략이 두 개 이상 통과하기 전에는 최종 채택하지 않는다.
