"use client";

import { useCallback, useEffect, useState } from "react";

import { StatusBadge } from "../company-recruiting/CompanyRecruitingChrome";
import { getInterviewSettings } from "./api";
import type { InterviewSettings } from "./types";

export function CompanyInterviewSettingsPage({ postingId }: { postingId?: number }) {
  const [settings, setSettings] = useState<InterviewSettings | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await getInterviewSettings(postingId);
      setSettings(response.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "면접 설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [postingId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return (
    <section className="app-page">
        <div className="page-head">
          <div>
            <p className="eyebrow">INTERVIEW SETTINGS</p>
            <h1>면접 관리</h1>
            <p>공고별 평가 기준, 질문 뱅크, 면접 시간을 확인합니다.</p>
          </div>
          <button className="btn secondary" type="button" disabled={loading} onClick={() => void loadSettings()}>
            새로고침
          </button>
        </div>

        {message ? <p className="notice">{message}</p> : null}

        {!settings ? (
          <section className="panel">
            <div className="empty">{loading ? "불러오는 중입니다." : "표시할 면접 설정이 없습니다."}</div>
          </section>
        ) : (
          <>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>{settings.posting.title}</h2>
                  <p>공고 ID {settings.posting.postingId}</p>
                </div>
                <StatusBadge value={settings.posting.status} />
              </div>
              <div className="kpi-row">
                <Metric label="평가 기준" value={settings.criteria.length} />
                <Metric label="질문" value={settings.questions.length} />
                <Metric label="준비 시간" value={`${settings.timePolicy.preparationTimeSec}초`} />
                <Metric label="답변 시간" value={`${settings.timePolicy.answerTimeSec}초`} />
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>평가 기준</h2>
                  <p>배점과 합격 기준을 공고 기준으로 확인합니다.</p>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>순서</th>
                      <th>태그</th>
                      <th>분류</th>
                      <th>배점</th>
                      <th>합격점</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.criteria.map((criterion) => (
                      <tr key={criterion.criterionId}>
                        <td>{criterion.sortOrder}</td>
                        <td>{criterion.tagName}</td>
                        <td>{criterion.category}</td>
                        <td>{criterion.weight}</td>
                        <td>{criterion.passScore ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>질문 뱅크</h2>
                  <p>활성 질문과 연결된 평가 기준을 확인합니다.</p>
                </div>
              </div>
              <div className="posting-list">
                {settings.questions.map((question) => (
                  <article className="posting" key={question.questionId}>
                    <div className="logo-chip">{question.questionType}</div>
                    <div>
                      <h3>{question.content}</h3>
                      <p>평가 기준 ID {question.criterionId ?? "-"}</p>
                    </div>
                    <StatusBadge value={question.isActive ? "ACTIVE" : "INACTIVE"} />
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
