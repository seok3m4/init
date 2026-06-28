# API Spec

> Source: `init/docs/00_source` 기준. Generated at 2026-06-27.

AI와 구현 에이전트가 바로 읽을 수 있는 상세 API 명세다.

## Common Contract

- Base URL: `/api/v1`
- Success: `{ "data": ..., "meta": { "traceId": "...", "timestamp": "ISO-8601" } }`
- Error: `{ "error": { "code": "STRING", "message": "사용자 표시 메시지", "details": [] } }`
- Auth: 공개 API를 제외하고 `Authorization: Bearer {accessToken}`

## 인증/계정

### API-001 POST /auth/login
- 도메인: 인증/계정
- 권한/인증: 비로그인 허용
- 관련 화면: 로그인 화면 (/login)
- UI Type: form, button
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 이메일, 비밀번호
  - 사용자 유형, 이메일, 비밀번호
- 검증/전제조건:
  - 등록된 계정 정보와 일치
  - 사용자 유형 선택 및 계정 정보 일치
- 성공 응답/처리:
  - 로그인 버튼 클릭 가능
  - 기업은 지원현황 > 공고 관리로 이동, 지원자는 AI 모의면접 > 면접시작으로 이동
- 오류/예외:
  - 계정 정보 불일치, 비활성 계정, 사용자 유형 불일치 시 로그인 실패 메시지를 표시한다.
  - 계정 정보 불일치, 비활성 계정, 권한 불일치, 서버 오류 시 로그인 실패 메시지를 표시한다.
- 관련 ERD 테이블:
  - users, companies, candidate_profiles, postings, applications, interview_sessions, notifications, ai_process_logs
- 비고/미결:
  - ID/PW 찾기·회원가입 링크는 비밀번호 입력란 바로 아래 배치
  - 기업 기본 진입: /company/applications/dashboard, 지원자 기본 진입: /candidate/mock-interview/start

### API-002 GET /auth/google
- 도메인: 인증/계정
- 권한/인증: 비로그인 허용
- 관련 화면: 로그인 화면 (/login)
- UI Type: button
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - Google 계정 정보, 사용자 유형
- 검증/전제조건:
  - Google OAuth 인증 성공 및 계정 연동 성공
- 성공 응답/처리:
  - 기업은 지원현황 > 공고 관리로 이동, 지원자는 AI 모의면접 > 면접시작으로 이동
- 오류/예외:
  - OAuth 인증 실패, 계정 연동 실패, 권한 거부 시 로그인 실패 메시지를 표시한다.
- 관련 ERD 테이블:
  - users, companies, candidate_profiles, postings, applications, interview_sessions, notifications, ai_process_logs
- 비고/미결:
  - 이메일 회원가입과 달리 별도 이메일 인증 입력 단계는 적용하지 않음

### API-003 POST /auth/signup/candidate
- 도메인: 인증/계정
- 권한/인증: 비로그인 허용
- 관련 화면: 지원자 회원가입 화면 (/signup/candidate)
- UI Type: form
- 상태 코드: 201 Created
- 비동기: N
- 요청 데이터:
  - 이메일, 인증 코드, 비밀번호, 비밀번호 확인, 이름, 약관 동의
- 검증/전제조건:
  - 이메일 형식, 이메일 인증 완료, 비밀번호 정책, 비밀번호 확인 일치, 필수 약관 동의 충족
- 성공 응답/처리:
  - 지원자 계정 생성 후 로그인 화면 또는 지원자 포털 > AI 모의면접 > 면접시작으로 이동
- 오류/예외:
  - 중복 이메일, 이메일 인증 실패, 인증 코드 만료, 약관 미동의, 비밀번호 정책 미충족, 비밀번호 불일치 시 오류 메시지를 표시한다.
- 관련 ERD 테이블:
  - users, candidate_profiles, applications, consent_records, interview_sessions, notifications, ai_process_logs
- 비고/미결:
  - 이메일 회원가입은 이메일 인증 필수

### API-004 POST /auth/email/send-code
- 도메인: 인증/계정
- 권한/인증: 비로그인 허용
- 관련 화면: 지원자 회원가입 화면 (/signup/candidate)
기업 회원가입 화면 (/signup/company)
- UI Type: button
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 이메일
- 검증/전제조건:
  - 이메일 형식이 유효해야 함
- 성공 응답/처리:
  - 인증 코드 입력 영역 활성화
- 오류/예외:
  - 이미 가입된 이메일, 이메일 형식 오류, 메일 발송 실패 시 오류 메시지를 표시한다.
- 관련 ERD 테이블:
  - users, companies, candidate_profiles, applications, notifications, ai_process_logs, Redis/TTL cache
- 비고/미결:
  - 우선 이메일 인증만 구현

### API-005 POST /auth/email/verify-code
- 도메인: 인증/계정
- 권한/인증: 비로그인 허용
- 관련 화면: 지원자 회원가입 화면 (/signup/candidate)
기업 회원가입 화면 (/signup/company)
- UI Type: button
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 이메일, 인증 코드
- 검증/전제조건:
  - 인증 코드가 유효하고 만료되지 않아야 함
- 성공 응답/처리:
  - 이메일 인증 완료 상태로 전환
- 오류/예외:
  - 코드 불일치, 인증 만료, 재시도 횟수 초과 시 오류 메시지를 표시한다.
- 관련 ERD 테이블:
  - users, companies, candidate_profiles, applications, notifications, ai_process_logs, Redis/TTL cache

### API-006 POST /auth/signup/company
- 도메인: 인증/계정
- 권한/인증: 비로그인 허용
- 관련 화면: 기업 회원가입 화면 (/signup/company)
- UI Type: form
- 상태 코드: 201 Created
- 비동기: N
- 요청 데이터:
  - 이메일, 인증 코드, 비밀번호, 비밀번호 확인, 이름, 회사명, 약관 동의
- 검증/전제조건:
  - 이메일 형식, 이메일 인증 완료, 비밀번호 정책, 비밀번호 확인 일치, 회사명 입력, 필수 약관 동의 충족
- 성공 응답/처리:
  - 기업 계정 생성 후 로그인 화면 또는 기업 포털 > 지원현황 > 공고 관리로 이동
- 오류/예외:
  - 중복 이메일, 이메일 인증 실패, 인증 코드 만료, 약관 미동의, 비밀번호 정책 미충족, 비밀번호 불일치, 회사명 누락 시 오류 메시지를 표시한다.
- 관련 ERD 테이블:
  - users, companies, postings, applications, consent_records, notifications, ai_process_logs
- 비고/미결:
  - 기업 전용 필드 확정 필요

### API-007 POST /auth/password/reset
- 도메인: 인증/계정
- 권한/인증: 비로그인 허용
- 관련 화면: 비밀번호 재설정 화면 (/password/reset)
- UI Type: form
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 이메일, 인증 코드, 새 비밀번호, 새 비밀번호 확인
- 검증/전제조건:
  - 가입된 이메일, 인증 코드 유효, 새 비밀번호 정책 충족, 새 비밀번호 확인 일치
- 성공 응답/처리:
  - 비밀번호 재설정 완료 후 로그인 화면으로 이동
- 오류/예외:
  - 인증 만료, 코드 불일치, 미가입 이메일, 비밀번호 정책 미충족, 비밀번호 불일치 시 오류 메시지를 표시한다.
- 관련 ERD 테이블:
  - users, notifications

### API-008 POST /auth/password/send-code
- 도메인: 인증/계정
- 권한/인증: 비로그인 허용
- 관련 화면: 비밀번호 재설정 화면 (/password/reset)
- UI Type: button
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 이메일
- 검증/전제조건:
  - 가입된 이메일이어야 함
