"use client";

import type { FormEvent } from "react";
import type { CandidateFileAsset, CandidatePortfolioLink } from "./api";
import {
  type CandidatePortfolioLinkFormState,
  type CandidateResumeUploadState,
  createResumeUploadStateFromFile,
  inferPortfolioLinkType,
  isAllowedCandidateDocumentMimeType,
  maxCandidateDocumentSizeBytes,
  toCreatePortfolioLinkRequest,
  toUploadResumeRequest,
} from "./view-model";

export interface CandidateDocumentAssetsViewProps {
  candidateId: number;
  resumeState: CandidateResumeUploadState;
  portfolioState: CandidatePortfolioLinkFormState;
  latestResumeFile?: CandidateFileAsset;
  portfolioLinks?: CandidatePortfolioLink[];
  onResumeStateChange: (state: CandidateResumeUploadState) => void;
  onPortfolioStateChange: (state: CandidatePortfolioLinkFormState) => void;
  onResumeSubmit: (request: ReturnType<typeof toUploadResumeRequest>) => void | Promise<void>;
  onPortfolioSubmit: (request: ReturnType<typeof toCreatePortfolioLinkRequest>) => void | Promise<void>;
}

export function CandidateDocumentAssetsView({
  candidateId,
  resumeState,
  portfolioState,
  latestResumeFile,
  portfolioLinks = [],
  onResumeStateChange,
  onPortfolioStateChange,
  onResumeSubmit,
  onPortfolioSubmit,
}: CandidateDocumentAssetsViewProps) {
  const canSubmitResume =
    resumeState.storageKey.length > 0 &&
    resumeState.originalName.length > 0 &&
    isAllowedCandidateDocumentMimeType(resumeState.mimeType) &&
    resumeState.sizeBytes > 0 &&
    resumeState.sizeBytes <= maxCandidateDocumentSizeBytes;
  const canSubmitPortfolio = portfolioState.url.trim().length > 0;

  async function handleResumeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onResumeSubmit(toUploadResumeRequest(resumeState));
  }

  async function handlePortfolioSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onPortfolioSubmit(toCreatePortfolioLinkRequest(portfolioState));
  }

  return (
    <section aria-labelledby="candidate-documents-heading" className="candidate-feature">
      <header className="candidate-feature__header">
        <div>
          <p className="candidate-feature__eyebrow">Candidate #{candidateId}</p>
          <h1 id="candidate-documents-heading">Documents</h1>
        </div>
      </header>

      <div className="candidate-feature__split">
        <form aria-labelledby="candidate-resume-heading" className="candidate-feature__grid" onSubmit={handleResumeSubmit}>
          <h2 id="candidate-resume-heading">Resume</h2>
          <label>
            File
            <input
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  onResumeStateChange(createResumeUploadStateFromFile(candidateId, file));
                }
              }}
            />
          </label>
          <label>
            Object key
            <input
              value={resumeState.storageKey}
              onChange={(event) => onResumeStateChange({ ...resumeState, storageKey: event.currentTarget.value })}
            />
          </label>
          <label>
            Original name
            <input
              value={resumeState.originalName}
              onChange={(event) => onResumeStateChange({ ...resumeState, originalName: event.currentTarget.value })}
            />
          </label>
          <label>
            MIME type
            <select
              value={resumeState.mimeType}
              onChange={(event) =>
                onResumeStateChange({
                  ...resumeState,
                  mimeType: isAllowedCandidateDocumentMimeType(event.currentTarget.value)
                    ? event.currentTarget.value
                    : "",
                })
              }
            >
              <option value="">Select</option>
              <option value="application/pdf">PDF</option>
              <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">DOCX</option>
            </select>
          </label>
          <label>
            Size
            <input
              inputMode="numeric"
              value={resumeState.sizeBytes || ""}
              onChange={(event) =>
                onResumeStateChange({ ...resumeState, sizeBytes: toOptionalNumber(event.currentTarget.value) ?? 0 })
              }
            />
          </label>
          <button disabled={!canSubmitResume} type="submit">
            Save resume
          </button>
        </form>

        <form
          aria-labelledby="candidate-portfolio-heading"
          className="candidate-feature__grid"
          onSubmit={handlePortfolioSubmit}
        >
          <h2 id="candidate-portfolio-heading">Portfolio</h2>
          <label>
            URL
            <input
              type="url"
              value={portfolioState.url}
              onChange={(event) =>
                onPortfolioStateChange({
                  ...portfolioState,
                  url: event.currentTarget.value,
                  linkType: inferPortfolioLinkType(event.currentTarget.value),
                })
              }
            />
          </label>
          <label>
            Type
            <select
              value={portfolioState.linkType}
              onChange={(event) =>
                onPortfolioStateChange({
                  ...portfolioState,
                  linkType: event.currentTarget.value === "GITHUB" ? "GITHUB" : "PORTFOLIO",
                })
              }
            >
              <option value="PORTFOLIO">Portfolio</option>
              <option value="GITHUB">GitHub</option>
            </select>
          </label>
          <label>
            File ID
            <input
              inputMode="numeric"
              value={portfolioState.fileId ?? ""}
              onChange={(event) =>
                onPortfolioStateChange({
                  ...portfolioState,
                  fileId: toOptionalNumber(event.currentTarget.value),
                })
              }
            />
          </label>
          <label>
            Description
            <input
              value={portfolioState.description}
              onChange={(event) => onPortfolioStateChange({ ...portfolioState, description: event.currentTarget.value })}
            />
          </label>
          <button disabled={!canSubmitPortfolio} type="submit">
            Save link
          </button>
        </form>
      </div>

      <section aria-labelledby="candidate-document-assets-heading" className="candidate-feature__body">
        <h2 id="candidate-document-assets-heading">Assets</h2>
        <dl className="candidate-feature__summary">
          <div>
            <dt>Resume file ID</dt>
            <dd>{latestResumeFile?.fileId ?? "-"}</dd>
          </div>
          <div>
            <dt>Resume key</dt>
            <dd>{latestResumeFile?.storageKey ?? "-"}</dd>
          </div>
          <div>
            <dt>Portfolio links</dt>
            <dd>{portfolioLinks.length}</dd>
          </div>
        </dl>
      </section>
    </section>
  );
}

function toOptionalNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
