# AI Golden Cases

AI report/pipeline 회귀 검증용 golden case를 둔다.

각 JSON 파일은 최소한 아래 shape을 가진다.

```json
{
  "name": "case name",
  "input": {},
  "expected": {
    "outputShape": {}
  }
}
```

`scripts/verify-ai-golden.ps1`은 JSON parse 가능 여부와 `input`, `expected`, `expected.outputShape` 존재 여부를 확인한다.
