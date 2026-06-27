# Scripts AGENTS

개발, 검증, 문서 생성 보조 스크립트 영역이다.

## Cross-platform Harness

- Windows: `powershell -ExecutionPolicy Bypass -File scripts\check-local.ps1 -Role A`
- macOS/Linux: `bash scripts/check-local.sh -Role A`
- macOS/Linux hook 설치: `bash scripts/install-hooks.sh -Role A`

## Rules

- destructive command를 기본 동작으로 두지 않는다.
- Windows 경로, UTF-8 출력, macOS/Linux의 `/` 경로를 모두 고려한다.
- Windows harness는 Windows PowerShell 5.1에서 동작하게 작성한다.
- macOS/Linux harness는 PowerShell Core 설치 없이 bash로 바로 동작하게 작성한다.
- macOS/Linux 문서 명령은 실행 권한에 의존하지 않도록 `bash scripts/*.sh` 형식을 우선한다.
- 스크립트는 실행 방법과 필요한 환경변수를 주석 또는 README에 남긴다.
- CI에서 사용하는 스크립트는 A와 PM 리뷰를 받는다.
