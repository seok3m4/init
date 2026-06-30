"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { StatusBadge } from "../company-recruiting/CompanyRecruitingChrome";
import { getInterviewSettings, updateEvaluationCriteria } from "./api";
import type { InterviewSettings } from "./types";

type CriteriaDraft = {
  criterionId: number;
  tagId: number;
  tagName: string;
  category: string;
  description: string | null;
  weight: string;
  passScore: string;
  sortOrder: string;
};

export function CompanyInterviewSettingsPage({ postingId }: { postingId?: number }) {
  const [settings, setSettings] = useState<InterviewSettings | null>(null);
  const [criteriaDrafts, setCriteriaDrafts] = useState<CriteriaDraft[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [criteriaSaving, setCriteriaSaving] = useState(false);
  const [criteriaError, setCriteriaError] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setCriteriaError("");
    try {
      const response = await getInterviewSettings(postingId);
      setSettings(response.data);
      setCriteriaDrafts(toCriteriaDrafts(response.data));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "면접 설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [postingId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const criteriaTotalWeight = useMemo(
    () => criteriaDrafts.reduce((sum, criterion) => sum + toNumber(criterion.weight), 0),
    [criteriaDrafts],
  );

  const hasCriteriaChanges = useMemo(() => {
    if (!settings) return false;
    return JSON.stringify(criteriaDrafts) !== JSON.stringify(toCriteriaDrafts(settings));
  }, [criteriaDrafts, settings]);

  function updateCriteriaDraft(criterionId: number, field: "weight" | "passScore" | "sortOrder", value: string) {
    setCriteriaError("");
    setCriteriaDrafts((current) =>
      current.map((criterion) => (criterion.criterionId === criterionId ? { ...criterion, [field]: value } : criterion)),
    );
  }

  function resetCriteriaDrafts() {
    if (!settings) return;
    setCriteriaError("");
    setCriteriaDrafts(toCriteriaDrafts(settings));
  }

  async function handleCriteriaSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;

    const validationMessage = validateCriteriaDrafts(criteriaDrafts);
    if (validationMessage) {
      setCriteriaError(validationMessage);
      return;
    }

    setCriteriaSaving(true);
    setCriteriaError("");
    try {
      const response = await updateEvaluationCriteria({
        postingId: settings.posting.postingId,
        criteria: criteriaDrafts.map((criterion) => ({
          criterionId: criterion.criterionId,
          tagId: criterion.tagId,
          weight: toNumber(criterion.weight),
          passScore: criterion.passScore.trim() === "" ? null : toNumber(criterion.passScore),
          sortOrder: toNumber(criterion.sortOrder),
        })),
      });

      setSettings((current) =>
        current
          ? {
              ...current,
              criteria: response.data.criteria,
            }
          : current,
      );
      setCriteriaDrafts(
        response.data.criteria.map((criterion) => ({
          criterionId: criterion.criterionId,
          tagId: criterion.tagId,
          tagName: criterion.tagName,
          category: criterion.category,
          description: criterion.description,
          weight: String(criterion.weight),
          passScore: criterion.passScore === null ? "" : String(criterion.passScore),
          sortOrder: String(criterion.sortOrder),
        })),
      );
    } catch (error) {
      setCriteriaError(error instanceof Error ? error.message : "평가 기준 저장에 실패했습니다.");
    } finally {
      setCriteriaSaving(false);
    }
  }

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

            <form className="panel" onSubmit={handleCriteriaSave}>
              <div className="panel-head">
                <div>
                  <h2>평가 기준</h2>
                  <p>배점, 합격점, 표시 순서를 공고 기준으로 조정합니다.</p>
                </div>
                <div className="toolbar">
                  <span className={`badge ${criteriaTotalWeight > 0 && criteriaTotalWeight <= 100 ? "info" : "danger"}`}>
                    배점 합계 {criteriaTotalWeight}
                  </span>
                  <button className="btn secondary compact" type="button" disabled={!hasCriteriaChanges || criteriaSaving} onClick={resetCriteriaDrafts}>
                    되돌리기
                  </button>
                  <button className="btn primary compact" type="submit" disabled={!hasCriteriaChanges || criteriaSaving}>
                    {criteriaSaving ? "저장 중" : "평가 기준 저장"}
                  </button>
                </div>
              </div>
              {criteriaError ? <p className="notice danger">{criteriaError}</p> : null}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>순서</th>
                      <th>태그</th>
                      <th>분류</th>
                      <th>배점</th>
                      <th>합격점</th>
                      <th>설명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteriaDrafts.map((criterion) => (
                      <tr key={criterion.criterionId}>
                        <td>
                          <input
                            aria-label={`${criterion.tagName} 순서`}
                            inputMode="numeric"
                            min={1}
                            type="number"
                            value={criterion.sortOrder}
                            onChange={(event) => updateCriteriaDraft(criterion.criterionId, "sortOrder", event.target.value)}
                          />
                        </td>
                        <td>{criterion.tagName}</td>
                        <td>{criterion.category}</td>
                        <td>
                          <input
                            aria-label={`${criterion.tagName} 배점`}
                            inputMode="numeric"
                            min={1}
                            max={100}
                            type="number"
                            value={criterion.weight}
                            onChange={(event) => updateCriteriaDraft(criterion.criterionId, "weight", event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`${criterion.tagName} 합격점`}
                            inputMode="numeric"
                            min={0}
                            max={100}
                            placeholder="-"
                            type="number"
                            value={criterion.passScore}
                            onChange={(event) => updateCriteriaDraft(criterion.criterionId, "passScore", event.target.value)}
                          />
                        </td>
                        <td>
                          <span>{criterion.description ?? "설명 없음"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </form>

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

function toCriteriaDrafts(settings: InterviewSettings): CriteriaDraft[] {
  return settings.criteria.map((criterion) => ({
    criterionId: criterion.criterionId,
    tagId: criterion.tagId,
    tagName: criterion.tagName,
    category: criterion.category,
    description: criterion.description,
    weight: String(criterion.weight),
    passScore: criterion.passScore === null ? "" : String(criterion.passScore),
    sortOrder: String(criterion.sortOrder),
  }));
}

function validateCriteriaDrafts(criteria: CriteriaDraft[]) {
  if (criteria.length === 0) return "";

  const sortOrders = new Set<number>();
  let totalWeight = 0;

  for (const criterion of criteria) {
    const sortOrder = toNumber(criterion.sortOrder);
    const weight = toNumber(criterion.weight);
    const passScore = criterion.passScore.trim() === "" ? null : toNumber(criterion.passScore);

    if (!Number.isInteger(sortOrder) || sortOrder < 1) {
      return "평가 기준 순서는 1 이상의 정수로 입력해주세요.";
    }
    if (sortOrders.has(sortOrder)) {
      return "평가 기준 순서가 중복되었습니다.";
    }
    sortOrders.add(sortOrder);

    if (!Number.isInteger(weight) || weight < 1 || weight > 100) {
      return "배점은 1부터 100 사이의 정수로 입력해주세요.";
    }
    if (passScore !== null && (!Number.isInteger(passScore) || passScore < 0 || passScore > 100)) {
      return "합격점은 비워두거나 0부터 100 사이의 정수로 입력해주세요.";
    }

    totalWeight += weight;
  }

  if (totalWeight <= 0 || totalWeight > 100) {
    return "배점 합계는 1부터 100 사이여야 합니다.";
  }

  return "";
}

function toNumber(value: string) {
  return Number(value.trim());
}
