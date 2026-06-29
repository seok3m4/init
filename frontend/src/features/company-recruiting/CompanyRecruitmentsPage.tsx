"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { createRecruitment, listRecruitments } from "./api";
import { CompanyNav, StatusBadge } from "./CompanyRecruitingChrome";
import type { Recruitment } from "./types";

type FormState = {
  title: string;
  jobRole: string;
  startsOn: string;
  endsOn: string;
  status: "DRAFT" | "OPEN";
  jobDescription: string;
};

const initialForm: FormState = {
  title: "",
  jobRole: "",
  startsOn: "",
  endsOn: "",
  status: "OPEN",
  jobDescription: "",
};

export function CompanyRecruitmentsPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Recruitment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadRecruitments(search = q) {
    setLoading(true);
    setMessage("");
    try {
      const response = await listRecruitments({ page: 1, limit: 20, q: search, sort: "createdAt", order: "desc" });
      setItems(response.data.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공고 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecruitments("");
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await createRecruitment({
        title: form.title,
        jobRole: form.jobRole,
        startsOn: form.startsOn || undefined,
        endsOn: form.endsOn || undefined,
        status: form.status,
        jobDescription: form.jobDescription || undefined,
      });
      setForm(initialForm);
      setMessage("공고가 생성되었습니다.");
      await loadRecruitments("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공고 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="app-shell">
      <CompanyNav active="recruitments" />
      <section className="app-page">
        <div className="page-head">
          <div>
            <p className="eyebrow">RECRUITMENTS</p>
            <h1>채용 공고 관리</h1>
            <p>기업 공고를 만들고 목록에서 상세 흐름으로 진입합니다.</p>
          </div>
        </div>

        <form className="panel form-panel" onSubmit={handleCreate}>
          <div className="panel-head">
            <div>
              <h2>채용 프로젝트 생성</h2>
              <p>지원자에게 노출하려면 상태를 OPEN으로 생성합니다.</p>
            </div>
            <button className="btn primary" type="submit" disabled={loading}>
              등록
            </button>
          </div>

          <div className="grid-2">
            <label>
              프로젝트명
              <input
                required
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="2026 신입 백엔드 채용"
              />
            </label>
            <label>
              직무명
              <input
                required
                value={form.jobRole}
                onChange={(event) => updateField("jobRole", event.target.value)}
                placeholder="Backend Developer"
              />
            </label>
            <label>
              채용 시작일
              <input type="date" value={form.startsOn} onChange={(event) => updateField("startsOn", event.target.value)} />
            </label>
            <label>
              채용 마감일
              <input type="date" value={form.endsOn} onChange={(event) => updateField("endsOn", event.target.value)} />
            </label>
            <label>
              공개 상태
              <select value={form.status} onChange={(event) => updateField("status", event.target.value as FormState["status"])}>
                <option value="OPEN">OPEN</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </label>
            <label className="wide">
              JD 직접 입력
              <textarea
                value={form.jobDescription}
                onChange={(event) => updateField("jobDescription", event.target.value)}
                placeholder="담당 업무, 자격 요건, 우대 사항을 입력하세요."
              />
            </label>
          </div>
        </form>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>공고 목록</h2>
              <p>자기 회사 공고만 조회됩니다.</p>
            </div>
            <form
              className="toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                void loadRecruitments(q);
              }}
            >
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="프로젝트명, 직무명 검색" />
              <button className="btn secondary" type="submit" disabled={loading}>
                조회
              </button>
            </form>
          </div>

          {message ? <p className="notice">{message}</p> : null}
          {items.length === 0 ? (
            <div className="empty">공고가 없습니다. 위 양식에서 첫 공고를 생성하세요.</div>
          ) : (
            <div className="posting-list">
              {items.map((item) => (
                <article className="posting" key={item.recruitmentId}>
                  <div className="logo-chip">in</div>
                  <div>
                    <h3>{item.title}</h3>
                    <p>
                      {item.jobRole} · {formatPeriod(item)}
                    </p>
                  </div>
                  <Metric label="지원자" value={item.applicantCount} />
                  <StatusBadge value={item.status} />
                  <Link className="btn secondary" href={`/company/recruitments/${item.recruitmentId}`}>
                    관리
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
