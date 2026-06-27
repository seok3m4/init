# Commit Convention

이 프로젝트의 commit message는 Angular convention 기반의 Conventional Commits를 사용한다.

## 기본 형식

```text
<type>(<scope>): <subject>
```

scope가 불명확하거나 전역 변경이면 scope를 생략한다.

```text
<type>: <subject>
```

## Type

| Type | 사용 기준 | 예 |
| --- | --- | --- |
| `feat` | 사용자 기능 또는 API 기능 추가 | `feat(auth): 이메일 인증 코드 검증 추가` |
| `fix` | 버그 수정, 잘못된 동작 수정 | `fix(candidate): 면접 답변 업로드 상태 전이 수정` |
| `refactor` | 동작 변경 없는 구조 개선 | `refactor(api): 공통 응답 매핑 분리` |
| `docs` | 문서 추가/수정 | `docs(agents): B 담당 운영 규칙 추가` |
| `test` | 테스트 추가/수정 | `test(company): 지원자 초대 중복 테스트 추가` |
| `chore` | 코드 동작과 무관한 유지보수 | `chore(repo): gitignore 정리` |
| `build` | 빌드, 패키지, Docker 설정 | `build(docker): 로컬 compose 구성 추가` |
| `ci` | GitHub Actions, 검증 자동화 | `ci(harness): macOS 검증 job 추가` |
| `perf` | 성능 개선 | `perf(report): 리포트 조회 쿼리 최적화` |
| `style` | 포맷, 공백, 세미콜론 등 동작 변경 없는 스타일 | `style(frontend): import 정렬` |

## Scope

scope는 변경 대상의 도메인이나 폴더를 짧게 적는다.

| Scope | 대상 |
| --- | --- |
| `auth` | 인증/인가, 회원가입, 로그인 |
| `company-recruiting` | 기업 공고, 지원자 등록/초대, 전형 상태 |
| `company-interview` | 면접 설정, 평가 기준, 질문 뱅크 |
| `candidate` | 지원자 공고 조회, 지원서, 면접 진행 |
| `ai-report` | AI 처리, 리포트, 가드레일, 임베딩 |
| `api` | NestJS API 공통 |
| `worker` | AI/SQS worker |
| `common` | 공통 타입, enum, error, validation |
| `frontend` | Next.js 앱 공통 |
| `infra` | Docker, AWS, DB migration, local infra |
| `docs` | 문서 전반 |
| `github` | Issue/PR template, GitHub Actions |
| `scripts` | 로컬 검증/자동화 스크립트 |

둘 이상의 scope가 강하게 걸리면 가장 중요한 소유 영역을 고른다. 너무 넓으면 scope를 생략하고 body에 변경 범위를 적는다.

## Subject

- 명령형 현재 시제로 쓴다.
- 한국어 또는 영어를 사용할 수 있다.
- 짧고 구체적으로 쓴다.
- 끝에 마침표를 붙이지 않는다.
- 모호한 표현을 피한다.

좋은 예:

```text
feat(company-recruiting): 지원자 초대 메일 발송 흐름 추가
docs(scripts): macOS harness 실행 기준 정리
ci(github): PR 검증 workflow 추가
```

나쁜 예:

```text
fix: 수정
update files
작업함.
```

## Body

변경 내용이 1-2개면 title 한 줄만 써도 된다.

변경 내용이 3개 이상이거나 리뷰어가 맥락을 알아야 하면 title 다음 빈 줄을 두고 body를 작성한다.

```text
fix(candidate): 면접 답변 업로드 상태 전이 수정

- 답변 파일 업로드 성공 시 interview_status를 COMPLETED로 갱신
- 업로드 실패 시 ai_process_logs에 FAILED 상태 기록
- 지원현황 화면에서 실패 사유를 조회할 수 있도록 응답 필드 정리

Closes #12
```

## Issue Reference

관련 Issue가 있으면 body 마지막에 적는다.

```text
Refs #12
```

Issue를 해결하는 commit이면 아래를 사용한다.

```text
Closes #12
```

## Breaking Change

API 계약, DB schema, enum, error code처럼 기존 구현과 호환되지 않는 변경은 body에 `BREAKING CHANGE:`를 명시한다.

```text
feat(api): 지원자 상태 enum 분리

BREAKING CHANGE: application_status에서 interview 진행 상태를 분리하고 interview_status를 사용한다.

Refs #24
```

## 권장 작성 순서

1. 변경 파일을 확인한다.
2. 변경 목적에 맞는 `type`을 고른다.
3. 가장 영향이 큰 도메인을 `scope`로 고른다.
4. title을 한 줄로 작성한다.
5. 변경이 여러 개면 body에 bullet list를 추가한다.
6. 관련 Issue가 있으면 마지막에 `Refs` 또는 `Closes`를 적는다.
