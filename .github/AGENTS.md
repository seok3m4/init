# GitHub AGENTS

GitHub templates, workflow, project automation 영역이다. A가 1차 소유하고 PM이 검증 기준을 리뷰한다.

## Rules

- workflow 변경은 PR에서 어떤 check가 실행되는지 설명한다.
- 배포 workflow는 secret 이름과 대상 환경을 문서화한다.
- PR template은 테스트/문서 변경 여부를 확인할 수 있어야 한다.
- issue template은 담당자와 도메인을 분류할 수 있어야 한다.

## Issue Template Usage

- Codex가 Issue를 생성하거나 Issue 본문 초안을 작성할 때는 `.github/ISSUE_TEMPLATE`의 템플릿을 그대로 기준으로 삼는다.
- 버그 리포트는 `bug_report.md`를 사용하고, title은 `[BUG] 요약` 형식을 따른다.
- 기능 요청은 `feature_request.md`를 사용하고, title은 `[FEAT] 요약` 형식을 따른다.
- 템플릿의 주석은 최종 본문에 남기지 않는다.
- 확인되지 않은 항목은 비워두지 말고 `미정`, `확인 필요`, `해당 없음` 중 하나로 명시한다.
- 담당 도메인이 분명하면 본문에 `담당 도메인: auth-common/company-recruiting/company-interview-criteria/candidate-application-interview/ai-report-pipeline/infra` 중 하나를 적는다.

## PR Template Usage

- Codex가 PR을 생성하거나 PR 본문 초안을 작성할 때는 `.github/PULL_REQUEST_TEMPLATE.md`를 그대로 기준으로 삼는다.
- `관련 이슈`에는 해결 PR이면 `closes #이슈번호`, 단순 참조이면 `refs #이슈번호`를 적는다.
- `작업 내용`에는 PR 목적과 구현 범위를 2-4문장으로 요약한다.
- `변경 사항` 체크박스는 실제 변경에 해당하는 항목만 `[x]`로 표시한다.
- UI 변경이 없으면 `스크린샷` 항목에는 `해당 없음`을 적는다.
- `체크리스트`는 실제 수행한 항목만 `[x]`로 표시하고, 수행하지 못한 항목은 `[ ]`로 둔 뒤 이유를 적는다.
- `리뷰어에게`에는 집중해서 봐야 할 파일, API 계약, 상태 전이, 테스트 공백을 적는다.

## Convention Fit

- 현재 Issue/PR 양식은 `.github/ISSUE_TEMPLATE`와 `.github/PULL_REQUEST_TEMPLATE.md`를 사용하는 GitHub template convention에 가깝다.
- Commit message는 `[BUG]`, `[FEAT]`, 변경 유형 체크박스와 자연스럽게 매핑되도록 Angular convention 기반 Conventional Commits를 사용한다.

## Commit Message Convention

- 상세 규칙은 `docs/04_implementation/commit-convention.md`를 따른다.
- 기본 형식은 `<type>(<scope>): <subject>`이다.
- scope가 불명확하거나 전역 변경이면 `<type>: <subject>`를 사용한다.
- 허용 type은 `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`, `ci`, `perf`, `style`이다.
- Issue `[FEAT]` 또는 기능 추가 PR은 보통 `feat`를 사용한다.
- Issue `[BUG]` 또는 버그 수정 PR은 보통 `fix`를 사용한다.
- PR 변경 사항이 `문서 수정`이면 `docs`, `리팩토링`이면 `refactor`, GitHub Actions 변경이면 `ci`를 우선한다.
- subject는 짧고 구체적으로 쓰며 마침표를 붙이지 않는다.
- commit 내용이 1-2개면 title 한 줄만 작성해도 된다.
- commit 내용이 3개 이상이면 반드시 title과 content(body)를 함께 작성한다.
- body는 title 다음 빈 줄을 두고 bullet list로 작성한다.
- 관련 Issue가 있으면 body 마지막에 `Refs #이슈번호` 또는 `Closes #이슈번호`를 적는다.

### Commit Message Examples

```text
docs(github): Issue와 PR 작성 규칙 추가
```

```text
feat(company-recruiting): 지원자 초대 메일 발송 흐름 추가

- 지원자 등록 후 초대 메일 발송 API를 연결
- 응시 시작일과 종료일 검증을 추가
- 초대 발송 실패 시 notifications 상태를 FAILED로 기록

Closes #24
```
