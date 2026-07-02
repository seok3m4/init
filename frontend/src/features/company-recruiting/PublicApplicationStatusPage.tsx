"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import {
  lookupPublicApplicationStatus,
  type PublicApplicationStatus,
} from "./public-application-api";

export function PublicApplicationStatusPage({
  initialEmail = "",
  recruitmentId,
}: {
  initialEmail?: string;
  recruitmentId: number;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<PublicApplicationStatus | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setStatus(null);
    try {
      const result = await lookupPublicApplicationStatus(recruitmentId, email.trim());
      setStatus(result.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "지원 현황을 찾을 수 없습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="app-page glass-page">
        <header className="page-head">
          <div>
            <p className="eyebrow">APPLICATION STATUS</p>
            <h1>지원 현황 확인</h1>
            <p className="page-sub">지원서 제출에 사용한 이메일로 현재 지원 상태와 면접 안내를 확인합니다.</p>
          </div>
          <Link className="btn secondary" href={`/public/recruitments/${recruitmentId}/apply`}>
            지원 폼으로
          </Link>
        </header>

        <div className="grid-2">
          <form aria-label="공개 지원 현황 조회" className="panel" onSubmit={handleSubmit}>
            <div className="panel-head">
              <div>
                <h2>이메일 확인</h2>
                <p>실제 매직링크 인증 전까지는 제출 이메일 기준으로 제한된 현황만 보여줍니다.</p>
              </div>
            </div>
            <div className="creation-flow">
              <label>
                지원 이메일
                <input
                  required
                  type="email"
                  value={email}
                  placeholder="candidate@example.com"
                  onChange={(event) => setEmail(event.currentTarget.value)}
                />
              </label>
              <div className="form-actions">
                <button className="btn primary" disabled={!email.trim() || busy} type="submit">
                  {busy ? "확인 중" : "지원 현황 확인"}
                </button>
              </div>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>현황</h2>
                <p>기업 내부 평가 메모와 리포트 상세는 공개되지 않습니다.</p>
              </div>
            </div>
            {message ? <p className="notice danger">{message}</p> : null}
            {status ? <StatusDetail status={status} /> : <p className="empty-state">지원 이메일을 입력하면 현황이 표시됩니다.</p>}
          </section>
        </div>
      </section>
    </main>
  );
}

function StatusDetail({ status }: { status: PublicApplicationStatus }) {
  return (
    <div className="stacked-list">
      <div className="list-row">
        <div>
          <strong>{status.recruitment.title}</strong>
          <p>
            {status.recruitment.companyName} · {status.recruitment.jobRole}
          </p>
        </div>
        <span className="status-pill">{status.recruitment.status}</span>
      </div>
      <dl className="detail-list">
        <DetailItem label="지원자" value={status.candidateName} />
        <DetailItem label="이메일" value={status.email} />
        <DetailItem label="지원 상태" value={status.statuses.applicationStatus} />
        <DetailItem label="서류 상태" value={status.statuses.documentStatus} />
        <DetailItem label="면접 상태" value={status.statuses.interviewStatus} />
        <DetailItem label="리포트 상태" value={status.statuses.reportStatus} />
      </dl>
      <div className="notice">
        <strong>{getInterviewMessage(status.interviewAccess.nextAction)}</strong>
        {status.interviewAccess.sessionId ? <p>면접 세션 ID: {status.interviewAccess.sessionId}</p> : null}
        {status.interviewAccess.temporary ? <p>현재 면접 진입 링크는 실제 D 면접 런타임 연동 전 임시 안내입니다.</p> : null}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </>
  );
}

function getInterviewMessage(nextAction: PublicApplicationStatus["interviewAccess"]["nextAction"]) {
  if (nextAction === "START_INTERVIEW") return "면접을 시작할 수 있는 상태입니다.";
  if (nextAction === "VIEW_RESULT") return "면접이 완료되었습니다. 결과 공개 방식은 기업 안내를 확인해주세요.";
  return "아직 면접 초대 또는 세션이 준비되지 않았습니다.";
}
