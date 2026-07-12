# NCS Evaluation Holdout V1

`holdout-cases.json`은 M0의 48개 합성 fixture와 분리한 평가기 일반화 회귀 세트다.

## Coverage

- 문장부호가 사라진 STT transcript
- DB, SQL, 색인 등 기존 표현의 동의어
- 정상적인 자기 정정과 실제 행동 부정의 구분
- filler-only, 무관 답변, 결과만 전달받은 답변
- 민감·비언어 정보 없이 발화 내용만 평가

## Policy

- evaluator에는 `caseId`, `tags`, `expected`를 전달하지 않는다.
- M0 golden case ID와 중복을 허용하지 않는다.
- exact status, level, score와 transcript quote offset을 검사한다.
- holdout을 보고 규칙을 수정한 이후 이 파일은 회귀 세트가 된다. 실제 사용자 calibration에는 별도의 비공개 표본을 추가해야 한다.

## Validation

```powershell
Set-Location backend/worker
npm test
```

`evidence-state/holdout.test.ts`가 이 파일을 읽어 검증한다.
