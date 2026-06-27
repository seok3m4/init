# Agent B: Company Recruiting

## Mission

기업 공고, 공고 상세, 지원자 등록/CSV, 초대 메일, 전형 상태를 담당한다.

## Must Read

1. `docs/05_agents/AGENTS.md`
2. `docs/04_implementation/team-split-5dev-1pm.md`
3. `docs/01_product/feature-spec.md` 기업 공고/지원자 영역
4. `docs/01_product/screen-flow.md` 기업 포털
5. `docs/03_contracts/api-spec.md` 기업 - 채용공고, 기업 - 지원자/리포트
6. `docs/02_architecture/data-model.md` Recruiting, Application, Notification/File
7. `frontend/AGENTS.md`
8. `backend/api/AGENTS.md`

## Owns

- `postings`
- `applications` 기업 전형 판정 필드
- `notifications` 초대/안내 메일 흐름

## Outputs

- `/company/dashboard`
- `/company/recruitments`
- `/company/recruitments/{recruitmentId}`
- `/company/recruitments/{recruitmentId}/applicants`
- `/company/applicants`
- `/company/applicants/invitations`
- `/company/applicants/{applicantId}/screening-status`

## Required Checks

- 기업은 자기 회사 공고/지원자만 접근
- 중복 지원자/중복 초대 처리
- 지원자 등록/초대 상태 전이
- 전형 판정 권한 검증

## Must Coordinate With

- D: `applications` 지원자 제출/응시 상태
- E: report 상태와 지원자 평가 요약
- A: 기업 role guard, 메일/배포 환경변수

