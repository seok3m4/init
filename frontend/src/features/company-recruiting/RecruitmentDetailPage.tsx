"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getRecruitment } from "./api";
import { CompanyNav, StatusBadge } from "./CompanyRecruitingChrome";
import type { Recruitment } from "./types";

export function RecruitmentDetailPage({ recruitmentId }: { recruitmentId: number }) {
  const [recruitment, setRecruitment] = useState<Recruitment | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await getRecruitment(recruitmentId);
        setRecruitment(response.data);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "공고 상세를 불러오지 못했습니다.");
      }
    }
    void load();
  }, [recruitmentId]);

  return (
    <main className="app-shell">
      <CompanyNav active="recruitments" />
      <section className="app-page">
        <div className="page-head">
          <div>
            <p className="eyebrow">RECRUITMENT DETAIL</p>
            <h1>{recruitment?.title ?? "공고 세부내용"}</h1>
            <p>자기 회사 공고만 상세 조회할 수 있습니다.</p>
          </div>
          <Link className="btn primary" href={`/company/recruitments/${recruitmentId}/applicants`}>
            지원자 관리
          </Link>
        </div>

        {message ? <p className="notice danger">{message}</p> : null}
        {recruitment ? (
          <>
            <section className="kpi-row">
              <div className="kpi">
                <span>상태</span>
                <StatusBadge value={recruitment.status} />
              </div>
              <div className="kpi">
                <span>지원자</span>
                <strong>{recruitment.applicantCount}</strong>
              </div>
              <div className="kpi">
                <span>채용 기간</span>
                <strong>{formatPeriod(recruitment)}</strong>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>{recruitment.jobRole}</h2>
                  <p>공고 ID #{recruitment.recruitmentId}</p>
                </div>
              </div>
              <div className="description-box">
                {recruitment.jobDescription || "등록된 JD가 없습니다. 면접 설정은 C 역할 영역에서 별도 연결합니다."}
              </div>
            </section>
          </>
        ) : (
          <div className="empty">공고 정보를 불러오는 중입니다.</div>
        )}
      </section>
    </main>
  );
}

function formatPeriod(item: Recruitment) {
  if (!item.startsOn && !item.endsOn) {
    return "기간 미정";
  }
  return `${item.startsOn ?? "시작 미정"} ~ ${item.endsOn ?? "마감 미정"}`;
}