- 성공 응답/처리:
  - 인증 코드 입력 영역 활성화
- 오류/예외:
  - 미가입 이메일, 발송 실패, 요청 횟수 초과 시 오류 메시지를 표시한다.
- 관련 ERD 테이블:
  - users, notifications, Redis/TTL cache

### API-009 POST /auth/password/verify-code
- 도메인: 인증/계정
- 권한/인증: 비로그인 허용
- 관련 화면: 비밀번호 재설정 화면 (/password/reset)
- UI Type: button
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 이메일, 인증 코드
- 검증/전제조건:
  - 인증 코드가 유효하고 만료되지 않아야 함
- 성공 응답/처리:
  - 새 비밀번호 입력 영역 활성화
- 오류/예외:
  - 코드 불일치, 인증 만료, 재시도 횟수 초과 시 오류 메시지를 표시한다.
- 관련 ERD 테이블:
  - users, notifications, Redis/TTL cache

## 기업 - 대시보드

### API-010 GET /company/dashboard
- 도메인: 기업 - 대시보드
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 공고 관리 화면 (/company/applications/dashboard)
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 회사 ID
- 검증/전제조건:
  - 관리자 권한 보유
- 성공 응답/처리:
  - 공고 목록과 공고별 운영 지표 표시
- 오류/예외:
  - 조회 데이터가 없으면 빈 상태와 공고 생성 CTA를 제공한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - 기존 SNB 삭제. 2-depth는 GNB hover dropdown으로 노출. 기존 관리자 대시보드 명칭을 공고 관리로 변경

## 기업 - 채용공고

### API-011 GET /company/recruitments
- 도메인: 기업 - 채용공고
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 공고 관리 화면 (/company/applications/dashboard)
채용 공고 관리 화면 (/company/recruitments)
- UI Type: list, page
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 회사 ID
  - 검색어, 상태, 정렬 기준
  - 공고 ID
- 검증/전제조건:
  - 관리자 권한 보유
  - 기업 관리자 권한 보유
- 성공 응답/처리:
  - 공고 목록 표시 및 공고 상세 이동 가능
  - 채용 공고 목록 표시
  - 공고 리스트 표시 및 공고 상세/수정/복사 가능
- 오류/예외:
  - 공고가 없으면 공고 생성 안내를 표시한다.
  - 공고가 없으면 빈 상태와 공고 생성 CTA를 표시한다.
  - 공고 조회 실패 시 오류 안내를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, interview_sessions, evaluation_reports, report_scores, report_evidences, ai_process_logs, embeddings
- 비고/미결:
  - 검색필터(프로젝트, 기간, 상태, 조회) 삭제
  - 첨부 이미지 기준 리스트형 레이아웃으로 변경
  - grid/table이 아니라 첨부 이미지처럼 가로형 리스트 카드로 표시

### API-013 GET /company/recruitments/{recruitmentId}
- 도메인: 기업 - 채용공고
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 공고 세부내용 화면 (/company/recruitments/{recruitmentId})
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- Path Params: recruitmentId
- 요청 데이터:
  - 공고 ID
- 검증/전제조건:
  - 공고 조회 권한 보유
- 성공 응답/처리:
  - 공고 세부내용 표시
- 오류/예외:
  - 공고가 삭제되었거나 권한이 없으면 접근 제한 메시지를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications
- 비고/미결:
  - 공고가 상위 개념이고 지원자 관리는 이 화면의 하위 흐름으로 구성

### API-014 GET /company/recruitments/{recruitmentId}/applicants
- 도메인: 기업 - 채용공고
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 관리 화면 (/company/recruitments/{recruitmentId}/applicants)
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- Path Params: recruitmentId
- 요청 데이터:
  - 공고 ID
- 검증/전제조건:
  - 공고 조회 권한 보유
- 성공 응답/처리:
  - 공고별 지원자 관리 화면 표시
- 오류/예외:
  - 공고 정보가 없거나 권한이 없으면 접근 제한 메시지를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, evaluation_reports, report_scores, report_evidences, notifications
- 비고/미결:
  - 기존 구직자 관리 명칭을 지원자 관리로 변경. 평가 리포트 메뉴는 지원자 관리로 통합

### API-032 GET /company/recruitments?keyword={keyword}&status={status}
- 도메인: 기업 - 채용공고
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 채용 공고 관리 화면 (/company/recruitments)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: keyword, status
- Query Params: keyword, status
- 요청 데이터:
  - 검색어, 상태
- 검증/전제조건:
  - 유효한 검색 조건
- 성공 응답/처리:
  - 검색 조건에 맞는 공고 목록 갱신
- 오류/예외:
  - 검색 결과가 없으면 빈 상태 안내를 표시한다.
- 관련 ERD 테이블:
  - companies, postings, embeddings
- 비고/미결:
  - 검색어 placeholder: 프로젝트명, 직무명 검색

### API-033 POST /company/recruitments/{recruitmentId}/copy
- 도메인: 기업 - 채용공고
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 채용 공고 관리 화면 (/company/recruitments)
- UI Type: button
- 상태 코드: 200 OK
- 비동기: N
- Path Params: recruitmentId
- 요청 데이터:
  - 공고 ID
- 검증/전제조건:
  - 마감 상태의 공고
- 성공 응답/처리:
  - 복사된 공고 생성 화면으로 이동
- 오류/예외:
  - 복사 실패 시 오류 메시지를 표시한다.
- 관련 ERD 테이블:
  - companies, postings, ai_process_logs
- 비고/미결:
  - 마감 상태에서 수정 버튼 대신 노출

## 기업 - 지원자/리포트

### API-012 PATCH /company/applicants/{applicantId}/screening-status
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 공고 관리 화면 (/company/applications/dashboard)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: applicantId
- 요청 데이터:
  - 지원자 ID, 합격/탈락/보류 상태, 메모, 판정 필터
- 검증/전제조건:
  - 평가 리포트 완료 상태, 관리자 권한 보유
- 성공 응답/처리:
  - 편집 모드에서 전형 상태 저장
- 오류/예외:
  - 상태 미지정 지원자가 있으면 저장 전 확인 메시지를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, evaluation_reports, report_scores, report_evidences, manual_evaluations
- 비고/미결:
  - 우측 상단 기본 버튼은 편집. 편집 클릭 시 상태 저장으로 toggle

### API-015 POST /company/applicants
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 관리 화면 (/company/recruitments/{recruitmentId}/applicants)
- UI Type: form
- 상태 코드: 201 Created
- 비동기: N
- 요청 데이터:
  - 이름, 이메일, 지원 직무, 연락처
- 검증/전제조건:
  - 이메일 형식이 유효해야 함
- 성공 응답/처리:
  - 지원자 등록 완료
- 오류/예외:
  - 중복 지원자, 파일 형식 오류, 필수값 누락 시 오류 내용을 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, file_assets, postings, applications, notifications
- 비고/미결:
  - CSV 일괄 등록 상세 정책 추가 검토 필요

### API-016 POST /company/applicants/invitations
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 관리 화면 (/company/recruitments/{recruitmentId}/applicants)
- UI Type: button
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 지원자 이메일, 응시 기간, 안내 메시지
- 검증/전제조건:
  - 채용 공고와 지원자 정보가 존재
- 성공 응답/처리:
  - 초대 링크 발송 완료
- 오류/예외:
  - 메일 발송 실패, 만료된 공고, 면접 세션 생성 실패 시 재발송 안내를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, application_documents, interview_sessions, notifications, ai_process_logs
- 비고/미결:
  - interviewType=RECRUITING

