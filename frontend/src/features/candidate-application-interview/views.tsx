"use client";

import type { FormEvent, ReactNode } from "react";
import type {
  CandidateJobDetail,
  CandidateJobListPostingStatus,
  CandidateJobQuery,
  CandidateJobSummary,
  ConsentType,
} from "./api";
import { candidateApplicationInterviewRoutes } from "./routes";
import {
  type CandidateApplicationFormState,
  getCandidateJobDetailActionHref,
  getCandidateJobActionHref,
  hasPortfolioArtifact,
  hasRequiredConsents,
  isJobApplyEnabled,
  requiredApplicationConsents,
  toSubmitApplicationRequest,
} from "./view-model";

export interface CandidateJobsViewProps {
  jobs: CandidateJobSummary[];
  query: CandidateJobQuery;
  totalItems: number;
  onQueryChange: (query: CandidateJobQuery) => void;
}

export function CandidateJobsView({ jobs, query, totalItems, onQueryChange }: CandidateJobsViewProps) {
  return (
    <section aria-labelledby="candidate-jobs-heading" className="candidate-feature">
      <header className="candidate-feature__header">
        <div>
          <p className="candidate-feature__eyebrow">지원 가능한 공고 {totalItems}건</p>
          <h1 id="candidate-jobs-heading">채용공고</h1>
        </div>
      </header>

      <form
        className="candidate-feature__filters"
        onSubmit={(event) => {
          event.preventDefault();
          onQueryChange({ ...query, page: 1 });
        }}
      >
        <label>
          검색어
          <input
            name="q"
            value={query.q ?? ""}
            onChange={(event) => onQueryChange({ ...query, q: event.currentTarget.value, page: 1 })}
          />
        </label>
        <label>
          직무
          <input
            name="jobRole"
            value={query.jobRole ?? ""}
            onChange={(event) => onQueryChange({ ...query, jobRole: event.currentTarget.value, page: 1 })}
          />
        </label>
        <label>
          직군
          <input
            name="jobGroup"
            value={query.jobGroup ?? ""}
            onChange={(event) => onQueryChange({ ...query, jobGroup: event.currentTarget.value, page: 1 })}
          />
        </label>
        <label>
          지역
          <input
            name="location"
            value={query.location ?? ""}
            onChange={(event) => onQueryChange({ ...query, location: event.currentTarget.value, page: 1 })}
          />
        </label>
        <label>
          경력
          <input
            name="careerLevel"
            value={query.careerLevel ?? ""}
            onChange={(event) => onQueryChange({ ...query, careerLevel: event.currentTarget.value, page: 1 })}
          />
        </label>
        <label>
          상태
          <select
            name="postingStatus"
            value={query.postingStatus ?? ""}
            onChange={(event) =>
              onQueryChange({
                ...query,
                postingStatus: toOptionalPostingStatus(event.currentTarget.value),
                page: 1,
              })
            }
          >
            <option value="">전체</option>
            <option value="OPEN">공개</option>
            <option value="CLOSING_SOON">마감 임박</option>
          </select>
        </label>
        <button type="submit">검색</button>
      </form>

      <div className="candidate-feature__list" role="list">
        {jobs.map((job) => (
          <article className="candidate-jobcard" key={job.jobId} role="listitem">
            <div>
              <p className="candidate-jobcard__company">{job.companyName}</p>
              <h2>{job.title}</h2>
            </div>
            <dl className="candidate-jobcard__meta">
              <MetaItem label="직군" value={job.jobGroup} />
              <MetaItem label="직무" value={job.jobRole} />
              <MetaItem label="지역" value={job.location} />
              <MetaItem label="경력" value={job.careerLevel} />
              <MetaItem label="마감" value={job.endsOn} />
            </dl>
            <div className="candidate-jobcard__actions">
              <StatusBadge status={job.postingStatus} />
              <a aria-disabled={!isJobApplyEnabled(job)} href={getCandidateJobActionHref(job)}>
                {isJobApplyEnabled(job) ? "지원하기" : "상세보기"}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export interface CandidateJobDetailViewProps {
  job: CandidateJobDetail;
}

export function CandidateJobDetailView({ job }: CandidateJobDetailViewProps) {
  const actionHref = getCandidateJobDetailActionHref(job);

  return (
    <section aria-labelledby="candidate-job-detail-heading" className="candidate-feature">
      <header className="candidate-feature__header">
        <div>
          <p className="candidate-feature__eyebrow">{job.companyName}</p>
          <h1 id="candidate-job-detail-heading">{job.title}</h1>
        </div>
        <a aria-disabled={!actionHref} href={actionHref}>
          {job.alreadyApplied ? "지원 완료" : "지원하기"}
        </a>
      </header>

      <dl className="candidate-feature__summary">
        <MetaItem label="회사" value={job.companyName} />
        <MetaItem label="산업" value={job.companyIndustry} />
        <MetaItem label="직군" value={job.jobGroup} />
        <MetaItem label="직무" value={job.jobRole} />
        <MetaItem label="지역" value={job.location} />
        <MetaItem label="경력" value={job.careerLevel} />
        <MetaItem label="고용형태" value={job.employmentType} />
        <MetaItem label="접수기간" value={`${job.startsOn} - ${job.endsOn}`} />
        <MetaItem label="상태" value={<StatusBadge status={job.postingStatus} />} />
      </dl>

      <section aria-labelledby="candidate-job-description-heading" className="candidate-feature__body">
        <p>{job.companyProfile}</p>
        <h2 id="candidate-job-description-heading">JD</h2>
        <p>{job.jobDescription}</p>
        <ul className="candidate-feature__tags">
          {job.techStacks.map((techStack) => (
            <li key={techStack}>{techStack}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}

export interface CandidateApplicationViewProps {
  job: CandidateJobDetail;
  state: CandidateApplicationFormState;
  onStateChange: (state: CandidateApplicationFormState) => void;
  onSubmit: (request: ReturnType<typeof toSubmitApplicationRequest>) => void | Promise<void>;
}

export function CandidateApplicationView({ job, state, onStateChange, onSubmit }: CandidateApplicationViewProps) {
  const canSubmit =
    Boolean(state.resumeFileId) &&
    hasPortfolioArtifact(state) &&
    hasRequiredConsents(state.consentTypes) &&
    job.canApply &&
    !job.alreadyApplied;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(toSubmitApplicationRequest(state));
  }

  return (
    <form aria-labelledby="candidate-application-heading" className="candidate-feature" onSubmit={handleSubmit}>
      <header className="candidate-feature__header">
        <div>
          <p className="candidate-feature__eyebrow">{job.companyName}</p>
          <h1 id="candidate-application-heading">{job.title} 지원서</h1>
        </div>
      </header>

      <dl className="candidate-feature__summary">
        <MetaItem label="직군" value={job.jobGroup} />
        <MetaItem label="직무" value={job.jobRole} />
        <MetaItem label="지역" value={job.location} />
        <MetaItem label="마감" value={job.endsOn} />
      </dl>

      <section aria-labelledby="candidate-basic-info-heading" className="candidate-feature__grid">
        <h2 id="candidate-basic-info-heading">기본 정보</h2>
        <label>
          이름
          <input
            required
            value={state.candidateName}
            onChange={(event) => onStateChange({ ...state, candidateName: event.currentTarget.value })}
          />
        </label>
        <label>
          이메일
          <input
            required
            type="email"
            value={state.email}
            onChange={(event) => onStateChange({ ...state, email: event.currentTarget.value })}
          />
        </label>
        <label>
          연락처
          <input
            required
            value={state.phone}
            onChange={(event) => onStateChange({ ...state, phone: event.currentTarget.value })}
          />
        </label>
      </section>

      <section aria-labelledby="candidate-document-heading" className="candidate-feature__grid">
        <h2 id="candidate-document-heading">서류</h2>
        <label>
          이력서 파일 ID
          <input
            required
            inputMode="numeric"
            value={state.resumeFileId ?? ""}
            onChange={(event) => onStateChange({ ...state, resumeFileId: toOptionalNumber(event.currentTarget.value) })}
          />
        </label>
        <label>
          포트폴리오 파일 ID
          <input
            inputMode="numeric"
            value={state.portfolioFileId ?? ""}
            onChange={(event) =>
              onStateChange({ ...state, portfolioFileId: toOptionalNumber(event.currentTarget.value) })
            }
          />
        </label>
        <label>
          포트폴리오 URL
          <input
            type="url"
            value={state.portfolioUrl ?? ""}
            onChange={(event) => onStateChange({ ...state, portfolioUrl: event.currentTarget.value })}
          />
        </label>
      </section>

      <section aria-labelledby="candidate-cover-letter-heading" className="candidate-feature__body">
        <h2 id="candidate-cover-letter-heading">자기소개</h2>
        <textarea
          value={state.coverLetter ?? ""}
          onChange={(event) => onStateChange({ ...state, coverLetter: event.currentTarget.value })}
        />
      </section>

      <fieldset className="candidate-feature__checks">
        <legend>동의</legend>
        {requiredApplicationConsents.map((consentType) => (
          <label key={consentType}>
            <input
              checked={state.consentTypes.includes(consentType)}
              type="checkbox"
              onChange={() => onStateChange({ ...state, consentTypes: toggleConsent(state.consentTypes, consentType) })}
            />
            {consentLabel[consentType]}
          </label>
        ))}
      </fieldset>

      <footer className="candidate-feature__toolbar">
        <a href={candidateApplicationInterviewRoutes.jobDetail(job.jobId)}>공고로 돌아가기</a>
        <button disabled={!canSubmit} type="submit">
          제출
        </button>
      </footer>
    </form>
  );
}

function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: CandidateJobSummary["postingStatus"] }) {
  return <span data-status={status}>{statusLabel[status]}</span>;
}

function toOptionalNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function toOptionalPostingStatus(value: string): CandidateJobListPostingStatus | undefined {
  return value === "OPEN" || value === "CLOSING_SOON" ? value : undefined;
}

function toggleConsent(consentTypes: ConsentType[], consentType: ConsentType): ConsentType[] {
  return consentTypes.includes(consentType)
    ? consentTypes.filter((current) => current !== consentType)
    : [...consentTypes, consentType];
}

const statusLabel: Record<CandidateJobSummary["postingStatus"], string> = {
  DRAFT: "비공개",
  OPEN: "공개",
  CLOSING_SOON: "마감 임박",
  CLOSED: "마감",
  ARCHIVED: "보관",
};

const consentLabel: Record<ConsentType, string> = {
  PRIVACY_COLLECTION: "개인정보 수집 및 이용",
  AI_DOCUMENT_ANALYSIS: "AI 서류 분석",
  AI_INTERVIEW_RECORDING: "AI 면접 녹화",
};
