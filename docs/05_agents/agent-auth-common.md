# Agent Auth Common

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

공통 인증, 계정 생성, 이메일 인증, 비밀번호 재설정을 담당한다.

## Mission

공통 인증, 계정 생성, 이메일 인증, 비밀번호 재설정을 담당한다.

## Owns

- users
- companies 초기 생성
- candidate_profiles 초기 생성
- Redis/TTL 인증 코드

## Reads

- 03_contracts/api-spec.md 인증/계정
- 02_architecture/data-model.md Account

## Outputs

- /auth/login
- /auth/google
- /auth/signup/*
- /auth/email/*
- /auth/password/*

## Required Checks

- 중복 이메일 차단
- 사용자 유형 불일치 차단
- Redis TTL 만료/불일치 처리
- 토큰 만료 처리