### API-018 GET /company/applicants
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 관리 화면 (/company/recruitments/{recruitmentId}/applicants)
- UI Type: list
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 공고, 상태 필터, 검색어
- 검증/전제조건:
  - 조회 권한 보유
- 성공 응답/처리:
  - 지원자 목록 표시
- 오류/예외:
  - 데이터가 없으면 빈 상태 안내를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, application_documents, interview_sessions, evaluation_reports, report_scores, report_evidences, ai_process_logs, embeddings
- 비고/미결:
  - 기존 구직자 진행 상태 목록을 지원자 목록으로 변경

### API-019 GET /company/reports
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 관리 화면 (/company/recruitments/{recruitmentId}/applicants)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 공고, 지원자 ID, 리포트 상태
- 검증/전제조건:
  - 조회 권한 보유
- 성공 응답/처리:
  - 리포트 요약 표시 및 평가 상세 이동 가능
- 오류/예외:
  - 리포트가 없으면 분석 대기 또는 미응시 상태를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, application_documents, interview_sessions, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - 기존 평가 리포트 SNB 메뉴를 지원자 관리 내부로 통합

### API-020 GET /company/applicants/{applicantId}/evaluation
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- Path Params: applicantId
- 요청 데이터:
  - 지원자 ID, 공고 ID
- 검증/전제조건:
  - 지원자 조회 권한 보유
- 성공 응답/처리:
  - 지원자 평가 상세 표시
- 오류/예외:
  - 평가 데이터가 없으면 분석 대기 또는 미응시 상태를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, application_documents, interview_sessions, evaluation_reports, report_scores, report_evidences, manual_evaluations, ai_process_logs
- 비고/미결:
  - 기존 9번 서류 평가 상세과 10번 채용 리포트 상세을 9번으로 통합

### API-021 GET /company/applicants/{applicantId}/document-evaluation
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: applicantId
- 요청 데이터:
  - 평가 결과, 근거 문장
- 검증/전제조건:
  - 서류 평가 완료 상태
- 성공 응답/처리:
  - 평가 근거 표시
- 오류/예외:
  - 근거가 불충분하면 낮은 신뢰도 표시와 함께 수동 검토를 요청한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, file_assets, postings, applications, application_documents, evaluation_reports, report_scores, report_evidences, manual_evaluations

### API-022 GET /company/reports/{reportId}
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: reportId
- 요청 데이터:
  - 지원자 ID, 평가 기준
- 검증/전제조건:
  - 평가 완료 상태
- 성공 응답/처리:
  - 역량별 점수 표시
- 오류/예외:
  - 일부 평가 항목이 누락되면 미평가 사유를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, criterion_tags, evaluation_criteria, applications, interview_sessions, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - reportType=RECRUITING_REPORT

### API-023 GET /company/reports/{reportId}/evidence
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: reportId
- 요청 데이터:
  - 평가 결과, 근거 데이터
- 검증/전제조건:
  - 근거 데이터 존재
- 성공 응답/처리:
  - 평가 근거 표시
- 오류/예외:
  - 근거가 부족하면 신뢰도 낮음 배지를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, application_documents, interview_answers, evaluation_reports, report_scores, report_evidences, ai_process_logs

### API-024 GET /company/reports/{reportId}/media
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: reportId
- 요청 데이터:
  - 영상 파일, 스크립트
- 검증/전제조건:
  - 영상 저장 및 STT 처리 완료
- 성공 응답/처리:
  - 영상과 스크립트 동시 표시
- 오류/예외:
  - 영상 재생 실패 시 스크립트만 표시하고 재처리 요청을 제공한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, file_assets, postings, applications, interview_answers, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - 문제별 타임스탬프 기능 추가 여부 검토 필요

### API-025 GET /company/applicants/compare
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 공고, 지원자 목록, 평가 항목
- 검증/전제조건:
  - 동일 기준으로 평가된 지원자 2명 이상
- 성공 응답/처리:
  - 지원자 비교 결과 표시
- 오류/예외:
  - 비교 대상이 부족하면 비교 기능을 비활성화한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, criterion_tags, evaluation_criteria, applications, evaluation_reports, report_scores, report_evidences

### API-026 PATCH /company/applicants/{applicantId}/manual-evaluation
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: form
- 상태 코드: 200 OK
- 비동기: N
- Path Params: applicantId
- 요청 데이터:
  - 수동 점수, 메모, 최종 상태
- 검증/전제조건:
  - 면접관 또는 관리자 권한 보유
- 성공 응답/처리:
  - 수동 평가 저장
- 오류/예외:
  - 권한 없음 또는 필수 메모 누락 시 저장을 제한한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, interview_sessions, evaluation_reports, report_scores, report_evidences, manual_evaluations, ai_process_logs

### API-027 GET /company/reports/{reportId}/download
- 도메인: 기업 - 지원자/리포트
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: button
- 상태 코드: 200 OK
- 비동기: N
- Path Params: reportId
- 요청 데이터:
  - 지원자 ID, 파일 형식
- 검증/전제조건:
  - 리포트 생성 완료
- 성공 응답/처리:
  - PDF 또는 Excel 파일 다운로드
- 오류/예외:
  - 파일 생성 실패 시 재시도 버튼을 제공한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, file_assets, postings, applications, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - MVP 후순위

## 기업 - 면접관리

### API-017 POST /company/interview-sessions
- 도메인: 기업 - 면접관리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 관리 화면 (/company/recruitments/{recruitmentId}/applicants)
- UI Type: system process
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 지원자, 공고, 응시 기간, 질문 세트
- 검증/전제조건:
  - 지원자와 질문 세트가 존재
- 성공 응답/처리:
  - 면접 세션 생성 및 초대 링크 연결
- 오류/예외:
  - 기간 오류, 질문 없음, 세션 생성 실패 시 초대 발송을 제한한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, question_bank, applications, interview_sessions, notifications, ai_process_logs
- 비고/미결:
  - 독립 화면 아님. 초대 링크 발송 프로세스와 묶어서 처리

### API-034 GET /company/interviews/settings
- 도메인: 기업 - 면접관리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 면접 관리 화면 (/company/interviews/settings)
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 채용 공고, 평가 기준, 질문 세트, 시간 정책
- 검증/전제조건:
  - 기업 관리자 권한 보유
- 성공 응답/처리:
  - 면접 관리 화면 표시
- 오류/예외:
  - 권한 없음 또는 공고 정보 없음 시 접근 제한 메시지를 표시한다.
- 관련 ERD 테이블:
  - companies, postings, criterion_tags, evaluation_criteria, question_bank, interview_sessions, ai_process_logs
- 비고/미결:
  - 기존 SNB 삭제. 2-depth는 GNB hover dropdown으로 노출

### API-035 POST /company/interviews/evaluation-criteria/suggest
- 도메인: 기업 - 면접관리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 면접 관리 화면 (/company/interviews/settings)
- UI Type: section
- 상태 코드: 202 Accepted
- 비동기: Y
- 요청 데이터:
  - postingId, JD(jobDescription), 인재상(talentProfile), 평가 정책(evaluationPolicy)
- 검증/전제조건:
  - 채용 공고가 생성되어 있어야 하며 JD, 인재상, 평가 정책이 모두 존재해야 함
- 성공 응답/처리:
  - 평가 역량 후보 표시
  - worker 완료 후 GET /ai/jobs/{processLogId}/status의 output.targetTables=["criterion_tags","evaluation_criteria"], output.reviewRequired=true로 검토 대상임을 표시한다.
- 오류/예외:
  - AI 생성 실패 시 기본 역량 템플릿을 제공하고 재시도 버튼을 표시한다.
- 관련 ERD 테이블:
  - companies, postings, criterion_tags, evaluation_criteria, interview_sessions, ai_process_logs, embeddings
