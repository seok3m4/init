"use client";

import Link from "next/link";

export function PublicApplicationStatusPage({ recruitmentId }: { recruitmentId: number }) {
  return (
    <main className="app-shell">
      <section className="app-page glass-page">
        <header className="page-head">
          <div>
            <p className="eyebrow">APPLICATION STATUS</p>
            <h1>지원 현황 확인</h1>
            <p className="page-sub">이 화면은 이메일로 받은 매직링크를 통해 접근하는 지원자 전용 화면입니다.</p>
          </div>
          <Link className="btn secondary" href={`/public/recruitments/${recruitmentId}/apply`}>
            지원 폼으로
          </Link>
        </header>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>매직링크 연동 대기</h2>
              <p>지원 현황은 이메일 소유 확인이 끝난 지원자에게만 공개됩니다.</p>
            </div>
          </div>
          <div className="empty">
            현재는 이메일 입력만으로 다른 지원자의 현황이 노출되지 않도록 직접 조회 기능을 막아두었습니다. A/Auth의
            매직링크 토큰 발급과 검증 방식이 확정되면, 이메일 링크로 이 화면에 들어온 지원자에게만 지원 상태와 면접
            안내를 표시합니다.
          </div>
        </section>
      </section>
    </main>
  );
}
