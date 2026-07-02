"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { deleteRecruitment, getRecruitment, updateRecruitment } from "./api";
import { Breadcrumb } from "./CompanyRecruitingChrome";
import { JobDescriptionEditor } from "./JobDescriptionEditor";
import { PostingExtraInfoFields } from "./PostingExtraInfoFields";
import {
  composeJobDescriptionWithExtraInfo,
  createEmptyPostingExtraInfo,
  extractPostingExtraInfo,
  type PostingExtraInfo,
} from "./posting-extra-info";
import type { Recruitment } from "./types";

type FormState = {
  title: string;
  jobRole: string;
  startsOn: string;
  endsOn: string;
  status: "DRAFT" | "OPEN";
  jobDescription: string;
  extraInfo: PostingExtraInfo;
};

function createInitialForm(): FormState {
  return {
    title: "",
    jobRole: "",
    startsOn: "",
    endsOn: "",
    status: "OPEN",
    jobDescription: "",
    extraInfo: createEmptyPostingExtraInfo(),
  };
}

export function RecruitmentSettingsPage({ recruitmentId }: { recruitmentId: number }) {
  const router = useRouter();
  const [recruitment, setRecruitment] = useState<Recruitment | null>(null);
  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const [message, setMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const result = await getRecruitment(recruitmentId);
        const parsedJobDescription = extractPostingExtraInfo(result.data.jobDescription);
        setRecruitment(result.data);
        setForm({
          title: result.data.title,
          jobRole: result.data.jobRole,
          startsOn: result.data.startsOn ?? "",
          endsOn: result.data.endsOn ?? "",
          status: result.data.status === "DRAFT" ? "DRAFT" : "OPEN",
          jobDescription: parsedJobDescription.jobDescription,
          extraInfo: parsedJobDescription.extraInfo,
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
      const jobDescription = composeJobDescriptionWithExtraInfo(form.jobDescription, form.extraInfo);
      await updateRecruitment(recruitmentId, {
        title: form.title,
        jobRole: form.jobRole,
        startsOn: form.startsOn || undefined,
        endsOn: form.endsOn || undefined,
        status: form.status,
        jobDescription: jobDescription || undefined,
      });
      router.push(`/company/recruitments/${recruitmentId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공고 설정 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!recruitment) {
      return;
    }

    setLoading(true);
    setDeleteError("");
    try {
      await deleteRecruitment(recruitment.recruitmentId);
      router.push("/company/recruitments");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "공고 삭제에 실패했습니다.");
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
                { label: recruitment?.title ?? "공고", href: `/company/recruitments/${recruitmentId}` },
                { label: "공고 설정" },
              ]}
            />
            <h1>공고 설정</h1>
          </div>
          <div className="page-actions">
            {recruitment && canDeleteRecruitment(recruitment.status) ? (
              <button
                className="btn destructive"
                type="button"
                disabled={loading}
                onClick={() => {
                  setMessage("");
                  setDeleteError("");
                  setDeleteOpen(true);
                }}
              >
                공고 삭제
              </button>
            ) : null}
            <Link className="btn secondary" href={`/company/recruitments/${recruitmentId}`}>
              대시보드
            </Link>
          </div>
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
                <h2>추가 공고 정보</h2>
                <p>필요한 항목만 선택해서 지원자에게 보여줄 조건을 입력합니다.</p>
              </div>
            </div>
            <PostingExtraInfoFields
              value={form.extraInfo}
              disabled={loading}
              onChange={(value) => updateField("extraInfo", value)}
            />
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

          <div className="sticky-actions">
            <button className="btn primary" type="submit" disabled={loading}>
              설정 완료
            </button>
          </div>
        </form>

        {deleteOpen && recruitment ? (
          <div className="modal-backdrop" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-recruitment-title">
              <div className="modal-head">
                <div>
                  <h2 id="delete-recruitment-title">공고 삭제</h2>
                  <p>삭제하면 공고 목록에서 숨겨지고 상태가 ARCHIVED로 변경됩니다.</p>
                </div>
                <button className="btn secondary compact" type="button" disabled={loading} onClick={() => setDeleteOpen(false)}>
                  닫기
                </button>
              </div>
              {deleteError ? <p className="notice danger">{deleteError}</p> : null}
              <div className="confirm-box">
                <strong>{recruitment.title}</strong>
                <span>
                  {recruitment.jobRole} · {formatPeriod(recruitment)}
                </span>
              </div>
              <div className="modal-actions split-actions">
                <button className="btn secondary" type="button" disabled={loading} onClick={() => setDeleteOpen(false)}>
                  취소
                </button>
                <button className="btn primary danger" type="button" disabled={loading} onClick={() => void handleDeleteConfirmed()}>
                  삭제
                </button>
              </div>
            </div>
          </div>
        ) : null}
    </section>
  );
}

function formatPeriod(item: Recruitment) {
  if (!item.startsOn && !item.endsOn) {
    return "기간 미정";
  }
  return `${item.startsOn ?? "시작 미정"} ~ ${item.endsOn ?? "마감 미정"}`;
}

function canDeleteRecruitment(status: Recruitment["status"]) {
  return status === "DRAFT" || status === "CLOSED";
}