- 비고/미결:
  - 태그 추천 세부 정책 확정 필요

### API-036 PATCH /company/interviews/evaluation-criteria
- 도메인: 기업 - 면접관리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 면접 관리 화면 (/company/interviews/settings)
- UI Type: form
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 평가 항목명, 설명, 배점, 기준 점수
- 검증/전제조건:
  - 총 배점 합계가 정책 범위 내여야 함
- 성공 응답/처리:
  - 평가 기준 저장
- 오류/예외:
  - 배점 합계 오류 또는 필수 평가 항목 삭제 시 저장을 제한한다.
- 관련 ERD 테이블:
  - companies, postings, criterion_tags, evaluation_criteria, interview_sessions, evaluation_reports, report_scores, report_evidences, manual_evaluations, ai_process_logs
- 비고/미결:
  - 저장 버튼은 평가 기준 설정 영역 우측 상단 배치

### API-037 POST /company/interviews/questions
- 도메인: 기업 - 면접관리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 면접 관리 화면 (/company/interviews/settings)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 질문 내용, 질문 유형, 평가 역량
- 검증/전제조건:
  - 질문 내용과 평가 역량 필수
- 성공 응답/처리:
  - 질문 저장 및 공고 연결
- 오류/예외:
  - 중복 질문 또는 연결된 평가 항목이 없으면 경고를 표시한다.
- 관련 ERD 테이블:
  - companies, postings, criterion_tags, evaluation_criteria, question_bank, interview_sessions, follow_up_questions
- 비고/미결:
  - 질문 저장 버튼은 질문 뱅크 관리 영역 우측 상단 배치

### API-038 POST /company/interviews/questions/generate
- 도메인: 기업 - 면접관리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 면접 관리 화면 (/company/interviews/settings)
- UI Type: system process
- 상태 코드: 202 Accepted
- 비동기: Y
- 요청 데이터:
  - postingId, JD(jobDescription), 질문 수(questionCount), 평가 역량
- 검증/전제조건:
  - 직무명세서 생성 완료 및 질문 수가 양수여야 함
- 성공 응답/처리:
  - 직무 질문 후보 저장
  - worker 완료 후 GET /ai/jobs/{processLogId}/status의 output.targetTables=["question_bank"], output.reviewRequired=true로 질문 뱅크 저장 전 검토 대상임을 표시한다.
- 오류/예외:
  - 질문 품질 검증 실패 시 재생성 또는 수동 검토를 요청한다.
- 관련 ERD 테이블:
  - companies, postings, criterion_tags, evaluation_criteria, question_bank, applications, interview_sessions, manual_evaluations, ai_process_logs
- 비고/미결:
  - 생성 결과는 질문 뱅크 관리 영역에 표시

### API-039 POST /company/interviews/question-sets
- 도메인: 기업 - 면접관리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 면접 관리 화면 (/company/interviews/settings)
- UI Type: system process
- 상태 코드: 202 Accepted
- 비동기: Y
- 요청 데이터:
  - postingId, 질문 유형(questionTypes), 질문 수(questionCount), 평가 역량(criteria)
- 검증/전제조건:
  - 평가 기준과 질문 유형이 최소 1개 이상 존재하고 질문 수가 양수여야 함
- 성공 응답/처리:
  - 면접 질문 목록 생성 및 세션 연결 가능 상태 전환
  - worker 완료 후 GET /ai/jobs/{processLogId}/status의 output.targetTables=["question_bank"], output.reviewRequired=true로 질문 뱅크 저장 전 검토 대상임을 표시한다.
- 오류/예외:
  - 질문 수 부족 시 AI 생성 또는 수동 추가를 안내한다.
- 관련 ERD 테이블:
  - companies, postings, criterion_tags, evaluation_criteria, question_bank, application_documents, interview_sessions, manual_evaluations, ai_process_logs
- 비고/미결:
  - 질문 뱅크 관리 화면에서 결과 확인

### API-040 PATCH /company/interviews/time-policy
- 도메인: 기업 - 면접관리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 면접 관리 화면 (/company/interviews/settings)
- UI Type: form
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 준비 시간, 답변 시간, 재응시 허용 여부
- 검증/전제조건:
  - 시간 값이 정책 범위 내여야 함
- 성공 응답/처리:
  - 면접 설정 저장
- 오류/예외:
  - 시간 값 오류 시 기본값으로 복구하거나 저장을 제한한다.
- 관련 ERD 테이블:
  - companies, postings, question_bank, interview_sessions, interview_answers
- 비고/미결:
  - 설정 저장 버튼은 면접 시간 설정 영역 우측 상단 배치

## AI/리포트 처리

### API-028 POST /reports/{reportId}/evaluation-context
- 도메인: AI/리포트 처리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: system process
- 상태 코드: 202 Accepted
- 비동기: Y
- Path Params: reportId
- 요청 데이터:
  - JD, 평가 기준, 서류 요약, 답변 스크립트
- 검증/전제조건:
  - 모든 필수 데이터가 존재
- 성공 응답/처리:
  - ai_process_logs에 REPORT_GENERATE/EVALUATION_CONTEXT 작업을 생성하고 processLogId를 반환한다.
  - worker 완료 후 GET /ai/jobs/{processLogId}/status의 output.context로 평가 컨텍스트를 조회한다.
- 오류/예외:
  - 필수 데이터 누락 시 해당 평가 항목을 보류 상태로 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, criterion_tags, evaluation_criteria, applications, application_documents, interview_answers, evaluation_reports, report_scores, report_evidences, manual_evaluations, ai_process_logs
- 비고/미결:
  - 독립 화면 아님. 채용 리포트 생성 파이프라인 내부 처리

### API-029 POST /reports/{reportId}/answer-evaluation
- 도메인: AI/리포트 처리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: system process
- 상태 코드: 202 Accepted
- 비동기: Y
- Path Params: reportId
- 요청 데이터:
  - 답변 스크립트, 평가 기준, 모범 답안
- 검증/전제조건:
  - 답변 스크립트 존재
- 성공 응답/처리:
  - ai_process_logs에 REPORT_GENERATE/ANSWER_EVALUATION 작업을 생성하고 processLogId를 반환한다.
  - worker 가드레일 통과 후 report_scores, report_evidences에 저장하고 status output.scores/output.evidences로 조회한다.
- 오류/예외:
  - 근거 부족 또는 답변 불성실 판단 시 낮은 신뢰도와 수동 검토 상태를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, criterion_tags, evaluation_criteria, applications, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, manual_evaluations, ai_process_logs
- 비고/미결:
  - 결과는 지원자 평가 상세에 노출

### API-030 POST /reports/{reportId}/communication-analysis
- 도메인: AI/리포트 처리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: system process
- 상태 코드: 202 Accepted
- 비동기: Y
- Path Params: reportId
- 요청 데이터:
  - 영상 파일, 음성 파일, 얼굴/시선/음성 피처
- 검증/전제조건:
  - 분석 동의 및 영상 품질 충족
- 성공 응답/처리:
  - ai_process_logs에 REPORT_GENERATE/COMMUNICATION_ANALYSIS 작업을 생성하고 processLogId를 반환한다.
  - worker 완료 후 status output.communicationAnalysis로 보조 지표를 조회한다.
- 오류/예외:
  - 얼굴 미검출, 음성 품질 저하 시 해당 지표를 제외하고 사유를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, file_assets, postings, applications, consent_records, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - 보조 지표로만 사용. 평가 결정 근거 과대해석 주의

