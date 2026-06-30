"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getRecruitment, listRecruitmentApplicants, updateScreeningStatus } from "./api";
import { CompanyFlowSteps, CompanyNav, StatusBadge } from "./CompanyRecruitingChrome";
import type { Applicant, Recruitment, ScreeningDecision } from "./types";

type ScreeningDraft = {
  decision: ScreeningDecision;
  memo: string;
};

const decisions: ScreeningDecision[] = ["UNDECIDED", "PASS", "HOLD", "FAIL"];

export function RecruitmentDetailPage({ recruitmentId }: { recruitmentId: number }) {
  const [recruitment, setRecruitment] = useState<Recruitment | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [screeningDrafts, setScreeningDrafts] = useState<Record<number, ScreeningDraft>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (options: { clearMessage?: boolean } = {}) => {
    setLoading(true);
    if (options.clearMessage !== false) {
      setMessage("");
    }
    try {
      const [detail, applicantList] = await Promise.all([
        getRecruitment(recruitmentId),
        listRecruitmentApplicants(recruitmentId, { page: 1, limit: 20, sort: "updatedAt", order: "desc" }),
      ]);
      setRecruitment(detail.data);
      setApplicants(applicantList.data.items);
      setScreeningDrafts(
        Object.fromEntries(
          applicantList.data.items.map((item) => [
            item.applicationId,
            {
              decision: normalizeDecision(item.screeningDecision),
              memo: item.screeningMemo ?? "",
            },
          ]),
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공고 대시보드를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [recruitmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleScreeningSave(applicant: Applicant) {
    const draft = screeningDrafts[applicant.applicationId];
    if (!draft) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await updateScreeningStatus(applicant.applicationId, {
        screeningDecision: draft.decision,
        screeningMemo: draft.memo || undefined,
      });
      setMessage(`${applicant.name} 지원자의 전형 상태가 저장되었습니다.`);
      await load({ clearMessage: false });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "전형 상태 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(applicationId: number, patch: Partial<ScreeningDraft>) {
    setScreeningDrafts((current) => ({
      ...current,
      [applicationId]: {
        decision: current[applicationId]?.decision ?? "UNDECIDED",
        memo: current[applicationId]?.memo ?? "",
        ...patch,
      },
    }));
  }

  const completedInterviews = applicants.filter((item) => isCompleted(item.interviewStatus)).length;
  const reportCompleted = applicants.filter((item) => item.report && isCompleted(item.report.status)).length;
  const completionRate = applicants.length === 0 ? 0 : Math.round((completedInterviews / applicants.length) * 100);

  return (
    <main className="app-shell">
      <CompanyNav active="postings" />
      <section className="app-page">
        <div className="page-head">
          <div>
            <p className="eyebrow">RECRUITMENT DASHBOARD</p>
            <h1>{recruitment?.title ?? "공고 대시보드"}</h1>
            <p>공고 운영 현황과 다음 전형 대상자를 확인합니다.</p>
          </div>
          <div className="page-actions">
            <Link className="btn secondary" href={`/company/recruitments/${recruitmentId}/settings`}>
              공고 설정
            </Link>
            <Link className="btn secondary" href={buildInterviewSettingsHref(recruitmentId)}>
              면접 관리
            </Link>
            <Link className="btn primary" href={`/company/recruitments/${recruitmentId}/applicants`}>
              지원자 관리
            </Link>
          </div>
        </div>
        <CompanyFlowSteps current="dashboard" />

        {message ? <p className="notice">{message}</p> : null}
        {recruitment ? (
          <>
            <section className="kpi-row">
              <div className="kpi">
                <span>지원자 수</span>
                <strong>{recruitment.applicantCount}</strong>
              </div>
              <div className="kpi">
                <span>응시 완료율</span>
                <strong>{completionRate}%</strong>
              </div>
              <div className="kpi">
                <span>리포트 생성 완료</span>
                <strong>{reportCompleted}건</strong>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>공고 정보</h2>
                  <p>
                    {recruitment.jobRole} · {formatPeriod(recruitment)}
                  </p>
                </div>
                <StatusBadge value={recruitment.status} />
              </div>
              <div className="description-box">
                {recruitment.jobDescription || "등록된 JD가 없습니다. 면접 설정은 C 역할 영역에서 별도 연결합니다."}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>다음 전형 대상자 선별</h2>
                  <p>전형 상태와 수동 메모는 B 소유 필드만 저장합니다.</p>
                </div>
              </div>

              {applicants.length === 0 ? (
                <div className="empty">등록된 지원자가 없습니다. 우측 상단의 지원자 관리에서 먼저 등록하세요.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>지원자</th>
                        <th>면접</th>
                        <th>리포트</th>
                        <th>전형 상태</th>
                        <th>메모</th>
                        <th>저장</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicants.map((item) => (
                        <tr key={item.applicationId}>
                          <td>
                            <strong>{item.name}</strong>
                            <span>{item.email}</span>
                          </td>
                          <td>{item.interviewStatus}</td>
                          <td>{item.report ? `${item.report.status} · ${item.report.totalScore ?? "점수 없음"}` : "없음/생성중"}</td>
                          <td>
                            <select
                              value={screeningDrafts[item.applicationId]?.decision ?? "UNDECIDED"}
                              onChange={(event) => updateDraft(item.applicationId, { decision: event.target.value as ScreeningDecision })}
                            >
                              {decisions.map((decision) => (
                                <option key={decision} value={decision}>
                                  {decision}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              value={screeningDrafts[item.applicationId]?.memo ?? ""}
                              onChange={(event) => updateDraft(item.applicationId, { memo: event.target.value })}
                              placeholder="수동 메모"
                            />
                          </td>
                          <td>
                            <button className="btn secondary compact" type="button" disabled={loading} onClick={() => void handleScreeningSave(item)}>
                              저장
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="empty">공고 대시보드를 불러오는 중입니다.</div>
        )}
      </section>
    </main>
  );
}

function formatPeriod(item: Recruitment) {
  if (!item.startsOn && !item.endsOn) {
    return "기간 미정";
  }
  return `${item.startsOn ?? "시작 미정"} ~ ${item.endsOn ?? "마감 미정"}`;
}

function isCompleted(value: string) {
  return ["COMPLETED", "DONE", "GENERATED"].includes(value);
}

function normalizeDecision(value: string): ScreeningDecision {
  return decisions.includes(value as ScreeningDecision) ? (value as ScreeningDecision) : "UNDECIDED";
}

export function buildInterviewSettingsHref(recruitmentId: number): `/company/interviews/settings?postingId=${number}` {
  return `/company/interviews/settings?postingId=${recruitmentId}`;
}
