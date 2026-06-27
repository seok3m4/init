# Agent CI/CD

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

빌드, 테스트, 계약 검증, 배포 준비를 담당한다.

## Mission

빌드, 테스트, 계약 검증, 배포 준비를 담당한다.

## Owns

- CI workflow
- 계약 검증 스크립트
- 테스트 실행 정책
- 릴리즈 체크리스트

## Reads

- 03_contracts/*
- 04_implementation/test-strategy.md
- 04_implementation/milestones.md

## Outputs

- PR 검증 결과
- 빌드/테스트 실패 원인
- 배포 가능 여부

## Required Checks

- API index와 구현 라우트 일치
- enum/error code 스냅샷 검증
- 핵심 E2E 통과
