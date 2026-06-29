"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { createApplicant, getRecruitment, inviteApplicant, listRecruitmentApplicants } from "./api";
import { CompanyNav, StatusBadge } from "./CompanyRecruitingChrome";
import type { Applicant, Recruitment } from "./types";

type FormState = {
  name: string;
  email: string;
  jobRole: string;
  phone: string;
};

const initialForm: FormState = {
  name: "",
  email: "",
  jobRole: "",
  phone: "",
};

type InvitationState = {
  applicantId: string;
  availableFrom: string;
  availableUntil: string;
  message: string;
};

const initialInvitation: InvitationState = {
  applicantId: "",
  availableFrom: "",
  availableUntil: "",
  message: "안녕하세요. 채용 AI 면접 응시 안내드립니다.",
};

export function RecruitmentApplicantsPage({ recruitmentId }: { recruitmentId: number }) {
  const [recruitment, setRecruitment] = useState<Recruitment | null>(null);
  const [items, setItems] = useState<Applicant[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [invitation, setInvitation] = useState<InvitationState>(initialInvitation);
  const [q, setQ] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(search = q) {
    setLoading(true);
    setMessage("");
    try {
      const [detail, applicants] = await Promise.all([
        getRecruitment(recruitmentId),
        listRecruitmentApplicants(recruitmentId, { page: 1, limit: 20, q: search, sort: "updatedAt", order: "desc" }),
      ]);
      setRecruitment(detail.data);
      setItems(applicants.data.items);
      setForm((current) => ({ ...current, jobRole: current.jobRole || detail.data.jobRole }));
      setInvitation((current) => ({
        ...current,
        applicantId: current.applicantId || String(applicants.data.items[0]?.applicationId ?? ""),
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "지원자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("");
  }, [recruitmentId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await createApplicant({
        recruitmentId,
        name: form.name,
        email: form.email,
        jobRole: form.jobRole,
        phone: form.phone || undefined,
      });
      setForm({ ...initialForm, jobRole: recruitment?.jobRole ?? "" });
      setMessage("지원자가 등록되었습니다.");
      await load("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "지원자 등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await inviteApplicant({
        applicantId: Number(invitation.applicantId),
        availableFrom: invitation.availableFrom,
        availableUntil: invitation.availableUntil,
        message: invitation.message,
      });
      setMessage(
        result.data.temporary
          ? "초대 요청이 임시 adapter에 기록되었고 면접 세션 연결 요청 상태로 표시됩니다."
          : "초대 요청이 처리되었습니다.",
      );
      await load(q);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "초대 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateInvitation<K extends keyof InvitationState>(key: K, value: InvitationState[K]) {
    setInvitation((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="app-shell">
      <CompanyNav active="applicants" />
      <section className="app-page">
        <div className="page-head">
          <div>
            <p className="eyebrow">APPLICANTS</p>
            <h1>{recruitment?.title ?? "지원자 관리"}</h1>
            <p>같은 공고 안에서는 같은 이메일을 중복 등록할 수 없습니다.</p>
          </div>
          <Link className="btn secondary" href={`/company/recruitments/${recruitmentId}`}>
            공고 상세
          </Link>
        </div>

        <form className="panel" onSubmit={handleCreate}>
          <div className="panel-head">
            <div>
              <h2>지원자 등록</h2>
              <p>등록 즉시 공고와 지원 이력이 연결됩니다.</p>
            </div>
            <button className="btn primary" type="submit" disabled={loading}>
              직접 등록
            </button>
          </div>
          <div className="grid-2">
            <label>
              이름
              <input required value={form.name} onChange={(event) => updateField("name", event.target.value)} />
            </label>
            <label>
              이메일
              <input required type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
            </label>
            <label>
              지원 직무
              <input required value={form.jobRole} onChange={(event) => updateField("jobRole", event.target.value)} />
            </label>
            <label>
              연락처
              <input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
            </label>
          </div>
        </form>

        <form className="panel" onSubmit={handleInvite}>
          <div className="panel-head">
            <div>
              <h2>면접 초대 요청</h2>
              <p>응시 기간과 안내 메시지를 저장하고 채용 AI 면접 세션 연결 요청을 남깁니다.</p>
            </div>
            <button className="btn primary" type="submit" disabled={loading || items.length === 0}>
              초대 요청
            </button>
          </div>
          <div className="grid-2">
            <label>
              지원자
              <select
                required
                value={invitation.applicantId}
                onChange={(event) => updateInvitation("applicantId", event.target.value)}
              >
                <option value="">지원자 선택</option>
                {items.map((item) => (
                  <option key={item.applicationId} value={item.applicationId}>
                    {item.name} · {item.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              응시 시작
              <input
                required
                type="datetime-local"
                value={invitation.availableFrom}
                onChange={(event) => updateInvitation("availableFrom", event.target.value)}
              />
            </label>
            <label>
              응시 종료
              <input
                required
                type="datetime-local"
                value={invitation.availableUntil}
                onChange={(event) => updateInvitation("availableUntil", event.target.value)}
              />
            </label>
            <label className="wide">
              안내 메시지
              <textarea
                required
                value={invitation.message}
                onChange={(event) => updateInvitation("message", event.target.value)}
              />
            </label>
          </div>
        </form>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>지원자 목록</h2>
              <p>지원 상태, 면접 상태, 리포트 상태를 한 곳에서 확인합니다.</p>
            </div>
            <form
              className="toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                void load(q);
              }}
            >
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="이름, 이메일 검색" />
              <button className="btn secondary" type="submit" disabled={loading}>
                조회
              </button>
            </form>
          </div>

          {message ? <p className="notice">{message}</p> : null}
          {items.length === 0 ? (
            <div className="empty">등록된 지원자가 없습니다.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>지원자</th>
                    <th>직무</th>
                    <th>지원 상태</th>
                    <th>면접</th>
                    <th>리포트</th>
                    <th>전형</th>
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.applicationId}>
                      <td>
                        <strong>{item.name}</strong>
                        <span>{item.email}</span>
                      </td>
                      <td>{item.jobRole}</td>
                      <td>
                        <StatusBadge value={item.applicationStatus} />
                      </td>
                      <td>{item.interviewStatus}</td>
                      <td>{item.report ? `${item.report.status} · ${item.report.totalScore ?? "점수 없음"}` : "없음/생성중"}</td>
                      <td>{item.screeningDecision}</td>
                      <td>
                        <Link className="text-link" href={`/company/applicants/${item.applicationId}/evaluation`}>
                          평가 상세
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
