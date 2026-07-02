"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { listRecruitmentApplicants, listRecruitments } from "./api";
import { StatusBadge } from "./CompanyRecruitingChrome";
import type { Recruitment, RecruitmentStatus } from "./types";
import { getCompanyPostingActions } from "./company-posting-actions";
import { getCompanyProfile } from "../company-profile/api";
import { getCompanyDisplayName, getCompanyInitial, getCompanyLogoUrl } from "../company-profile/company-profile-display";
import type { CompanyProfile } from "../company-profile/types";

type StatusFilter = "ALL" | RecruitmentStatus;

type CompletionStat = { rate: number; done: number; total: number };

const ACTIVE_STATUSES: RecruitmentStatus[] = ["OPEN", "CLOSING_SOON"];
const INTERVIEW_DONE_STATUSES = ["COMPLETED", "DONE"];

export function CompanyPostingsPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [items, setItems] = useState<Recruitment[]>([]);
  const [completion, setCompletion] = useState<Record<number, CompletionStat>>({});
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // list API에는 응시 완료율이 없어 공고별 지원자를 읽어 면접 완료 비율을 계산한다.
  const loadCompletion = useCallback(async (list: Recruitment[]) => {
    try {
      const entries = await Promise.all(
        list.map(async (item) => {
          const res = await listRecruitmentApplicants(item.recruitmentId, { page: 1, limit: 100 });
          const applicants = res.data.items;
          const done = applicants.filter((a) => INTERVIEW_DONE_STATUSES.includes(a.interviewStatus)).length;
          const total = applicants.length;
          const rate = total > 0 ? Math.round((done / total) * 100) : 0;
          return [item.recruitmentId, { rate, done, total }] as const;
        }),
      );
      setCompletion(Object.fromEntries(entries));
    } catch {
      // 완료율은 보조 지표 — 실패해도 목록 자체는 유지한다.
    }
  }, []);

  const loadRecruitments = useCallback(async (search: string, status: StatusFilter) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await listRecruitments({
        page: 1,
        limit: 20,
        q: search,
        status: status === "ALL" ? undefined : status,
        sort: "createdAt",
        order: "desc",
      });
      setItems(response.data.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공고 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCompanyProfile = useCallback(async () => {
    try {
      const profile = await getCompanyProfile();
      setCompanyProfile(profile);
    } catch {
      setCompanyProfile(null);
    }
  }, []);

  useEffect(() => {
    void loadRecruitments("", "ALL");
    void loadCompanyProfile();
  }, [loadCompanyProfile, loadRecruitments]);

  useEffect(() => {
    if (items.length > 0) {
      void loadCompletion(items);
    }
  }, [items, loadCompletion]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadRecruitments(q, statusFilter);
  }

  // KPI는 list 응답에서 파생 가능한 값만 사용한다.
  const activeCount = items.filter((item) => ACTIVE_STATUSES.includes(item.status)).length;
  const totalApplicants = items.reduce((sum, item) => sum + item.applicantCount, 0);
  const closingItems = items.filter((item) => {
    const left = daysUntil(item.endsOn);
    return left !== null && left >= 0 && left <= 7 && item.status !== "CLOSED" && item.status !== "ARCHIVED";
  });
  const nearestDday = closingItems.length
    ? Math.min(...closingItems.map((item) => daysUntil(item.endsOn) as number))
    : null;
  const companyDisplayName = getCompanyDisplayName(companyProfile);
  const companyLogoUrl = getCompanyLogoUrl(companyProfile);

  return (
    <section className="app-page glass-page">
        <div className="page-head">
          <div>
            <h1>공고 목록</h1>
            <p className="page-sub">
              {companyDisplayName ? `${companyDisplayName}의 채용 공고를 한눈에 관리합니다.` : "진행 중인 채용 공고를 한눈에 관리합니다."}
            </p>
          </div>
          <Link className="btn primary" href="/company/recruitments/new">
            + 공고 생성
          </Link>
        </div>

        <section className="kpi-row kpi-summary">
          <div className="kpi">
            <span>진행 중 공고</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="kpi primary">
            <span>총 지원자</span>
            <strong>{totalApplicants}</strong>
          </div>
          <div className="kpi">
            <span>서류 검토 대기</span>
            <strong>
              —<em className="kpi-tag">연동 전</em>
            </strong>
          </div>
          <div className="kpi">
            <span>마감 임박</span>
            <strong>
              {closingItems.length}
              {nearestDday !== null ? <small className="kpi-dday"> · D-{nearestDday}</small> : null}
            </strong>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <h2>채용 공고</h2>
              {items.length > 0 ? <span className="count-pill">{items.length}</span> : null}
            </div>
            <form className="toolbar" onSubmit={handleSearch}>
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="프로젝트·직무 검색" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="ALL">전체 상태</option>
                <option value="DRAFT">작성중</option>
                <option value="OPEN">모집중</option>
                <option value="CLOSING_SOON">마감임박</option>
                <option value="CLOSED">마감</option>
                <option value="ARCHIVED">보관</option>
              </select>
              <button className="btn secondary" type="submit" disabled={loading}>
                조회
              </button>
            </form>
          </div>

          {message ? <p className="notice">{message}</p> : null}

          {items.length === 0 ? (
            <div className="empty">공고가 없습니다. 오른쪽 상단에서 첫 공고를 생성하세요.</div>
          ) : (
            <div className="posting-list">
              {items.map((item) => {
                const stat = completion[item.recruitmentId];
                const rate = stat?.rate ?? 0;
                const actions = getCompanyPostingActions(item);
                return (
                  <article className="posting" key={item.recruitmentId}>
                    <div className={`logo-chip ${companyLogoUrl ? "has-image" : ""}`}>
                      {companyLogoUrl ? <span style={{ backgroundImage: `url(${companyLogoUrl})` }} aria-hidden="true" /> : getCompanyInitial(companyProfile, item.title)}
                    </div>
                    <div className="posting-info">
                      <div className="posting-title-row">
                        <h3>{item.title}</h3>
                        <StatusBadge value={item.status} />
                      </div>
                      <p>
                        {companyDisplayName ? `${companyDisplayName} · ` : ""}
                        {item.jobRole} · {formatPeriod(item)} · <b className="dday">{ddayLabel(item.endsOn)}</b>
                      </p>
                    </div>
                    <div className="posting-progress">
                      <div className="progress">
                        <i style={{ width: `${rate}%` }} />
                      </div>
                      <span>
                        응시 완료 {rate}%
                        {stat ? ` · ${stat.done}/${stat.total}명` : ""}
                      </span>
                    </div>
                    <div className="posting-actions">
                      {actions.includes("manage") ? (
                        <Link className="btn secondary" href={`/company/recruitments/${item.recruitmentId}`}>
                          관리
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
    </section>
  );
}

function formatPeriod(item: Recruitment) {
  if (!item.startsOn && !item.endsOn) {
    return "기간 미정";
  }
  return `${item.startsOn ?? "시작 미정"} ~ ${item.endsOn ?? "마감 미정"}`;
}

function daysUntil(endsOn: string | null): number | null {
  if (!endsOn) {
    return null;
  }
  const end = new Date(`${endsOn}T23:59:59`);
  if (Number.isNaN(end.getTime())) {
    return null;
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((end.getTime() - startOfToday.getTime()) / 86_400_000);
}

function ddayLabel(endsOn: string | null): string {
  const left = daysUntil(endsOn);
  if (left === null) {
    return "마감 미정";
  }
  if (left < 0) {
    return "마감";
  }
  if (left === 0) {
    return "D-day";
  }
  return `D-${left}`;
}
