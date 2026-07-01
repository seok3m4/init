"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { createRecruitment } from "./api";
import { Breadcrumb } from "./CompanyRecruitingChrome";
import { JobDescriptionEditor } from "./JobDescriptionEditor";
import { buildInterviewSettingsHref } from "./routes";

type FormState = {
  title: string;
  jobRole: string;
  startsOn: string;
  endsOn: string;
  jobDescription: string;
};

const initialForm: FormState = {
  title: "",
  jobRole: "",
  startsOn: "",
  endsOn: "",
  jobDescription: "",
};

export function RecruitmentCreatePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await createRecruitment({
        title: form.title,
        jobRole: form.jobRole,
        startsOn: form.startsOn || undefined,
        endsOn: form.endsOn || undefined,
        status: "DRAFT",
        jobDescription: form.jobDescription || undefined,
      });
      router.push(buildInterviewSettingsHref(result.data.recruitmentId));
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
    <section className="app-page glass-page">
        <div className="page-head">
          <div>
            <Breadcrumb
              items={[
                { label: "공고 목록", href: "/company/recruitments" },
                { label: "공고 생성" },
              ]}
            />
            <h1>공고 생성</h1>
          </div>
          <Link className="btn secondary" href="/company/recruitments">
            공고 목록
          </Link>
        </div>

        {message ? <p className="notice danger">{message}</p> : null}

        <form className="creation-flow" onSubmit={handleCreate}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>기본 정보</h2>
              </div>
            </div>

            <div className="grid-2">
              <label>
                공고 제목
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
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>JD 등록</h2>
              </div>
            </div>

            <div className="creation-flow">
              <div className="wide form-field">
                <JobDescriptionEditor
                  value={form.jobDescription}
                  disabled={loading}
                  onChange={(value) => updateField("jobDescription", value)}
                />
              </div>
            </div>
          </section>

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={loading}>
              다음
            </button>
          </div>
        </form>
    </section>
  );
}