### API-031 POST /reports/{reportId}/generate
- 도메인: AI/리포트 처리
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 지원자 평가 상세 화면 (/company/applicants/{applicantId}/evaluation)
- UI Type: system process
- 상태 코드: 202 Accepted
- 비동기: Y
- Path Params: reportId
- 요청 데이터:
  - 서류 평가 결과, 면접 평가 결과, 평가 기준
- 검증/전제조건:
  - 평가 완료 상태
- 성공 응답/처리:
  - 평가 리포트 저장
- 오류/예외:
  - 리포트 생성 실패 시 재생성 버튼과 오류 상태를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, criterion_tags, evaluation_criteria, applications, application_documents, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - 리포트 목록에는 분석중/완료/실패 상태 표시

### API-079 POST /ai/guardrails/validate
- 도메인: AI/리포트 처리
- 권한/인증: 시스템 / 자동 처리
- 관련 화면: 공통 AI 시스템 처리 (-)
- UI Type: system process
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 평가 프롬프트, 금지 규칙, 출력 결과
- 검증/전제조건:
  - 안전 정책 활성화
- 성공 응답/처리:
  - 정책 준수 결과만 저장
- 오류/예외:
  - 정책 위반 결과는 저장하지 않고 재생성 또는 수동 검토 상태로 전환한다.
- 관련 ERD 테이블:
  - evaluation_reports, report_scores, report_evidences, manual_evaluations, ai_process_logs, ai_guardrail_logs
- 비고/미결:
  - 독립 화면 아님. 모든 AI 평가/생성 단계의 공통 정책 레이어
  - 구현 계약:
    - request: reportType, target, scores, summary?, processLogId?, policyName?, regenerated?, regenerationReason?
    - processLogId가 없으면 GUARDRAIL_VALIDATE ai_process_logs를 생성하고 COMPLETED 상태로 검증 결과를 output에 남긴다.
    - result: PASS는 정책 통과, BLOCKED는 최종 저장 차단, REGENERATED는 재생성된 출력이 정책을 통과했음을 의미한다.
    - ai_guardrail_logs.failure_category에는 BLOCKED일 때 NON_RETRYABLE을 기록한다. PASS/REGENERATED는 실패가 아니므로 null이다.
    - regenerated=true는 기본 검증이 PASS인 경우에만 REGENERATED로 기록된다. 기본 검증이 실패하면 BLOCKED가 우선한다.

## 기업 - 설정

### API-041 PATCH /company/profile
- 도메인: 기업 - 설정
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 회사 정보 관리 화면 (/company/mypage)
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 기업명, 산업군, 회사 로고, 인재상, 평가 정책
- 검증/전제조건:
  - 기업 관리자 권한 보유
- 성공 응답/처리:
  - 회사 정보 저장
- 오류/예외:
  - 필수값 누락 또는 권한 없음 시 저장을 제한한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, file_assets
- 비고/미결:
  - 기존 기업 마이페이지 명칭을 회사 정보 관리로 변경

### API-042 POST /company/profile/logo
- 도메인: 기업 - 설정
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 회사 정보 관리 화면 (/company/mypage)
- UI Type: button
- 상태 코드: 201 Created
- 비동기: N
- 요청 데이터:
  - 회사 로고 이미지 파일
- 검증/전제조건:
  - 허용 이미지 형식과 용량 조건 충족
- 성공 응답/처리:
  - 회사 로고 등록 완료
- 오류/예외:
  - 파일 형식 불일치, 용량 초과, 업로드 실패 시 오류 메시지를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, file_assets
- 비고/미결:
  - 회사 로고 사진 별도 등록 기능 추가

### API-043 PATCH /company/notifications/settings
- 도메인: 기업 - 설정
- 권한/인증: 기업 / 기업 사용자 로그인
- 관련 화면: 회사 정보 관리 화면 (/company/mypage)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 알림 수신 여부, 공고
- 검증/전제조건:
  - 알림 수신 설정 활성화
- 성공 응답/처리:
  - 알림 설정 저장
- 오류/예외:
  - 수신 거부 또는 발송 실패 시 알림 로그에 실패 상태를 남긴다.
- 관련 ERD 테이블:
  - companies, postings, interview_sessions, evaluation_reports, report_scores, report_evidences, notifications, ai_process_logs
- 비고/미결:
  - MVP 후순위. 담당자 선택 필터 삭제

## 지원자 - 모의면접

### API-044 POST /candidate/mock-interviews
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: AI 모의면접 시작 화면 (/candidate/mock-interview/start)
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 직무 선택, 난이도, 질문 유형
- 검증/전제조건:
  - 로그인 사용자
- 성공 응답/처리:
  - 모의면접 세션 생성
- 오류/예외:
  - 질문 생성 실패 시 기본 질문 세트를 제공한다.
- 관련 ERD 테이블:
  - candidate_profiles, question_bank, applications, interview_sessions, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - 기존 SNB 삭제. 2-depth는 GNB hover dropdown으로 노출. 연습 이력은 평가 리포트 항목으로 이동

### API-045 POST /candidate/mock-interviews/questions/generate
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: AI 모의면접 시작 화면 (/candidate/mock-interview/start)
- UI Type: system process
- 상태 코드: 202 Accepted
- 비동기: Y
- 요청 데이터:
  - 직무, 난이도, 질문 유형
- 검증/전제조건:
  - 선택값이 존재해야 함
- 성공 응답/처리:
  - 모의면접 질문 목록 생성
- 오류/예외:
  - 질문 생성 실패 시 기본 질문 세트를 제공한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, criterion_tags, evaluation_criteria, question_bank, applications, interview_sessions, ai_process_logs
- 비고/미결:
  - 채용 질문과 달리 JD/기업 평가 기준을 사용하지 않음

### API-046 GET /candidate/mock-interviews/{sessionId}
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: AI 모의면접 진행 화면 (/candidate/mock-interviews/{sessionId})
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- Path Params: sessionId
- 요청 데이터:
  - 면접 세션 ID, 카메라 권한, 마이크 권한, 면접 질문 표시 여부
- 검증/전제조건:
  - 모의면접 세션 생성 완료, 장치 권한 허용
- 성공 응답/처리:
  - 답변 녹화 및 다음 질문 진행
- 오류/예외:
  - 권한 거부, 녹화 실패, 네트워크 오류 시 재시도 안내를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, question_bank, applications, interview_sessions, interview_answers, ai_process_logs
- 비고/미결:
  - interviewType=MOCK. 질문 표시 토글은 CC 자막이 아니라 면접 질문 텍스트 표시 여부를 의미함

### API-047 GET /candidate/mock-interviews/{sessionId}/questions
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: AI 모의면접 진행 화면 (/candidate/mock-interviews/{sessionId})
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: sessionId
- 요청 데이터:
  - 질문 텍스트, 음성 안내 설정, 면접 질문 표시 여부
- 검증/전제조건:
  - 질문 목록 존재
- 성공 응답/처리:
  - 질문 음성 재생 및 설정에 따른 질문 텍스트 표시
- 오류/예외:
  - 질문 로딩 실패 시 안내 메시지를 표시하고 재시도를 제공한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, question_bank, applications, interview_sessions, ai_process_logs
- 비고/미결:
  - 질문 음성 다시 듣기 버튼 삭제. 면접 질문 표시 기본값 OFF. CC 자막 기능 아님

### API-048 POST /candidate/mock-interviews/{sessionId}/answers
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: AI 모의면접 진행 화면 (/candidate/mock-interviews/{sessionId})
- UI Type: section
- 상태 코드: 201 Created
- 비동기: N
- Path Params: sessionId
- 요청 데이터:
  - 카메라 스트림, 마이크 스트림, 답변 시간
- 검증/전제조건:
  - 장치 권한 허용, 저장 공간 확보
