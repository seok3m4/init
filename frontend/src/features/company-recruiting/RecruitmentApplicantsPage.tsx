"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { createApplicant, getRecruitment, inviteApplicant, listRecruitmentApplicants } from "./api";
import { Breadcrumb, StatusBadge } from "./CompanyRecruitingChrome";
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
  availableFrom: string;
  availableUntil: string;
  message: string;
};

const initialInvitation: InvitationState = {
  availableFrom: "",
  availableUntil: "",
  message: "안녕하세요. 채용 AI 면접 응시 안내드립니다.",
};

export function RecruitmentApplicantsPage({ recruitmentId }: { recruitmentId: number }) {
  const [recruitment, setRecruitment] = useState<Recruitment | null>(null);
  const [items, setItems] = useState<Applicant[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [invitation, setInvitation] = useState<InvitationState>(initialInvitation);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<Record<number, boolean>>({});
  const [invitedApplicants, setInvitedApplicants] = useState<Record<number, string>>({});
  const [q, setQ] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (search: string, options: { clearMessage?: boolean } = {}) => {
    setLoading(true);
    if (options.clearMessage !== false) {
      setMessage("");
    }
    try {
      const [detail, applicants] = await Promise.all([
        getRecruitment(recruitmentId),
        listRecruitmentApplicants(recruitmentId, { page: 1, limit: 20, q: search, sort: "updatedAt", order: "desc" }),
      ]);
      setRecruitment(detail.data);
      setItems(applicants.data.items);
      setForm((current) => ({ ...current, jobRole: current.jobRole || detail.data.jobRole }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "지원자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [recruitmentId]);

  useEffect(() => {
    void load("");
  }, [load]);

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
      setRegisterOpen(false);
      await load("", { clearMessage: false });
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
      const selectedIds = items.filter((item) => selectedApplicantIds[item.applicationId]).map((item) => item.applicationId);
      if (selectedIds.length === 0) {
        setMessage("초대할 지원자를 선택해주세요.");
        return;
      }

      const results = await Promise.all(
        selectedIds.map((applicantId) =>
          inviteApplicant({
            applicantId,
            availableFrom: invitation.availableFrom,
            availableUntil: invitation.availableUntil,
            message: invitation.message,
          }),
        ),
      );
      setInvitedApplicants((current) => ({
        ...current,
        ...Object.fromEntries(results.map((result) => [result.data.applicationId, result.data.temporary ? "REQUESTED (임시)" : result.data.deliveryStatus])),
      }));
      setSelectedApplicantIds({});
      setInviteOpen(false);
      setMessage(`${selectedIds.length}명에게 초대 요청을 보냈습니다. 실제 이메일 발송과 면접 세션 생성은 연결 전일 수 있습니다.`);
      await load(q, { clearMessage: false });
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

  function toggleApplicant(applicationId: number, checked: boolean) {
    setSelectedApplicantIds((current) => ({ ...current, [applicationId]: checked }));
  }

  return (
    <section className="app-page glass-page">
        <div className="page-head">
          <div>
            <Breadcrumb
              items={[
                { label: "공고 목록", href: "/company/recruitments" },
                { label: recruitment?.title ?? "공고", href: `/company/recruitments/${recruitmentId}` },
                { label: "지원자 관리" },
              ]}
            />
            <h1>지원자 관리</h1>
            <p className="page-sub">같은 공고 안에서는 같은 이메일을 중복 등록할 수 없습니다.</p>
          </div>
          <div className="page-actions">
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setMessage("");
                setRegisterOpen(true);
              }}
            >
              지원자 직접 등록
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                setMessage("");
                setInviteOpen(true);
              }}
              disabled={items.length === 0}
            >
              지원자 초대
            </button>
          </div>
        </div>

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
                    <th>초대</th>
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
                      <td>{invitedApplicants[item.applicationId] ?? "미요청"}</td>
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

        {registerOpen ? (
          <div className="modal-backdrop" role="presentation">
            <form className="modal" onSubmit={handleCreate} role="dialog" aria-modal="true" aria-labelledby="register-applicant-title">
              <div className="modal-head">
                <div>
                  <h2 id="register-applicant-title">지원자 직접 등록</h2>
                  <p>등록 즉시 공고와 지원 이력이 연결됩니다.</p>
                </div>
                <button className="btn secondary compact" type="button" onClick={() => setRegisterOpen(false)}>
                  닫기
                </button>
              </div>
              {message ? <p className="notice">{message}</p> : null}
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
              <div className="modal-actions">
                <button className="btn primary" type="submit" disabled={loading}>
                  등록
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {inviteOpen ? (
          <div className="modal-backdrop" role="presentation">
            <form className="modal wide-modal" onSubmit={handleInvite} role="dialog" aria-modal="true" aria-labelledby="invite-applicant-title">
              <div className="modal-head">
                <div>
                  <h2 id="invite-applicant-title">지원자 초대</h2>
                  <p>선택한 지원자에게 응시 기간과 안내 메시지로 초대 요청을 보냅니다.</p>
                </div>
                <button className="btn secondary compact" type="button" onClick={() => setInviteOpen(false)}>
                  닫기
                </button>
              </div>

              {message ? <p className="notice">{message}</p> : null}

              <div className="invite-list" aria-label="초대할 지원자 목록">
                {items.map((item) => (
                  <label className="check-row" key={item.applicationId}>
                    <input
                      checked={Boolean(selectedApplicantIds[item.applicationId])}
                      type="checkbox"
                      onChange={(event) => toggleApplicant(item.applicationId, event.target.checked)}
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.email}</small>
                    </span>
                    <StatusBadge value={item.applicationStatus} />
                  </label>
                ))}
              </div>

              <div className="grid-2">
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

              <div className="modal-actions">
                <button className="btn primary" type="submit" disabled={loading}>
                  초대 요청하기
                </button>
              </div>
            </form>
          </div>
        ) : null}
    </section>
  );
}
