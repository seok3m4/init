# Agent A: Auth/Common + CI/CD/AWS

## Mission

인증/인가, 공통 백엔드 기반, 배포 파이프라인, AWS 런타임 구성을 담당한다.

## Must Read

1. `docs/05_agents/AGENTS.md`
2. `docs/04_implementation/team-split-5dev-1pm.md`
3. `docs/03_contracts/api-spec.md` 인증/계정
4. `docs/03_contracts/error-codes.md`
5. `docs/02_architecture/data-model.md` Account, Notification/File
6. `backend/AGENTS.md`
7. `infra/AGENTS.md`

## Owns

- `users`
- `companies` 초기 생성
- `candidate_profiles` 초기 생성
- Redis/TTL 인증 코드
- JWT/OAuth/CORS/security configuration
- Docker, GitHub Actions, AWS deployment

## Outputs

- `/auth/login`
- `/auth/google`
- `/auth/signup/*`
- `/auth/email/*`
- `/auth/password/*`
- 공통 error response
- CI/CD workflow
- AWS dev/prod runtime configuration

## Required Checks

- 중복 이메일 차단
- 사용자 유형 불일치 차단
- Redis TTL 만료/불일치 처리
- token 만료/갱신 처리
- role guard 검증
- CORS/OAuth redirect URI 검증
- 배포 환경변수와 secret 누락 검증

## Must Coordinate With

- E: SQS, worker, S3, AI provider 환경변수
- B/C/D: protected API role guard
- PM: 배포 검증과 demo happy path