- 성공 응답/처리:
  - 답변 파일 업로드 완료
- 오류/예외:
  - 녹화 실패 시 재녹화 안내를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, applications, interview_sessions, interview_answers, ai_process_logs
- 비고/미결:
  - 기존 답변 완료 버튼명을 면접 종료로 변경하고 우측 하단 배치

### API-049 POST /candidate/mock-interviews/{sessionId}/next-question
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: AI 모의면접 진행 화면 (/candidate/mock-interviews/{sessionId})
- UI Type: button
- 상태 코드: 200 OK
- 비동기: N
- Path Params: sessionId
- 요청 데이터:
  - 버튼 클릭, 단축키 입력
- 검증/전제조건:
  - 면접 종료 상태
- 성공 응답/처리:
  - 다음 질문 표시
- 오류/예외:
  - 단축키 충돌 또는 이동 실패 시 오류 안내를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, question_bank, applications, interview_sessions, ai_process_logs
- 비고/미결:
  - 다음 질문으로 이동 단축키 지원

### API-050 POST /candidate/mock-interviews/{sessionId}/stt
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: AI 모의면접 진행 화면 (/candidate/mock-interviews/{sessionId})
- UI Type: system process
- 상태 코드: 202 Accepted
- 비동기: Y
- Path Params: sessionId
- 요청 데이터:
  - 음성 파일, 언어 설정
- 검증/전제조건:
  - 음성 품질이 분석 가능해야 함
- 성공 응답/처리:
  - 답변 스크립트 저장
- 오류/예외:
  - 음성 인식 실패 시 영상 원본 검토 상태로 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, applications, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - 독립 화면 아님. 리포트 상세에서 결과 확인

### API-051 POST /candidate/mock-interviews/{sessionId}/follow-up-question
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: AI 모의면접 진행 화면 (/candidate/mock-interviews/{sessionId})
- UI Type: section
- 상태 코드: 202 Accepted
- 비동기: Y
- Path Params: sessionId
- 요청 데이터:
  - answerId, 이전 질문(previousQuestion), 답변 스크립트(transcript), 직무 선택 정보
- 검증/전제조건:
  - 이전 질문과 답변 텍스트가 충분해야 함
- 성공 응답/처리:
  - 꼬리질문 표시
- 오류/예외:
  - 답변이 너무 짧거나 부적절하면 기본 꼬리질문을 제시한다.
- 관련 ERD 테이블:
  - candidate_profiles, postings, question_bank, applications, interview_sessions, interview_answers, follow_up_questions, ai_process_logs
- 비고/미결:
  - 채용 평가용 꼬리질문과 분리

### API-052 PATCH /candidate/mock-interviews/{sessionId}/complete
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: AI 모의면접 진행 화면 (/candidate/mock-interviews/{sessionId})
- UI Type: system process
- 상태 코드: 200 OK
- 비동기: N
- Path Params: sessionId
- 요청 데이터:
  - 면접 세션, 답변 파일, 스크립트
- 검증/전제조건:
  - 필수 질문 응답 완료
- 성공 응답/처리:
  - 피드백 생성 대기 상태로 전환
- 오류/예외:
  - 업로드 지연 시 분석 대기 상태로 표시하고 재시도를 수행한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, question_bank, applications, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - 완료 후 모의면접 리포트 생성 상태 표시

### API-053 GET /candidate/mock-interview/reports
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 모의면접 평가 리포트 화면 (/candidate/mock-interview/reports)
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 지원자 ID, 면접 이력, 리포트 ID
- 검증/전제조건:
  - 로그인 사용자
- 성공 응답/처리:
  - 연습 이력 및 모의면접 리포트 표시
- 오류/예외:
  - 리포트 생성 중이면 처리 상태를 표시하고 실패 시 재시도 안내를 제공한다.
- 관련 ERD 테이블:
  - candidate_profiles, criterion_tags, evaluation_criteria, applications, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, ai_process_logs, embeddings
- 비고/미결:
  - 연습 이력을 면접시작에서 평가 리포트 항목으로 편입

### API-054 GET /candidate/mock-interviews/history
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 모의면접 평가 리포트 화면 (/candidate/mock-interview/reports)
- UI Type: list
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 지원자 ID, 면접 이력
- 검증/전제조건:
  - 로그인 사용자
- 성공 응답/처리:
  - 연습 이력 목록 표시
- 오류/예외:
  - 이력이 없으면 첫 연습 시작 CTA를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, applications, interview_sessions, evaluation_reports, report_scores, report_evidences, ai_process_logs

### API-055 GET /candidate/mock-interview/reports/{reportId}/feedback
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 모의면접 평가 리포트 화면 (/candidate/mock-interview/reports/{reportId})
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: reportId
- 요청 데이터:
  - 녹화 답변, 스크립트, 직무 기준
- 검증/전제조건:
  - 답변 분석 완료
- 성공 응답/처리:
  - 피드백 결과 표시
- 오류/예외:
  - 답변 길이가 부족하면 피드백 범위를 제한하고 재시도를 안내한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, applications, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, ai_process_logs, embeddings
- 비고/미결:
  - 기업 선별용 판단 표현 사용 금지

### API-056 GET /candidate/mock-interview/reports/{reportId}/media
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 모의면접 평가 리포트 화면 (/candidate/mock-interview/reports/{reportId})
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: reportId
- 요청 데이터:
  - 영상 파일, 스크립트
- 검증/전제조건:
  - 영상 저장 및 STT 처리 완료
- 성공 응답/처리:
  - 영상과 스크립트 동시 표시
- 오류/예외:
  - 영상 재생 실패 시 스크립트만 표시하고 재처리 요청을 제공한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, applications, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, ai_process_logs

### API-057 POST /candidate/mock-interview/reports/{reportId}/generate
- 도메인: 지원자 - 모의면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 모의면접 평가 리포트 화면 (/candidate/mock-interview/reports/{reportId})
- UI Type: system process
- 상태 코드: 202 Accepted
- 비동기: Y
- Path Params: reportId
- 요청 데이터:
  - 답변 스크립트, 직무 기준, 질문 유형
- 검증/전제조건:
  - 답변 분석 완료 상태
- 성공 응답/처리:
  - 모의면접 리포트 저장
- 오류/예외:
  - 리포트 생성 실패 시 재생성 버튼과 오류 상태를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, postings, criterion_tags, evaluation_criteria, question_bank, applications, interview_sessions, interview_answers, evaluation_reports, report_scores, report_evidences, manual_evaluations, ai_process_logs
- 비고/미결:
  - 채용 리포트와 달리 합격/탈락 판단 없음

## 지원자 - 채용공고/지원

### API-058 GET /candidate/jobs
- 도메인: 지원자 - 채용공고/지원
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 회사 리스트 화면 (/candidate/jobs)
- UI Type: page, section, list
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 검색어, 직무/직군, 지역, 경력, 고용형태, 기술스택, 채용 상태, 정렬 기준
  - 공고 ID
- 검증/전제조건:
  - 조회 권한 보유
  - 유효한 검색 조건
  - 공개 상태의 채용공고
- 성공 응답/처리:
  - 회사/채용공고 목록 표시
  - 검색 결과 갱신
  - 채용공고 리스트 표시
- 오류/예외:
  - 조회 결과가 없으면 빈 상태 안내를 표시한다.
  - 검색 조건 오류 시 기본 조건으로 조회하거나 안내 메시지를 표시한다.
  - 공고가 마감되었으면 마감 상태를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, embeddings
- 비고/미결:
  - 기존 SNB 삭제. 2-depth는 GNB hover dropdown으로 노출. grid에서 list 형태로 변경
  - 검색 기능 강화
  - grid가 아니라 list 형태로 표시

