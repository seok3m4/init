# Infra AGENTS

Docker, AWS, DB migration, local infra 영역이다. A가 1차 소유하고 E가 SQS/worker/S3/AI 환경을 함께 검증한다.

## Structure

- `aws`: AWS 배포 구성 초안
- `docker`: Dockerfile, compose, container 관련 파일
- `db/migrations`: Prisma/PostgreSQL migration
- `db/seeds`: local/dev seed data
- `local`: 로컬 개발 인프라 보조 구성

## ERD And Migration Boundary

- `docs/02_architecture/erdcloud/*.sql`은 ERDCloud import와 설계 검토용이다.
- `infra/db/migrations`만 실제 애플리케이션 DB에 실행하는 migration으로 취급한다.
- ERDCloud SQL을 migration으로 복사하기 전에 PostgreSQL 실행 기준을 별도로 확정한다.
- 실제 migration에는 PK 생성 전략, index, check constraint, timestamp default, rollback/재실행 가능성을 검토한다.

## Rules

- secret은 git에 커밋하지 않는다.
- 배포 환경변수 목록은 문서화한다.
- API 서버와 worker는 독립적으로 배포/재시작 가능해야 한다.
- ECR, ECS, CloudFront, RDS/PostgreSQL, Redis, S3, SQS 연결 정보를 환경변수로 분리한다.
- health check endpoint와 배포 후 smoke test를 유지한다.
