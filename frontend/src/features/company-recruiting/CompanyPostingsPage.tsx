"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { copyRecruitment, listRecruitments } from "./api";
import { StatusBadge } from "./CompanyRecruitingChrome";
import type { Recruitment, RecruitmentStatus } from "./types";

type StatusFilter = "ALL" | RecruitmentStatus;

export function CompanyPostingsPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [items, setItems] = useState<Recruitment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    void loadRecruitments("", "ALL");
  }, [loadRecruitments]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadRecruitments(q, statusFilter);
  }

  async function handleCopy(recruitment: Recruitment) {
    setLoading(true);
    setMessage("");
    try {
      const result = await copyRecruitment(recruitment.recruitmentId);
      setMessage(`${result.data.title} 공고가 DRAFT로 복사되었습니다.`);
      await loadRecruitments(q, statusFilter);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공고 복사에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="app-page glass-page">
        <div className="page-head">
          <div>
            <h1>공고 목록</h1>
            <p className="page-sub">진행 중인 채용 공고를 관리합니다.</p>
          </div>
          <Link className="btn primary" href="/company/recruitments/new">
            공고 생성
          </Link>
        </div>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>채용 공고</h2>
            </div>
            <form className="toolbar" onSubmit={handleSearch}>
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="프로젝트명, 직무명 검색" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="ALL">전체 상태</option>
                <option value="DRAFT">DRAFT</option>
                <option value="OPEN">OPEN</option>
                <option value="CLOSING_SOON">CLOSING_SOON</option>
                <option value="CLOSED">CLOSED</option>
                <option value="ARCHIVED">ARCHIVED</option>
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
              {items.map((item) => (
                <article className="posting" key={item.recruitmentId}>
                  <div className="logo-chip">A사</div>
                  <div>
                    <h3>{item.title}</h3>
                    <p>
                      {item.jobRole} · {formatPeriod(item)}
                    </p>
                  </div>
                  <Metric label="지원자" value={item.applicantCount} />
                  <StatusBadge value={item.status} />
                  <div className="posting-actions">
                    {item.status === "CLOSED" ? (
                      <button className="btn secondary" type="button" disabled={loading} onClick={() => void handleCopy(item)}>
                        복사
                      </button>
                    ) : null}
                    <Link className="btn secondary" href={`/company/recruitments/${item.recruitmentId}`}>
                      관리
                    </Link>
                  </div>
                </article>
              ))}
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