### API-059 GET /candidate/jobs/{jobId}
- 도메인: 지원자 - 채용공고/지원
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 회사 상세 화면 (/candidate/jobs/{jobId})
- UI Type: popup
- 상태 코드: 200 OK
- 비동기: N
- Path Params: jobId
- 요청 데이터:
  - 회사 ID, 채용공고 ID
- 검증/전제조건:
  - 채용공고가 공개 상태여야 함
- 성공 응답/처리:
  - 회사 상세 팝업 표시 또는 이력서 제출 화면으로 이동
- 오류/예외:
  - 공고가 마감되었거나 접근 권한이 없으면 안내 메시지를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, file_assets, postings, applications, application_documents
- 비고/미결:
  - 지원하기 클릭 시 별도 이력서 제출 페이지로 이동

### API-060 POST /candidate/jobs/{jobId}/applications
- 도메인: 지원자 - 채용공고/지원
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 기업별 이력서 제출 화면 (/candidate/jobs/{jobId}/apply)
- UI Type: page
- 상태 코드: 201 Created
- 비동기: N
- Path Params: jobId
- 요청 데이터:
  - 채용공고 ID, 이력서 파일, 포트폴리오 링크, 지원자 ID
- 검증/전제조건:
  - 허용 파일 형식과 용량 조건 충족, 공고 지원 가능 상태
- 성공 응답/처리:
  - 지원서 제출 완료
- 오류/예외:
  - 파일 형식 오류, 용량 초과, 이미 지원한 공고, 마감 공고이면 제출을 제한한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, file_assets, postings, applications, application_documents
- 비고/미결:
  - 기업별 이력서 제출 페이지 신규 추가

## 지원자 - 지원현황/채용면접

### API-061 GET /candidate/applications
- 도메인: 지원자 - 지원현황/채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 지원현황 화면 (/candidate/applications)
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 지원자 ID, 상태 필터
- 검증/전제조건:
  - 로그인 사용자
- 성공 응답/처리:
  - 지원현황 목록 표시
- 오류/예외:
  - 지원 내역이 없으면 채용공고 탐색 CTA를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, application_documents, interview_sessions, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - 채용 AI 면접은 이 화면에서 진입

### API-062 GET /candidate/applications/{applicationId}/interview-guide
- 도메인: 지원자 - 지원현황/채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 지원현황 화면 (/candidate/applications)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: applicationId
- 요청 데이터:
  - 면접 세션 정보
- 검증/전제조건:
  - 면접 세션 활성 상태
- 성공 응답/처리:
  - 면접 진행 화면으로 이동 가능
- 오류/예외:
  - 세션 만료 또는 비활성 상태면 고객지원 안내를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, postings, applications, interview_sessions, interview_answers, ai_process_logs
- 비고/미결:
  - interviewType=RECRUITING

### API-063 POST /candidate/applications/{applicationId}/consent
- 도메인: 지원자 - 지원현황/채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 지원현황 화면 (/candidate/applications)
- UI Type: form
- 상태 코드: 200 OK
- 비동기: N
- Path Params: applicationId
- 요청 데이터:
  - 동의 체크박스, 필수 약관
- 검증/전제조건:
  - 필수 동의 완료
- 성공 응답/처리:
  - 면접 응시 가능 상태로 전환
- 오류/예외:
  - 필수 동의 누락 시 면접 시작 버튼을 비활성화한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, postings, applications, consent_records, interview_sessions, ai_process_logs
- 비고/미결:
  - 채용 AI 면접에서는 필수

### API-065 POST /candidate/applications/{applicationId}/interview/start
- 도메인: 지원자 - 지원현황/채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 지원현황 화면 (/candidate/applications)
- UI Type: button
- 상태 코드: 200 OK
- 비동기: N
- Path Params: applicationId
- 요청 데이터:
  - 지원 ID, 면접 세션 ID, 동의 상태, 장치 점검 결과
- 검증/전제조건:
  - 응시 기간 내, 필수 동의 완료, 장치 점검 완료
- 성공 응답/처리:
  - 채용 AI 면접 진행 화면으로 이동
- 오류/예외:
  - 세션 만료, 동의 누락, 장치 권한 오류 시 시작을 제한한다.
- 관련 ERD 테이블:
  - candidate_profiles, postings, applications, consent_records, interview_sessions, ai_process_logs
- 비고/미결:
  - interviewType=RECRUITING

### API-066 GET /candidate/applications/{applicationId}/interview
- 도메인: 지원자 - 지원현황/채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 채용 AI 면접 진행 화면 (/candidate/applications/{applicationId}/interview)
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- Path Params: applicationId
- 요청 데이터:
  - 면접 세션 ID, 카메라 권한, 마이크 권한, 면접 질문 표시 여부
- 검증/전제조건:
  - 응시 기간 내, 동의 완료, 장치 점검 완료
- 성공 응답/처리:
  - 답변 녹화 및 다음 질문 진행
- 오류/예외:
  - 권한 거부, 녹화 실패, 네트워크 오류 시 재시도 안내를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, postings, question_bank, applications, consent_records, interview_sessions, interview_answers, ai_process_logs
- 비고/미결:
  - interviewType=RECRUITING. 질문 표시 토글은 CC 자막이 아니라 면접 질문 텍스트 표시 여부를 의미함

### API-073 GET /candidate/applications/{applicationId}/report
- 도메인: 지원자 - 지원현황/채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 채용 AI 면접 결과 화면 (/candidate/applications/{applicationId}/report)
- UI Type: page
- 상태 코드: 200 OK
- 비동기: N
- Path Params: applicationId
- 요청 데이터:
  - 지원 ID, 면접 세션 ID
- 검증/전제조건:
  - 본인 지원 건이며 응시 완료 상태
- 성공 응답/처리:
  - 응시 결과 또는 제한된 피드백 표시
- 오류/예외:
  - 리포트 생성 중이면 처리 상태를 표시하고 접근 제한 항목은 안내 문구를 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, interview_sessions, evaluation_reports, report_scores, report_evidences, ai_process_logs
- 비고/미결:
  - reportType=RECRUITING_REPORT, 지원자 제한 조회

### API-074 GET /candidate/applications/{applicationId}/status
- 도메인: 지원자 - 지원현황/채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 채용 AI 면접 결과 화면 (/candidate/applications/{applicationId}/report)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: applicationId
- 요청 데이터:
  - 지원 ID
- 검증/전제조건:
  - 본인 지원 건
- 성공 응답/처리:
  - 전형 상태 표시
- 오류/예외:
  - 상태 조회 실패 시 다시 조회 버튼을 제공한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, postings, applications, interview_sessions, evaluation_reports, report_scores, report_evidences, manual_evaluations, ai_process_logs
- 비고/미결:
  - 기업용 합격/탈락 내부 메모는 노출하지 않음

## 지원자 - 채용면접

### API-064 POST /candidate/interviews/{sessionId}/device-check
- 도메인: 지원자 - 채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 지원현황 화면 (/candidate/applications)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: sessionId
- 요청 데이터:
  - 카메라 권한, 마이크 권한, 네트워크 상태
- 검증/전제조건:
  - 브라우저 권한 허용
- 성공 응답/처리:
  - 장치 점검 완료
- 오류/예외:
  - 권한 거부 또는 장치 미감지 시 해결 가이드를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, postings, applications, interview_sessions, ai_process_logs

### API-067 GET /candidate/interviews/{sessionId}/questions
- 도메인: 지원자 - 채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 채용 AI 면접 진행 화면 (/candidate/applications/{applicationId}/interview)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- Path Params: sessionId
- 요청 데이터:
  - 질문 텍스트, 음성 안내 설정, 면접 질문 표시 여부
