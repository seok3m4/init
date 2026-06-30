"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { StatusBadge } from "../company-recruiting/CompanyRecruitingChrome";
import {
  createInterviewQuestion,
  deleteInterviewQuestion,
  getInterviewSettings,
  updateEvaluationCriteria,
  updateInterviewQuestion,
  updateInterviewTimePolicy
} from "./api";
import type { InterviewSettings, QuestionType } from "./types";

type CriteriaDraft = {
  draftId: string;
  criterionId?: number;
  tagId: number;
  tagName: string;
  category: string;
  description: string | null;
  weight: string;
  passScore: string;
  sortOrder: string;
};

type QuestionForm = {
  criterionId: string;
  questionType: QuestionType;
  content: string;
};

type TimePolicyDraft = {
  preparationTimeSec: string;
  answerTimeSec: string;
  retryAllowed: boolean;
};

const QUESTION_TYPE_OPTIONS: Array<{ value: QuestionType; label: string }> = [
  { value: "INTRO", label: "도입" },
  { value: "TECHNICAL", label: "기술" },
  { value: "EXPERIENCE", label: "경험" },
  { value: "SITUATION", label: "상황" },
  { value: "FOLLOW_UP", label: "꼬리질문" },
  { value: "CLOSING", label: "마무리" },
];

const initialQuestionForm: QuestionForm = {
  criterionId: "",
  questionType: "TECHNICAL",
  content: "",
};

