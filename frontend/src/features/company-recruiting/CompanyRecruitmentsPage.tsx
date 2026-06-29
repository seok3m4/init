"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { createRecruitment } from "./api";
import { CompanyNav } from "./CompanyRecruitingChrome";

type FormState = {
  title: string;
  jobRole: string;
  startsOn: string;
  endsOn: string;
  manager: string;
  status: "DRAFT" | "OPEN";
  jobDescription: string;
};

const initialForm: FormState = {
  title: "",
  jobRole: "",
  startsOn: "",
  endsOn: "",
  manager: "",
  status: "OPEN",
  jobDescription: "",
};

export function CompanyRecruitmentsPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [message, setMessage] = useState("");
  const [createdRecruitmentId, setCreatedRecruitmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setCreatedRecruitmentId(null);
    try {
      const result = await createRecruitment({
        title: form.title,
        jobRole: form.jobRole,
        startsOn: form.startsOn || undefined,
        endsOn: form.endsOn || undefined,
        status: form.status,
        jobDescription: form.jobDescription || undefined,
      });
      setForm(initialForm);
      setCreatedRecruitmentId(result.data.recruitmentId);
      setMessage("채용 프로젝트와 JD가 등록되었습니다.");
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
            <p>채용 프로젝트를 만들고 JD를 등록합니다.</p>
          </div>
          <Link className="btn secondary" href="/company/applications/postings">
            공고 목록
          </Link>
        </div>

        {message ? (
          <p className="notice">
            {message}
            {createdRecruitmentId ? (
              <>
                {" "}
                <Link className="text-link" href={`/company/recruitments/${createdRecruitmentId}`}>
                  상세 보기
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <form className="creation-flow" onSubmit={handleCreate}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>채용 프로젝트 생성</h2>
                <p>지원자에게 노출할 공고의 기본 정보를 입력합니다.</p>
              </div>
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
                담당자
                <input value={form.manager} onChange={(event) => updateField("manager", event.target.value)} placeholder="김민철" />
              </label>
              <label>
                공개 상태
                <select value={form.status} onChange={(event) => updateField("status", event.target.value as FormState["status"])}>
                  <option value="OPEN">OPEN</option>
                  <option value="DRAFT">DRAFT</option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>JD 등록</h2>
                <p>직무 설명을 직접 입력합니다. 파일 업로드는 추후 합의 후 연결합니다.</p>
              </div>
              <button className="btn primary" type="submit" disabled={loading}>
                생성 및 등록
              </button>
            </div>

            <div className="grid-2">
              <label>
                직무명
                <input
                  required
                  value={form.jobRole}
                  onChange={(event) => updateField("jobRole", event.target.value)}
                  placeholder="Backend Developer"
                />
              </label>
              <div className="upload-zone" aria-label="JD 파일 업로드 예정 영역">
                파일 업로드 준비중
              </div>
              <label className="wide">
                JD 직접 입력
                <textarea
                  value={form.jobDescription}
                  onChange={(event) => updateField("jobDescription", event.target.value)}
                  placeholder="담당 업무, 자격 요건, 우대 사항을 입력하세요."
                />
              </label>
            </div>
          </section>
        </form>
      </section>
    </main>
  );
}