- 검증/전제조건:
  - 질문 목록 존재
- 성공 응답/처리:
  - 질문 음성 재생 및 설정에 따른 질문 텍스트 표시
- 오류/예외:
  - 질문 로딩 실패 시 안내 메시지를 표시하고 재시도를 제공한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, postings, question_bank, applications, interview_sessions, ai_process_logs
- 비고/미결:
  - 모의면접과 동일하게 면접 질문 표시 기본값 OFF. 질문 음성 다시 듣기 버튼 삭제. CC 자막 기능 아님

### API-068 POST /candidate/interviews/{sessionId}/answers
- 도메인: 지원자 - 채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 채용 AI 면접 진행 화면 (/candidate/applications/{applicationId}/interview)
- UI Type: section
- 상태 코드: 201 Created
- 비동기: N
- Path Params: sessionId
- 요청 데이터:
  - 카메라 스트림, 마이크 스트림, 답변 시간
- 검증/전제조건:
  - 장치 권한 허용, 저장 공간 확보
- 성공 응답/처리:
  - 답변 파일 업로드 완료
- 오류/예외:
  - 녹화 실패 시 재녹화 또는 고객지원 안내를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, postings, applications, interview_sessions, interview_answers, ai_process_logs
- 비고/미결:
  - 기존 답변 완료 버튼명을 면접 종료로 변경하고 우측 하단 배치

### API-069 POST /candidate/interviews/{sessionId}/next-question
- 도메인: 지원자 - 채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 채용 AI 면접 진행 화면 (/candidate/applications/{applicationId}/interview)
- UI Type: button
- 상태 코드: 200 OK
- 비동기: N
- Path Params: sessionId
- 요청 데이터:
  - 버튼 클릭, 단축키 입력
- 검증/전제조건:
  - 면접 종료 상태
- 성공 응답/처리:
  - 다음 질문 표시
- 오류/예외:
  - 단축키 충돌 또는 이동 실패 시 오류 안내를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, postings, question_bank, applications, interview_sessions, ai_process_logs
- 비고/미결:
  - 다음 질문으로 이동 단축키 지원

### API-070 POST /candidate/interviews/{sessionId}/stt
- 도메인: 지원자 - 채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 채용 AI 면접 진행 화면 (/candidate/applications/{applicationId}/interview)
- UI Type: system process
- 상태 코드: 202 Accepted
- 비동기: Y
- Path Params: sessionId
- 요청 데이터:
  - 음성 파일, 언어 설정
- 검증/전제조건:
  - 음성 품질이 분석 가능해야 함
- 성공 응답/처리:
  - 답변 스크립트 저장
- 오류/예외:
  - 음성 인식 실패 시 영상 원본 검토 상태로 표시한다.
- 관련 ERD 테이블:
  - companies, candidate_profiles, file_assets, postings, applications, interview_sessions, interview_answers, ai_process_logs
- 비고/미결:
  - 독립 화면 아님. 기업 지원자 평가 상세에서 결과 확인

### API-071 POST /candidate/interviews/{sessionId}/follow-up-question
- 도메인: 지원자 - 채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 채용 AI 면접 진행 화면 (/candidate/applications/{applicationId}/interview)
- UI Type: section
- 상태 코드: 202 Accepted
- 비동기: Y
- Path Params: sessionId
- 요청 데이터:
  - answerId, 이전 질문(previousQuestion), 답변 스크립트(transcript), JD(jobDescription) 또는 서류 요약(documentSummary)
- 검증/전제조건:
  - 이전 질문과 답변 텍스트가 충분해야 하며 JD 또는 서류 요약 중 하나가 존재해야 함
- 성공 응답/처리:
  - 꼬리질문 표시
- 오류/예외:
  - 답변이 너무 짧거나 부적절하면 기본 꼬리질문을 제시한다.
- 관련 ERD 테이블:
  - candidate_profiles, postings, question_bank, applications, application_documents, interview_sessions, interview_answers, follow_up_questions, ai_process_logs
- 비고/미결:
  - 채용 전형 정책에 따라 사용 여부 확정 필요

### API-072 PATCH /candidate/interviews/{sessionId}/complete
- 도메인: 지원자 - 채용면접
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 채용 AI 면접 진행 화면 (/candidate/applications/{applicationId}/interview)
- UI Type: system process
- 상태 코드: 200 OK
- 비동기: N
- Path Params: sessionId
- 요청 데이터:
  - 면접 세션, 답변 파일, 스크립트
- 검증/전제조건:
  - 필수 질문 응답 완료
- 성공 응답/처리:
  - 분석 대기 상태로 전환
- 오류/예외:
  - 업로드 지연 시 분석 대기 상태로 표시하고 재시도를 수행한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, postings, question_bank, applications, interview_sessions, interview_answers, ai_process_logs
- 비고/미결:
  - 완료 후 지원현황에는 분석중 상태 표시

## 지원자 - 마이페이지

### API-075 POST /candidate/resume
- 도메인: 지원자 - 마이페이지
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 지원자 마이페이지 화면 (/candidate/mypage)
- UI Type: page
- 상태 코드: 201 Created
- 비동기: N
- 요청 데이터:
  - 이력서 PDF/DOCX 파일
- 검증/전제조건:
  - 허용 파일 형식과 용량 조건 충족
- 성공 응답/처리:
  - 이력서 업로드 완료
- 오류/예외:
  - 파일 손상, 형식 불일치, 용량 초과 시 재업로드 안내를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, applications, application_documents

### API-076 POST /candidate/documents/extract
- 도메인: 지원자 - 마이페이지
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 지원자 마이페이지 화면 (/candidate/mypage)
- UI Type: system process
- 상태 코드: 202 Accepted
- 비동기: Y
- 요청 데이터:
  - 이력서 파일, 포트폴리오 링크
- 검증/전제조건:
  - 파일 파싱 가능, 링크 접근 권한 확보
- 성공 응답/처리:
  - 추출 텍스트 저장 및 서류 분석 대기 상태 전환
- 오류/예외:
  - 파싱 실패 시 재업로드 안내 또는 수동 입력 요청 상태를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, applications, application_documents, manual_evaluations, ai_process_logs
- 비고/미결:
  - 독립 화면 아님. 업로드 후 백그라운드 처리

### API-077 POST /candidate/portfolio-links
- 도메인: 지원자 - 마이페이지
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 지원자 마이페이지 화면 (/candidate/mypage)
- UI Type: form
- 상태 코드: 201 Created
- 비동기: N
- 요청 데이터:
  - URL, 설명, 파일 첨부
- 검증/전제조건:
  - URL 형식이 유효해야 함
- 성공 응답/처리:
  - 링크 등록 완료
- 오류/예외:
  - 잘못된 URL 또는 접근 불가 URL이면 확인 메시지를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, file_assets, applications, application_documents, interview_sessions

### API-078 GET /candidate/notifications/interview-invitations
- 도메인: 지원자 - 마이페이지
- 권한/인증: 지원자 / 지원자 사용자 로그인
- 관련 화면: 지원자 마이페이지 화면 (/candidate/mypage)
- UI Type: section
- 상태 코드: 200 OK
- 비동기: N
- 요청 데이터:
  - 이메일, 응시 링크, 마감일
- 검증/전제조건:
  - 수신자 이메일 유효
- 성공 응답/처리:
  - 응시 안내 알림 표시
- 오류/예외:
  - 발송 실패 시 재발송 상태와 오류 사유를 표시한다.
- 관련 ERD 테이블:
  - candidate_profiles, postings, applications, application_documents, interview_sessions, notifications, ai_process_logs
- 비고/미결:
  - MVP 후순위
