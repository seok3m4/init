"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  getPublicRecruitment,
  submitPublicApplication,
  type PublicApplicationInput,
  type PublicRecruitment,
} from "./public-application-api";

type AsyncState<T> = {
  data?: T;
  loading: boolean;
  error?: string;
};

const initialForm: PublicApplicationInput = {
  name: "",
  email: "",
  phone: "",
  portfolioUrl: "",
  resumeText: "",
  consentAgreed: false,
};

export function PublicRecruitmentApplyPage({ recruitmentId }: { recruitmentId: number }) {
  const [state, setState] = useState<AsyncState<PublicRecruitment>>({ loading: true });
  const [form, setForm] = useState<PublicApplicationInput>(initialForm);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const loadRecruitment = useCallback(async () => {
    setState({ loading: true });
    try {
      const result = await getPublicRecruitment(recruitmentId);
      setState({ data: result.data, loading: false });
    } catch (error) {
      setState({ loading: false, error: toErrorMessage(error) });
    }
  }, [recruitmentId]);

  useEffect(() => {
    void loadRecruitment();
  }, [loadRecruitment]);

  const canSubmit = useMemo(() => {
    return Boolean(form.name.trim() && form.email.trim() && form.consentAgreed && !busy && state.data);
  }, [busy, form.consentAgreed, form.email, form.name, state.data]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state.data) return;

    setBusy(true);
    setMessage("");
    try {
      const result = await submitPublicApplication(recruitmentId, {
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: emptyToUndefined(form.phone),
        portfolioUrl: emptyToUndefined(form.portfolioUrl),
        resumeText: emptyToUndefined(form.resumeText),
      });
      setSubmittedEmail(result.data.email);
      setMessage(
        result.data.temporary
          ? "지원서가 접수되었습니다. 이메일 인증과 매직 링크 발송은 현재 임시 처리 상태입니다."
          : "지원서가 접수되었습니다. 이메일 확인 후 지원 현황과 면접 안내를 확인할 수 있습니다.",
      );
      setForm(initialForm);
    } catch (error) {
      setMessage(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="app-page glass-page">
        <header className="page-head">
          <div>
            <p className="eyebrow">PUBLIC APPLICATION</p>
            <h1>{state.data?.title ?? "공개 지원"}</h1>
            <p className="page-sub">
              {state.data ? `${state.data.companyName} · ${state.data.jobRole}` : "공개 지원 공고 정보를 불러오고 있습니다."}
            </p>
          </div>
          <a className="btn secondary" href="/">
            INIT 홈
          </a>
        </header>

        {state.loading ? <p className="notice">공고 정보를 불러오는 중입니다.</p> : null}
        {state.error ? <p className="notice danger">{state.error}</p> : null}
        {message ? <p className={submittedEmail ? "notice" : "notice danger"}>{message}</p> : null}

        {state.data ? (
          <div className="grid-2">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>공고 정보</h2>
                  <p>지원 전 공고 내용을 확인해주세요.</p>
                </div>
              </div>
              <dl className="detail-list">
                <DetailItem label="회사" value={state.data.companyName} />
                <DetailItem label="직무" value={state.data.jobRole} />
                <DetailItem label="채용 기간" value={formatDateRange(state.data.startsOn, state.data.endsOn)} />
                <DetailItem label="경력" value={state.data.careerRequirement} />
                <DetailItem label="학력" value={state.data.educationRequirement} />
                <DetailItem label="급여" value={state.data.salaryInfo} />
                <DetailItem label="근무지역" value={state.data.workLocation} />
                <DetailItem label="근무형태" value={state.data.employmentType} />
              </dl>
              <div className="description-box">
                {state.data.jobDescription ? (
                  <div dangerouslySetInnerHTML={{ __html: state.data.jobDescription }} />
                ) : (
                  "등록된 JD가 없습니다."
                )}
              </div>
            </section>

            <form aria-label="공개 지원 폼" className="panel" onSubmit={handleSubmit}>
              <div className="panel-head">
                <div>
                  <h2>지원 정보</h2>
                  <p>접수 후 이메일 인증과 지원 현황 안내가 이어집니다.</p>
                </div>
              </div>
              <div className="creation-flow">
                <label>
                  이름 *
                  <input
                    required
                    value={form.name}
                    placeholder="김지원"
                    onChange={(event) => setForm((current) => ({ ...current, name: event.currentTarget.value }))}
                  />
                </label>
                <label>
                  이메일 *
                  <input
                    required
                    type="email"
                    value={form.email}
                    placeholder="jiwon@example.com"
                    onChange={(event) => setForm((current) => ({ ...current, email: event.currentTarget.value }))}
                  />
                </label>
                <label>
                  연락처
                  <input
                    value={form.phone ?? ""}
                    placeholder="010-0000-0000"
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.currentTarget.value }))}
                  />
                </label>
                <label>
                  포트폴리오 URL
                  <input
                    type="url"
                    value={form.portfolioUrl ?? ""}
                    placeholder="https://github.com/jiwon"
                    onChange={(event) => setForm((current) => ({ ...current, portfolioUrl: event.currentTarget.value }))}
                  />
                </label>
                <label>
                  자기소개 / 추가 설명
                  <textarea
                    value={form.resumeText ?? ""}
                    placeholder="지원 직무와 관련된 경험, 프로젝트, 강조하고 싶은 내용을 입력해주세요."
                    onChange={(event) => setForm((current) => ({ ...current, resumeText: event.currentTarget.value }))}
                  />
                </label>
                <label>
                  <span className="inline-check">
                    <input
                      checked={form.consentAgreed}
                      type="checkbox"
                      onChange={(event) => setForm((current) => ({ ...current, consentAgreed: event.currentTarget.checked }))}
                    />
                    개인정보 수집 및 채용 절차 이용에 동의합니다.
                  </span>
                </label>
                <div className="form-actions">
                  <button className="btn primary" disabled={!canSubmit} type="submit">
                    {busy ? "제출 중" : "지원서 제출"}
                  </button>
                </div>
              </div>
            </form>
          </div>
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

function formatDateRange(startsOn: string | null, endsOn: string | null) {
  if (!startsOn && !endsOn) return "상시";
  if (startsOn && endsOn) return `${startsOn} - ${endsOn}`;
  return startsOn ? `${startsOn}부터` : `${endsOn}까지`;
}

function emptyToUndefined(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
}