export function CompanyInterviewSettingsPage({ postingId }: { postingId?: number }) {
  const [settings, setSettings] = useState<InterviewSettings | null>(null);
  const [criteriaDrafts, setCriteriaDrafts] = useState<CriteriaDraft[]>([]);
  const [timePolicyDraft, setTimePolicyDraft] = useState<TimePolicyDraft | null>(null);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [questionForm, setQuestionForm] = useState<QuestionForm>(initialQuestionForm);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [criteriaSaving, setCriteriaSaving] = useState(false);
  const [criteriaError, setCriteriaError] = useState("");
  const [timePolicySaving, setTimePolicySaving] = useState(false);
  const [timePolicyError, setTimePolicyError] = useState("");
  const [questionSaving, setQuestionSaving] = useState(false);
  const [questionError, setQuestionError] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setCriteriaError("");
    setTimePolicyError("");
    setQuestionError("");
    try {
      const response = await getInterviewSettings(postingId);
      setSettings(response.data);
      setCriteriaDrafts(toCriteriaDrafts(response.data));
      setTimePolicyDraft(toTimePolicyDraft(response.data));
      setSelectedTagId("");
      setEditingQuestionId(null);
      setQuestionForm({
        ...initialQuestionForm,
        criterionId: String(response.data.criteria[0]?.criterionId ?? ""),
      });
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

  const hasTimePolicyChanges = useMemo(() => {
    if (!settings || !timePolicyDraft) return false;
    return JSON.stringify(timePolicyDraft) !== JSON.stringify(toTimePolicyDraft(settings));
  }, [settings, timePolicyDraft]);

  const availableTagOptions = useMemo(() => {
    if (!settings) return [];
    const selectedTagIds = new Set(criteriaDrafts.map((criterion) => criterion.tagId));
    return settings.availableTags.filter((tag) => !selectedTagIds.has(tag.tagId));
  }, [criteriaDrafts, settings]);

  function addCriteriaDraft() {
    if (!settings || selectedTagId === "") return;

    const tag = settings.availableTags.find((item) => item.tagId === Number(selectedTagId));
    if (!tag) {
      setCriteriaError("추가할 평가 태그를 선택해주세요.");
      return;
    }

    setCriteriaError("");
    setCriteriaDrafts((current) => [
      ...current,
      {
        draftId: `new-${tag.tagId}`,
        tagId: tag.tagId,
        tagName: tag.tagName,
        category: tag.category,
        description: tag.description,
        weight: "10",
        passScore: "",
        sortOrder: String(current.length + 1),
      },
    ]);
    setSelectedTagId("");
  }

  function removeCriteriaDraft(draftId: string) {
    if (!settings) return;
    const criterion = criteriaDrafts.find((item) => item.draftId === draftId);
    const linkedQuestionCount =
      criterion?.criterionId === undefined
        ? 0
        : settings.questions.filter((question) => question.criterionId === criterion.criterionId).length;
    if (
      linkedQuestionCount > 0 &&
      !window.confirm(
        `이 평가 기준에 연결된 질문 ${linkedQuestionCount}개가 있습니다. 계속 진행하면 저장 시 연결된 질문이 비활성화됩니다. 계속하시겠습니까?`,
      )
    ) {
      return;
    }

    setCriteriaError("");
    setCriteriaDrafts((current) => current.filter((criterion) => criterion.draftId !== draftId));
  }

  function updateCriteriaDraft(draftId: string, field: "weight" | "passScore" | "sortOrder", value: string) {
    setCriteriaError("");
    setCriteriaDrafts((current) =>
      current.map((criterion) => (criterion.draftId === draftId ? { ...criterion, [field]: value } : criterion)),
    );
  }

  function resetCriteriaDrafts() {
    if (!settings) return;
    setCriteriaError("");
    setCriteriaDrafts(toCriteriaDrafts(settings));
  }

  function updateTimePolicyDraft<K extends keyof TimePolicyDraft>(field: K, value: TimePolicyDraft[K]) {
    setTimePolicyError("");
    setTimePolicyDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function resetTimePolicyDraft() {
    if (!settings) return;
    setTimePolicyError("");
    setTimePolicyDraft(toTimePolicyDraft(settings));
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
        criteria: normalizeCriteriaOrder(criteriaDrafts).map((criterion) => ({
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
          draftId: String(criterion.criterionId),
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

  async function handleTimePolicySave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || !timePolicyDraft) return;

    const validationMessage = validateTimePolicyDraft(timePolicyDraft);
    if (validationMessage) {
      setTimePolicyError(validationMessage);
      return;
    }

    setTimePolicySaving(true);
    setTimePolicyError("");
    try {
      const response = await updateInterviewTimePolicy({
        postingId: settings.posting.postingId,
        preparationTimeSec: toNumber(timePolicyDraft.preparationTimeSec),
        answerTimeSec: toNumber(timePolicyDraft.answerTimeSec),
        retryAllowed: timePolicyDraft.retryAllowed,
      });

      setSettings((current) =>
        current
          ? {
              ...current,
              timePolicy: response.data.timePolicy,
            }
          : current,
      );
      setTimePolicyDraft({
        preparationTimeSec: String(response.data.timePolicy.preparationTimeSec),
        answerTimeSec: String(response.data.timePolicy.answerTimeSec),
        retryAllowed: response.data.timePolicy.retryAllowed,
      });
    } catch (error) {
      setTimePolicyError(error instanceof Error ? error.message : "면접 시간 정책 저장에 실패했습니다.");
    } finally {
      setTimePolicySaving(false);
    }
  }

  function updateQuestionForm<K extends keyof QuestionForm>(field: K, value: QuestionForm[K]) {
    setQuestionError("");
    setQuestionForm((current) => ({ ...current, [field]: value }));
  }

  function resetQuestionEditor(nextCriterionId = questionForm.criterionId) {
    setEditingQuestionId(null);
    setQuestionForm({
      ...initialQuestionForm,
      criterionId: nextCriterionId,
    });
  }

  function startQuestionEdit(question: InterviewSettings["questions"][number]) {
    if (question.criterionId === null) {
      setQuestionError("평가 기준이 연결된 질문만 수정할 수 있습니다.");
      return;
    }
    setEditingQuestionId(question.questionId);
    setQuestionError("");
    setQuestionForm({
      criterionId: String(question.criterionId),
      questionType: question.questionType,
      content: question.content,
    });
  }

  async function handleCreateQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;

    const criterionId = Number(questionForm.criterionId);
    const content = questionForm.content.trim();
    const validationMessage = validateQuestionForm(settings, criterionId, content, editingQuestionId);
    if (validationMessage) {
      setQuestionError(validationMessage);
      return;
    }

    setQuestionSaving(true);
    setQuestionError("");
    try {
      const response =
        editingQuestionId === null
          ? await createInterviewQuestion({
              postingId: settings.posting.postingId,
              criterionId,
              questionType: questionForm.questionType,
              content,
            })
          : await updateInterviewQuestion(editingQuestionId, {
              criterionId,
              questionType: questionForm.questionType,
              content,
            });

      setSettings((current) =>
        current
          ? {
              ...current,
              questions:
                editingQuestionId === null
                  ? [...current.questions, response.data.question]
                  : current.questions.map((question) =>
                      question.questionId === response.data.question.questionId ? response.data.question : question,
                    ),
            }
          : current,
      );
      resetQuestionEditor(String(criterionId));
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "질문 저장에 실패했습니다.");
    } finally {
      setQuestionSaving(false);
    }
  }

  async function handleDeleteQuestion(questionId: number) {
    if (!window.confirm("이 질문을 삭제하시겠습니까? 삭제된 질문은 질문 뱅크 목록에서 제외됩니다.")) {
      return;
    }

    setQuestionSaving(true);
    setQuestionError("");
    try {
      await deleteInterviewQuestion(questionId);
      setSettings((current) =>
        current
          ? {
              ...current,
              questions: current.questions.filter((question) => question.questionId !== questionId),
            }
          : current,
      );
      if (editingQuestionId === questionId) {
        resetQuestionEditor();
      }
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "질문 삭제에 실패했습니다.");
    } finally {
      setQuestionSaving(false);
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

            <form className="panel" onSubmit={handleTimePolicySave}>
              <div className="panel-head">
                <div>
                  <h2>면접 시간 정책</h2>
                  <p>준비 시간, 답변 시간, 재시도 허용 여부를 공고 기준으로 조정합니다.</p>
                </div>
                <div className="toolbar">
                  <button className="btn secondary compact" type="button" disabled={!hasTimePolicyChanges || timePolicySaving} onClick={resetTimePolicyDraft}>
                    되돌리기
                  </button>
                  <button className="btn primary compact" type="submit" disabled={!hasTimePolicyChanges || timePolicySaving}>
                    {timePolicySaving ? "저장 중" : "시간 정책 저장"}
                  </button>
                </div>
              </div>
              {timePolicyError ? <p className="notice danger">{timePolicyError}</p> : null}
              {timePolicyDraft ? (
                <div className="grid-2">
                  <label>
                    준비 시간
                    <input
                      aria-label="준비 시간 초"
                      inputMode="numeric"
                      min={0}
                      max={600}
                      type="number"
                      value={timePolicyDraft.preparationTimeSec}
                      onChange={(event) => updateTimePolicyDraft("preparationTimeSec", event.target.value)}
                    />
                    <span className="field-hint">0~600초</span>
                  </label>
                  <label>
                    답변 시간
                    <input
                      aria-label="답변 시간 초"
                      inputMode="numeric"
                      min={30}
                      max={1800}
                      type="number"
                      value={timePolicyDraft.answerTimeSec}
                      onChange={(event) => updateTimePolicyDraft("answerTimeSec", event.target.value)}
                    />
                    <span className="field-hint">30~1800초, 준비 시간보다 길어야 합니다.</span>
                  </label>
                  <label>
                    <input
                      checked={timePolicyDraft.retryAllowed}
                      type="checkbox"
                      onChange={(event) => updateTimePolicyDraft("retryAllowed", event.target.checked)}
                    />
                    재시도 허용
                  </label>
                </div>
              ) : null}
            </form>

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
              <div className="toolbar">
                <select
                  aria-label="추가할 평가 태그"
                  disabled={criteriaSaving || availableTagOptions.length === 0}
                  value={selectedTagId}
                  onChange={(event) => setSelectedTagId(event.target.value)}
                >
                  <option value="">
                    {availableTagOptions.length === 0 ? "추가 가능한 태그 없음" : "평가 태그 선택"}
                  </option>
                  {availableTagOptions.map((tag) => (
                    <option key={tag.tagId} value={tag.tagId}>
                      {tag.tagName} · {tag.category}
                    </option>
                  ))}
                </select>
                <button className="btn secondary compact" type="button" disabled={selectedTagId === "" || criteriaSaving} onClick={addCriteriaDraft}>
                  기준 추가
                </button>
              </div>
              <div className="table-wrap">
                <table className="data-table criteria-table">
                  <thead>
                    <tr>
                      <th className="criteria-col-order">순서</th>
                      <th>태그</th>
                      <th>분류</th>
                      <th className="criteria-col-score">배점</th>
                      <th className="criteria-col-score">합격점</th>
                      <th>설명</th>
                      <th className="criteria-col-actions">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteriaDrafts.map((criterion) => (
                      <tr key={criterion.draftId}>
                        <td className="criteria-cell-order">
                          <input
                            aria-label={`${criterion.tagName} 순서`}
                            inputMode="numeric"
                            min={1}
                            type="number"
                            value={criterion.sortOrder}
                            onChange={(event) => updateCriteriaDraft(criterion.draftId, "sortOrder", event.target.value)}
                          />
                        </td>
                        <td>{criterion.tagName}</td>
                        <td>{criterion.category}</td>
                        <td className="criteria-cell-score">
                          <input
                            aria-label={`${criterion.tagName} 배점`}
                            inputMode="numeric"
                            min={1}
                            max={100}
                            type="number"
                            value={criterion.weight}
                            onChange={(event) => updateCriteriaDraft(criterion.draftId, "weight", event.target.value)}
                          />
                        </td>
                        <td className="criteria-cell-score">
                          <input
                            aria-label={`${criterion.tagName} 합격점`}
                            inputMode="numeric"
                            min={0}
                            max={100}
                            placeholder="-"
                            type="number"
                            value={criterion.passScore}
                            onChange={(event) => updateCriteriaDraft(criterion.draftId, "passScore", event.target.value)}
                          />
                        </td>
                        <td>
                          <span>{criterion.description ?? "설명 없음"}</span>
                        </td>
                        <td>
                          <button className="btn secondary compact" type="button" disabled={criteriaSaving} onClick={() => removeCriteriaDraft(criterion.draftId)}>
                            삭제
                          </button>
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
                  <p>평가 기준에 연결할 면접 질문을 직접 등록합니다.</p>
                </div>
              </div>
              <form className="creation-flow" onSubmit={handleCreateQuestion}>
                <div className="grid-2">
                  <label>
                    평가 기준
                    <select
                      required
                      disabled={settings.criteria.length === 0 || questionSaving}
                      value={questionForm.criterionId}
                      onChange={(event) => updateQuestionForm("criterionId", event.target.value)}
                    >
                      <option value="" disabled>
                        {settings.criteria.length === 0 ? "먼저 평가 기준을 저장해주세요" : "평가 기준 선택"}
                      </option>
                      {settings.criteria.map((criterion) => (
                        <option key={criterion.criterionId} value={criterion.criterionId}>
                          {criterion.tagName} · {criterion.category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    질문 유형
                    <select
                      disabled={questionSaving}
                      value={questionForm.questionType}
                      onChange={(event) => updateQuestionForm("questionType", event.target.value as QuestionType)}
                    >
                      {QUESTION_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid-full">
                    질문 내용
                    <textarea
                      required
                      maxLength={500}
                      placeholder="예: 최근 프로젝트에서 기술적 의사결정을 내렸던 경험을 설명해주세요."
                      value={questionForm.content}
                      onChange={(event) => updateQuestionForm("content", event.target.value)}
                    />
                    <span className="field-hint">{questionForm.content.trim().length}/500자</span>
                  </label>
                </div>
                {questionError ? <p className="notice danger">{questionError}</p> : null}
                {settings.criteria.length === 0 ? <p className="notice">질문을 등록하려면 먼저 평가 기준을 추가하고 저장해주세요.</p> : null}
                {hasCriteriaChanges ? <p className="notice">평가 기준 변경사항을 저장하면 질문 등록 대상에 반영됩니다.</p> : null}
                <div className="toolbar">
                  <button className="btn primary" type="submit" disabled={questionSaving || settings.criteria.length === 0 || hasCriteriaChanges}>
                    {questionSaving ? "저장 중" : editingQuestionId === null ? "질문 저장" : "질문 수정"}
                  </button>
                  {editingQuestionId !== null ? (
                    <button className="btn secondary" type="button" disabled={questionSaving} onClick={() => resetQuestionEditor()}>
                      수정 취소
                    </button>
                  ) : null}
                </div>
              </form>
              <div className="posting-list question-list">
                {settings.questions.map((question) => (
                  <article className="posting" key={question.questionId}>
                    <div className="logo-chip">{question.questionType}</div>
                    <div>
                      <h3>{question.content}</h3>
                      <p>{getCriterionLabel(settings, question.criterionId)}</p>
                    </div>
                    <StatusBadge value={question.isActive ? "ACTIVE" : "INACTIVE"} />
                    <div className="posting-actions">
                      <button className="btn secondary compact" type="button" disabled={questionSaving} onClick={() => startQuestionEdit(question)}>
                        수정
                      </button>
                      <button className="btn destructive compact" type="button" disabled={questionSaving} onClick={() => void handleDeleteQuestion(question.questionId)}>
                        삭제
                      </button>
                    </div>
                  </article>
                ))}
                {settings.questions.length === 0 ? (
                  <div className="empty">등록된 질문이 없습니다.</div>
                ) : null}
              </div>
            </section>
          </>
        )}
    </section>
  );
}

function validateQuestionForm(
  settings: InterviewSettings,
  criterionId: number,
  content: string,
  editingQuestionId: number | null,
) {
  if (!Number.isInteger(criterionId)) {
    return "질문을 연결할 평가 기준을 선택해주세요.";
  }
  if (!settings.criteria.some((criterion) => criterion.criterionId === criterionId)) {
    return "공고에 연결된 평가 기준을 선택해주세요.";
  }
  if (content.length < 10) {
    return "질문 내용은 10자 이상 입력해주세요.";
  }
  if (
    settings.questions.some(
      (question) =>
        question.questionId !== editingQuestionId &&
        normalizeText(question.content) === normalizeText(content),
    )
  ) {
    return "이미 등록된 질문입니다.";
  }
  return "";
}

function getCriterionLabel(settings: InterviewSettings, criterionId: number | null) {
  const criterion = settings.criteria.find((item) => item.criterionId === criterionId);
  return criterion ? `${criterion.tagName} · ${criterion.category}` : "평가 기준 미연결";
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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
    draftId: String(criterion.criterionId),
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

function toTimePolicyDraft(settings: InterviewSettings): TimePolicyDraft {
  return {
    preparationTimeSec: String(settings.timePolicy.preparationTimeSec),
    answerTimeSec: String(settings.timePolicy.answerTimeSec),
    retryAllowed: settings.timePolicy.retryAllowed,
  };
}

function validateCriteriaDrafts(criteria: CriteriaDraft[]) {
  if (criteria.length === 0) return "";

  const sortOrders = new Set<number>();
  const tagIds = new Set<number>();
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
    if (tagIds.has(criterion.tagId)) {
      return "평가 태그가 중복되었습니다.";
    }
    tagIds.add(criterion.tagId);

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

function validateTimePolicyDraft(draft: TimePolicyDraft) {
  const preparationTimeSec = toNumber(draft.preparationTimeSec);
  const answerTimeSec = toNumber(draft.answerTimeSec);

  if (!Number.isInteger(preparationTimeSec) || preparationTimeSec < 0 || preparationTimeSec > 600) {
    return "준비 시간은 0부터 600 사이의 정수로 입력해주세요.";
  }
  if (!Number.isInteger(answerTimeSec) || answerTimeSec < 30 || answerTimeSec > 1800) {
    return "답변 시간은 30부터 1800 사이의 정수로 입력해주세요.";
  }
  if (answerTimeSec <= preparationTimeSec) {
    return "답변 시간은 준비 시간보다 길어야 합니다.";
  }

  return "";
}

function toNumber(value: string) {
  return Number(value.trim());
}
