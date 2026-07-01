"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { bulkCreateApplicants, createApplicant, getRecruitment, inviteApplicant, listRecruitmentApplicants } from "./api";
import { Breadcrumb, StatusBadge } from "./CompanyRecruitingChrome";
import {
  buildApplicantRowsFromCsvSource,
  chunkApplicantRows,
  inferApplicantCsvMapping,
  parseApplicantCsvSource,
  type ApplicantCsvColumnMapping,
  type ApplicantCsvField,
  type CsvApplicantParseFailure,
  type ParsedApplicantCsvSource,
} from "./csv-applicants";
import { buildPaginationRange } from "./pagination";
import type { Applicant, BulkApplicantRegistrationResult, BulkCreateApplicantRowInput, PageMeta, Recruitment } from "./types";

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

const csvFieldConfigs: Array<{ key: ApplicantCsvField; label: string }> = [
  { key: "name", label: "이름" },
  { key: "email", label: "이메일" },
  { key: "jobRole", label: "지원 직무" },
  { key: "phone", label: "연락처" },
];

const applicantPageSize = 20;
const csvUploadChunkSize = 200;

type CsvUploadProgress = {
  totalChunks: number;
  currentChunk: number;
  totalRows: number;
  processedRows: number;
};

export function RecruitmentApplicantsPage({ recruitmentId }: { recruitmentId: number }) {
  const [recruitment, setRecruitment] = useState<Recruitment | null>(null);
  const [items, setItems] = useState<Applicant[]>([]);
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [invitation, setInvitation] = useState<InvitationState>(initialInvitation);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvSource, setCsvSource] = useState<ParsedApplicantCsvSource | null>(null);
  const [csvMapping, setCsvMapping] = useState<ApplicantCsvColumnMapping>({});
  const [csvRows, setCsvRows] = useState<BulkCreateApplicantRowInput[]>([]);
  const [csvParseFailures, setCsvParseFailures] = useState<CsvApplicantParseFailure[]>([]);
  const [csvResult, setCsvResult] = useState<BulkApplicantRegistrationResult | null>(null);
  const [csvUploadProgress, setCsvUploadProgress] = useState<CsvUploadProgress | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<Record<number, boolean>>({});
  const [invitedApplicants, setInvitedApplicants] = useState<Record<number, string>>({});
  const [q, setQ] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const paginationPages = buildPaginationRange({
    page: pageMeta?.page ?? page,
    totalPages: pageMeta?.totalPages ?? 0,
  });

  const load = useCallback(async (search: string, options: { clearMessage?: boolean; page?: number } = {}) => {
    const requestedPage = options.page ?? 1;
    setLoading(true);
    if (options.clearMessage !== false) {
      setMessage("");
    }
    try {
      const [detail, applicants] = await Promise.all([
        getRecruitment(recruitmentId),
        listRecruitmentApplicants(recruitmentId, { page: requestedPage, limit: applicantPageSize, q: search, sort: "updatedAt", order: "desc" }),
      ]);
      setRecruitment(detail.data);
      setItems(applicants.data.items);
      setPage(applicants.meta.page?.page ?? requestedPage);
      setPageMeta(applicants.meta.page ?? null);
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
      await load(q, { clearMessage: false, page: 1 });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "지원자 등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setCsvResult(null);
    setCsvUploadProgress(null);
    setCsvRows([]);
    setCsvParseFailures([]);
    setCsvFileName(file?.name ?? "");
    setMessage("");

    if (!file) {
      return;
    }

    try {
      const source = parseApplicantCsvSource(await file.text());
      const mapping = inferApplicantCsvMapping(source.headers);
      const parsed = buildApplicantRowsFromCsvSource(source, mapping);
      setCsvSource(source);
      setCsvMapping(mapping);
      setCsvRows(parsed.rows);
      setCsvParseFailures(parsed.failures);
    } catch {
      setCsvSource(null);
      setCsvMapping({});
      setCsvParseFailures([{ rowNumber: 1, reason: "EMPTY_FILE", message: "CSV 파일을 읽지 못했습니다." }]);
    }
  }

  async function handleCsvUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csvRows.length === 0) {
      setMessage("업로드할 수 있는 CSV 행이 없습니다.");
      return;
    }

    setLoading(true);
    setMessage("");
    setCsvResult(null);
    setCsvUploadProgress({
      totalChunks: Math.ceil(csvRows.length / csvUploadChunkSize),
      currentChunk: 0,
      totalRows: csvRows.length,
      processedRows: 0,
    });
    try {
      const chunks = chunkApplicantRows(csvRows, csvUploadChunkSize);
      const combinedResult: BulkApplicantRegistrationResult = {
        summary: {
          totalRows: csvRows.length,
          successCount: 0,
          failedCount: 0,
        },
        successes: [],
        failures: [],
      };
      let processedRows = 0;

      for (const [index, chunk] of chunks.entries()) {
        setCsvUploadProgress({
          totalChunks: chunks.length,
          currentChunk: index + 1,
          totalRows: csvRows.length,
          processedRows,
        });
        const result = await bulkCreateApplicants({ recruitmentId, applicants: chunk });
        combinedResult.successes.push(...result.data.successes);
        combinedResult.failures.push(...result.data.failures);
        combinedResult.summary.successCount = combinedResult.successes.length;
        combinedResult.summary.failedCount = combinedResult.failures.length;
        processedRows += chunk.length;
        setCsvResult({ ...combinedResult, successes: [...combinedResult.successes], failures: [...combinedResult.failures] });
        setCsvUploadProgress({
          totalChunks: chunks.length,
          currentChunk: index + 1,
          totalRows: csvRows.length,
          processedRows,
        });
      }

      if (combinedResult.summary.successCount > 0) {
        setMessage(`${combinedResult.summary.successCount}명이 등록되었습니다.`);
        await load(q, { clearMessage: false, page: 1 });
      } else {
        setMessage("등록된 지원자가 없습니다. 실패 행을 확인해주세요.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV 업로드에 실패했습니다.");
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
      await load(q, { clearMessage: false, page });
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

  function closeCsvModal() {
    setCsvOpen(false);
    setCsvFileName("");
    setCsvSource(null);
    setCsvMapping({});
    setCsvRows([]);
    setCsvParseFailures([]);
    setCsvResult(null);
    setCsvUploadProgress(null);
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = "";
    }
  }

  function openCsvFileDialog() {
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = "";
      csvFileInputRef.current.click();
    }
  }

  function updateCsvMapping(field: ApplicantCsvField, header: string) {
    if (!csvSource) {
      return;
    }
    const nextMapping = {
      ...csvMapping,
      [field]: header || undefined,
    };
    if (!header) {
      delete nextMapping[field];
    }
    const parsed = buildApplicantRowsFromCsvSource(csvSource, nextMapping);
    setCsvMapping(nextMapping);
    setCsvRows(parsed.rows);
    setCsvParseFailures(parsed.failures);
    setCsvResult(null);
    setCsvUploadProgress(null);
    setMessage("");
  }

  function downloadCsvTemplate() {
    const template = "\uFEFF이름,이메일,지원직무,연락처\n김지원,candidate@example.com,Backend,010-0000-0000\n";
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "applicants-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
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
              className="btn secondary"
              type="button"
              onClick={() => {
                setMessage("");
                setCsvOpen(true);
              }}
            >
              CSV 업로드
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
                void load(q, { page: 1 });
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
          {pageMeta && pageMeta.totalItems > 0 ? (
            <div className="pagination" aria-label="지원자 목록 페이지네이션">
              <div className="pagination-summary">
                총 {pageMeta.totalItems}명 · {pageMeta.page}/{Math.max(pageMeta.totalPages, 1)}페이지
              </div>
              <div className="pagination-actions">
                <button className="btn secondary compact" type="button" disabled={loading || pageMeta.page <= 1} onClick={() => void load(q, { page: pageMeta.page - 1 })}>
                  이전
                </button>
                {paginationPages.map((pageNumber) => (
                  <button
                    className={`page-button ${pageNumber === pageMeta.page ? "active" : ""}`}
                    key={pageNumber}
                    type="button"
                    aria-current={pageNumber === pageMeta.page ? "page" : undefined}
                    disabled={loading}
                    onClick={() => void load(q, { page: pageNumber })}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  className="btn secondary compact"
                  type="button"
                  disabled={loading || !pageMeta.hasNext}
                  onClick={() => void load(q, { page: pageMeta.page + 1 })}
                >
                  다음
                </button>
              </div>
            </div>
          ) : null}
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

        {csvOpen ? (
          <div className="modal-backdrop" role="presentation">
            <form className="modal wide-modal" onSubmit={handleCsvUpload} role="dialog" aria-modal="true" aria-labelledby="csv-applicant-title">
              <div className="modal-head">
                <div>
                  <h2 id="csv-applicant-title">CSV 업로드</h2>
                  <p>name,email,jobRole,phone 또는 한글 헤더를 지원하며 큰 파일은 200행씩 나눠 등록합니다.</p>
                </div>
                <button className="btn secondary compact" type="button" onClick={closeCsvModal}>
                  닫기
                </button>
              </div>
              {message ? <p className="notice">{message}</p> : null}

              <div className="file-drop">
                <div>
                  <span>CSV 파일 선택</span>
                  <strong>{csvFileName || "선택된 파일 없음"}</strong>
                </div>
                <div className="file-actions">
                  <button className="btn secondary compact" type="button" onClick={downloadCsvTemplate}>
                    템플릿 다운로드
                  </button>
                  <button className="btn secondary compact" type="button" onClick={openCsvFileDialog}>
                    파일 선택
                  </button>
                </div>
                <input ref={csvFileInputRef} accept=".csv,text/csv" type="file" onChange={handleCsvFileChange} />
              </div>

              {csvSource?.headers.length ? (
                <div className="csv-mapping">
                  <div>
                    <h3>컬럼 매핑</h3>
                    <p>기업 CSV 양식의 각 컬럼이 어떤 지원자 정보인지 지정합니다.</p>
                  </div>
                  <div className="csv-mapping-grid">
                    {csvFieldConfigs.map((field) => (
                      <label key={field.key}>
                        {field.label}
                        <select value={csvMapping[field.key] ?? ""} onChange={(event) => updateCsvMapping(field.key, event.target.value)}>
                          <option value="">선택</option>
                          {csvSource.headers.map((header) => (
                            <option key={`${field.key}-${header}`} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="csv-summary-grid">
                <div>
                  <span>파싱된 행</span>
                  <strong>{csvRows.length}</strong>
                </div>
                <div>
                  <span>처리 묶음</span>
                  <strong>{csvRows.length > 0 ? Math.ceil(csvRows.length / csvUploadChunkSize) : "-"}</strong>
                </div>
                <div>
                  <span>등록 성공</span>
                  <strong>{csvResult?.summary.successCount ?? "-"}</strong>
                </div>
                <div>
                  <span>등록 실패</span>
                  <strong>{(csvResult?.summary.failedCount ?? 0) + csvParseFailures.length || "-"}</strong>
                </div>
              </div>

              {csvUploadProgress ? (
                <div className="upload-progress" aria-live="polite">
                  <div>
                    <strong>
                      {csvUploadProgress.processedRows}/{csvUploadProgress.totalRows}행 처리
                    </strong>
                    <span>
                      {csvUploadProgress.currentChunk}/{csvUploadProgress.totalChunks}번째 묶음
                    </span>
                  </div>
                  <progress value={csvUploadProgress.processedRows} max={csvUploadProgress.totalRows} />
                </div>
              ) : null}

              {csvRows.length > 0 ? (
                <div className="csv-preview">
                  <h3>업로드 예정</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>행</th>
                          <th>이름</th>
                          <th>이메일</th>
                          <th>직무</th>
                          <th>연락처</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 5).map((row) => (
                          <tr key={`${row.rowNumber}-${row.email}`}>
                            <td>{row.rowNumber}</td>
                            <td>{row.name || "-"}</td>
                            <td>{row.email || "-"}</td>
                            <td>{row.jobRole || "-"}</td>
                            <td>{row.phone || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {csvRows.length > 5 ? <p className="subtle-text">외 {csvRows.length - 5}행은 업로드 시 함께 처리됩니다.</p> : null}
                </div>
              ) : null}

              {csvParseFailures.length > 0 || csvResult?.failures.length ? (
                <div className="csv-failures">
                  <h3>실패 행</h3>
                  <ul>
                    {[...csvParseFailures, ...(csvResult?.failures ?? [])].map((failure) => (
                      <li key={`${failure.rowNumber}-${failure.reason}-${failure.field ?? "row"}`}>
                        <strong>{failure.rowNumber}행</strong>
                        <span>{formatCsvFailure(failure)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {csvResult?.successes.length ? (
                <p className="notice">성공한 행: {csvResult.successes.map((success) => `${success.rowNumber}행`).join(", ")}</p>
              ) : null}

              <div className="modal-actions">
                <button className="btn primary" type="submit" disabled={loading || csvRows.length === 0}>
                  업로드
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

function formatCsvFailure(failure: CsvApplicantParseFailure | BulkApplicantRegistrationResult["failures"][number]) {
  const field = failure.field ? ` (${failure.field})` : "";
  return `${failure.message}${field}`;
}
