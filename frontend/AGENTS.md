# Frontend AGENTS

React + Next.js + TypeScript 웹 애플리케이션 영역이다. B/C/D가 주로 작업하고, A는 인증 연동과 배포 환경을 리뷰한다.

## Structure

- `src/app`: Next.js App Router, app shell, layout
- `src/api`: API client, request/response adapters
- `src/features`: 도메인별 화면과 상태
- `src/components`: 재사용 UI component
- `src/shared`: 공통 util, hooks, constants
- `src/styles`: global style, design token mapping
- `public`: 정적 public asset. 배포 시 CloudFront/S3 캐시 정책을 고려한다.

## Rules

- 화면 구현 전 `design.md`와 `docs/01_product`를 확인한다.
- API 호출 전 `docs/03_contracts/api-spec.md`의 API ID를 확인한다.
- 인증 토큰 처리와 401/403 처리는 A와 합의한 공통 client를 사용한다.
- 서버 컴포넌트/클라이언트 컴포넌트 경계는 명시하고, 브라우저 API는 client component에서만 사용한다.
- 기업 화면은 B/C 소유 도메인을 넘나들 때 담당자 리뷰를 받는다.
- 지원자 화면은 내부 평가 점수와 기업 메모를 노출하지 않는다.
