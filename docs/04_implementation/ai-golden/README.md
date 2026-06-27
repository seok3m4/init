# AI Golden Harness

이 폴더는 AI worker의 mock/golden 테스트 케이스를 보관한다.

각 JSON 파일은 다음 구조를 따른다.

```json
{
  "input": {
    "type": "REPORT_GENERATE",
    "payload": {}
  },
  "expected": {
    "outputShape": {
      "summary": "string",
      "scores": "array",
      "evidences": "array"
    }
  }
}
```

`scripts/verify-ai-golden.ps1`는 실제 OpenAI API를 호출하지 않고 케이스 파일의 구조만 검증한다. 실제 worker가 구현되면 이 golden case를 worker test fixture로 연결한다.

