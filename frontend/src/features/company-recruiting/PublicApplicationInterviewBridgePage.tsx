"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getPublicApplicationStatus, type PublicApplicationStatus } from "./public-application-api";

type AsyncState<T> = {
  data?: T;
  loading: boolean;
  error?: string;
};

export function PublicApplicationInterviewBridgePage({
  applicationId,
  token,
}: {
  applicationId: number;
  token?: string;
}) {
  const [state, setState] = useState<AsyncState<PublicApplicationStatus>>({ loading: Boolean(token) });

  const verifyAccess = useCallback(async () => {
    if (!token) {
      setState({ loading: false, error: "면접 진입은 이메일 매직링크로만 가능합니다." });
      return;
    }
    setState({ loading: true });
    try {
      const result = await getPublicApplicationStatus(token);
      if (result.data.applicationId !== applicationId) {
        setState({ loading: false, error: "매직링크가 지원서 정보와 일치하지 않습니다." });
        return;
      }
      setState({ data: result.data, loading: false });
    } catch (error) {
      setState({ loading: false, error: toErrorMessage(error) });
    }
  }, [applicationId, token]);

  useEffect(() => {
    void verifyAccess();
  }, [verifyAccess]);

  return (
    <main className="app-shell">
      <section className="app-page glass-page">
        <header className="page-head">
          <div>
            <p className="eyebrow">PUBLIC INTERVIEW</p>
            <h1>채용 AI 면접</h1>
            <p className="page-sub">비회원 지원자의 채용 면접 진입을 준비하는 화면입니다.</p>
          </div>
          <Link className="btn secondary" href="/">
            INIT 홈
          </Link>
        </header>

        {state.loading ? <p className="notice">매직링크 권한을 확인하는 중입니다.</p> : null}
        {state.error ? <p className="notice danger">{state.error}</p> : null}

        {state.data ? (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>{state.data.name}님의 면접 진입 준비</h2>
                <p>D public interview access context가 준비되면 이 화면에서 실제 면접 런타임으로 이어집니다.</p>
              </div>
            </div>
            <dl className="detail-list">
              <DetailItem label="지원 직무" value={state.data.jobRole} />
              <DetailItem label="면접 상태" value={state.data.interviewStatus} />
              <DetailItem label="연동 상태" value={state.data.interviewEntry.integrationStatus} />
            </dl>
            <div className="empty">
              현재는 실제 D 면접 API를 호출하지 않습니다. D의 public interview guard/context가 확정되면
              applicationId 기준 면접 시작 API와 연결합니다.
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </>
  );
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
}
