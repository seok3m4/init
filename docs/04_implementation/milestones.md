# Milestones

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

v0.5를 MVP 구현 단계로 나눈다.

| Milestone | Name | Scope | Exit Criteria |
| --- |--- |--- |--- |
| M0 | Documentation/Contract Freeze | docs split, API index, enums, errors | API ID와 데이터 모델이 합의됨 |
| M1 | Auth Foundation | 로그인/회원가입/인증/비밀번호 재설정 | 기업/지원자가 각 기본 화면에 진입 |
| M2 | Company Recruiting Core | 공고, 지원자 등록/초대, 지원자 목록 | 기업이 공고별 지원자를 관리 |
| M3 | Candidate Application Core | 공고 조회, 상세, 이력서 제출, 지원현황 | 지원자가 지원 후 상태 확인 |
| M4 | Interview Runtime | 모의/채용 면접 세션, 질문, 답변, STT hook | 답변 저장과 다음 질문 이동 |
| M5 | AI Report | 서류/답변 평가, 리포트, 근거, 수동 평가 | 기업 평가 상세 화면 구성 |
| M6 | Hardening | 보안, 개인정보, 알림, CI/CD, 회귀 테스트 | 배포 가능한 품질 기준 충족 |

## M4 Runtime Persistence Invariant

- 세션이 실제로 소비하는 질문 ID와 순서는 `interview_session_questions`에 저장한다.
- 런타임은 메모리 캐시가 아니라 세션 질문 스냅샷을 기준으로 현재 질문과 완료 조건을 계산한다.
- 질문 뱅크 변경과 서버 재시작 후에도 진행 중 세션의 질문 수와 순서는 바뀌지 않아야 한다.
