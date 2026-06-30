"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { getRecruitment, updateRecruitment } from "./api";
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

export function RecruitmentSettingsPage({ recruitmentId }: { recruitmentId: number }) {
  const router = useRouter();
  const [recruitment, setRecruitment] = useState<Recruitment | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [jdFileName, setJdFileName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const result = await getRecruitment(recruitmentId);
        setRecruitment(result.data);
        setForm({
          title: result.data.title,
          jobRole: result.data.jobRole,
          startsOn: result.data.startsOn ?? "",
          endsOn: result.data.endsOn ?? "",
          status: result.data.status === "DRAFT" ? "DRAFT" : "OPEN",
          jobDescription: result.data.jobDescription ?? "",
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "공고 설정을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [recruitmentId]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await updateRecruitment(recruitmentId, {
        title: form.title,
        jobRole: form.jobRole,
        startsOn: form.startsOn || undefined,
        endsOn: form.endsOn || undefined,
        status: form.status,
        jobDescription: form.jobDescription || undefined,
      });
      router.push(`/company/recruitments/${recruitmentId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공고 설정 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="app-page">
        <div className="page-head">
          <div>
            <p className="eyebrow">RECRUITMENT SETTINGS</p>
            <h1>{recruitment?.title ?? "공고 설정"}</h1>
            <p>공고 기본 정보와 JD 텍스트를 수정합니다.</p>
          </div>
          <Link className="btn secondary" href={`/company/recruitments/${recruitmentId}`}>
            대시보드
          </Link>
        </div>

        {message ? <p className="notice danger">{message}</p> : null}

        <form className="creation-flow" onSubmit={handleSave}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>기본 설정</h2>
                <p>수정 가능한 공고 정보를 저장합니다.</p>
              </div>
            </div>

            <div className="grid-2">
              <label>
                공고 제목
                <input required value={form.title} onChange={(event) => updateField("title", event.target.value)} />
              </label>
              <label>
                직무명
                <input required value={form.jobRole} onChange={(event) => updateField("jobRole", event.target.value)} />
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
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>JD 설정</h2>
                <p>파일 칸은 후속 업로드 연동 전 UI이며, 이번 저장은 텍스트 JD만 반영합니다.</p>
              </div>
            </div>

            <div className="grid-2">
              <label>
                JD 파일
                <input
                  accept=".txt,.pdf,.doc,.docx"
                  type="file"
                  onChange={(event) => setJdFileName(event.target.files?.[0]?.name ?? "")}
                />
                <span className="field-hint">{jdFileName ? `${jdFileName} 선택됨` : "파일 저장은 후속 합의 후 연결합니다."}</span>
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
          </section>

          <div className="sticky-actions">
            <button className="btn primary" type="submit" disabled={loading}>
              설정 완료
            </button>
          </div>
        </form>
    </section>
  );
}
