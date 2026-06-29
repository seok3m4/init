"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { getApplicantEvaluation, updateScreeningStatus } from "./api";
import { CompanyNav, StatusBadge } from "./CompanyRecruitingChrome";
import type { ApplicantEvaluation, ScreeningDecision } from "./types";

const decisions: ScreeningDecision[] = ["UNDECIDED", "PASS", "HOLD", "FAIL"];

export function ApplicantEvaluationPage({ applicantId }: { applicantId: number }) {
  const [evaluation, setEvaluation] = useState<ApplicantEvaluation | null>(null);
  const [decision, setDecision] = useState<ScreeningDecision>("UNDECIDED");
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const result = await getApplicantEvaluation(applicantId);
      setEvaluation(result.data);
      setDecision(result.data.screening.decision);
      setMemo(result.data.screening.memo ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "평가 상세를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [applicantId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await updateScreeningStatus(applicantId, {
        screeningDecision: decision,
        screeningMemo: memo || undefined,
      });
      setMessage("전형 상태와 메모가 저장되었습니다.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "전형 상태 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const report = evaluation?.report ?? null;

  return (
    <main className="app-shell">
      <CompanyNav active="evaluation" />
      <section className="app-page">
        <div className="page-head">
          <div>
            <p className="eyebrow">EVALUATION</p>
            <h1>{evaluation?.applicant.name ?? "지원자 평가 상세"}</h1>
            <p>{evaluation ? `${evaluation.recruitment.title} · ${evaluation.applicant.email}` : "지원자 평가 정보를 불러옵니다."}</p>
          </div>
          {evaluation ? (
            <Link className="btn secondary" href={`/company/recruitments/${evaluation.recruitment.recruitmentId}/applicants`}>
              지원자 목록
            </Link>
          ) : null}
        </div>

        {message ? <p className="notice">{message}</p> : null}

        {evaluation ? (
          <>
            <section className="kpi-row">
              <div className="kpi">
                <span>지원 상태</span>
                <strong>{evaluation.statuses.applicationStatus}</strong>
              </div>
              <div className="kpi">
                <span>면접 상태</span>
                <strong>{evaluation.statuses.interviewStatus}</strong>
              </div>
              <div className="kpi">
                <span>리포트 상태</span>
                <strong>{evaluation.statuses.reportStatus}</strong>
              </div>
            </section>

            <form className="panel" onSubmit={handleSubmit}>
              <div className="panel-head">
                <div>
                  <h2>전형 상태</h2>
                  <p>저장 가능한 값은 UNDECIDED, PASS, HOLD, FAIL입니다.</p>
                </div>
                <button className="btn primary" type="submit" disabled={loading}>
                  저장
                </button>
              </div>
              <div className="grid-2">
                <label>
                  전형 상태
                  <select value={decision} onChange={(event) => setDecision(event.target.value as ScreeningDecision)}>
                    {decisions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  수동 메모
                  <textarea value={memo} onChange={(event) => setMemo(event.target.value)} />
                </label>
              </div>
            </form>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>채용 리포트</h2>
                  <p>리포트가 없으면 없음/생성중 상태로 표시합니다.</p>
                </div>
                <StatusBadge value={report?.status ?? "NONE_OR_GENERATING"} />
              </div>

              {report ? (
                <div className="detail-stack">
                  <div className="score-summary">
                    <span>총점</span>
                    <strong>{report.totalScore ?? "점수 없음"}</strong>
                    <p>{report.summary ?? "요약이 아직 없습니다."}</p>
                  </div>
                  {report.scores.length > 0 ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>기준</th>
                            <th>점수</th>
                            <th>근거</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.scores.map((score) => (
                            <tr key={score.scoreId}>
                              <td>{score.criterionName ?? "기준 없음"}</td>
                              <td>{score.score}</td>
                              <td>
                                {score.rationale ?? "근거 없음"}
                                {score.evidences.map((evidence) => (
                                  <span key={evidence.evidenceId}>{evidence.evidenceText}</span>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty">세부 점수와 근거가 아직 없습니다.</div>
                  )}
                </div>
              ) : (
                <div className="empty">리포트가 없거나 생성 중입니다.</div>
              )}
            </section>
          </>
        ) : (
          <div className="empty">평가 상세를 불러오는 중입니다.</div>
        )}
      </section>
    </main>
  );
}
