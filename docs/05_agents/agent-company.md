# Agent Company

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

기업 포털의 공고, 지원자 관리, 평가 상세, 면접 설정, 회사 정보 관리를 담당한다.

## Mission

기업 포털의 공고, 지원자 관리, 평가 상세, 면접 설정, 회사 정보 관리를 담당한다.

## Owns

- postings
- evaluation_criteria
- question_bank
- applications screening fields
- manual_evaluations

## Reads

- 01_product/screen-flow.md 기업 포털
- 03_contracts/api-index.md 기업 도메인
- 02_architecture/erd.md

## Outputs

- /company/dashboard
- /company/recruitments*
- /company/applicants*
- /company/interviews*
- /company/profile*

## Required Checks

- 회사 소유 공고만 접근
- 지원자 등록/초대 상태 전이
- 평가 기준 배점 검증
- 수동 평가 권한 검증
