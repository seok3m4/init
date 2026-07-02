"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { StatusBadge } from "../company-recruiting/CompanyRecruitingChrome";
import {
  confirmQuestionSet,
  createInterviewQuestion,
  deleteInterviewQuestion,
  generateInterviewQuestions,
  generateQuestionSet,
  getAiJobStatus,
  getInterviewSettings,
  suggestEvaluationCriteria,
  updateEvaluationCriteria,
  updateInterviewQuestion,
  updateInterviewTimePolicy,
} from "./api";
import type {
  AiJobOutput,
  AiJobResult,
  AiProcessStatus,
  CriteriaSuggestionCandidate,
  GeneratedQuestionCandidate,
  GeneratedQuestionSetCandidate,
  InterviewSettings,
  QuestionType,
} from "./types";

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
  preparationTimeMode: string;
  answerTimeSec: string;
  answerTimeMode: string;
  retryAllowed: boolean;
};

type TimePolicyField = "preparationTimeSec" | "answerTimeSec";

type AiJobKind = "criteria" | "questions" | "questionSet";

type AiJobNotice = {
  kind: AiJobKind;
  label: string;
  processLogId: number;
  status: AiProcessStatus;
  output?: AiJobOutput;
  failure?: AiJobResult["failure"];
};

type QuestionSetPreviewItem = {
  criterionId: number;
  criterionLabel: string;
  questionId: number | null;
  questionType: QuestionType | null;
  content: string;
};

type QuestionSetConfirmSummary = {
  confirmableCount: number;
  missingCriteriaCount: number;
  totalCriteriaCount: number;
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

const CUSTOM_TIME_OPTION = "custom";
const PREPARATION_TIME_OPTIONS = ["0", "30", "60"];
const ANSWER_TIME_OPTIONS = ["60", "90", "120"];
const AI_STATUS_LABELS: Record<AiProcessStatus, string> = {
  PENDING: "대기 중",
  RUNNING: "처리 중",
  COMPLETED: "완료",
  FAILED: "실패",
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
  const [aiJobSubmitting, setAiJobSubmitting] = useState<AiJobKind | null>(null);
  const [aiJobError, setAiJobError] = useState("");
  const [aiJobNotices, setAiJobNotices] = useState<AiJobNotice[]>([]);
  const [questionSetConfirming, setQuestionSetConfirming] = useState(false);
  const [showQuestionSetPreview, setShowQuestionSetPreview] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setCriteriaError("");
    setTimePolicyError("");
    setQuestionError("");
    setAiJobError("");
    try {
      const response = await getInterviewSettings(postingId);
      setSettings(response.data);
      setCriteriaDrafts(toCriteriaDrafts(response.data));
      setTimePolicyDraft(toTimePolicyDraft(response.data));
      setSelectedTagId("");
      setEditingQuestionId(null);
      setShowQuestionSetPreview(false);
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

  useEffect(() => {
    const activeJobs = aiJobNotices.filter((notice) => !isTerminalAiStatus(notice.status));
    if (activeJobs.length === 0) return undefined;

    let canceled = false;
    const poll = async () => {
      const results: Array<{ kind: AiJobKind; data: AiJobResult } | { kind: AiJobKind; error: string }> = await Promise.all(
        activeJobs.map(async (notice) => {
          try {
            const response = await getAiJobStatus(notice.processLogId);
            return { kind: notice.kind, data: response.data };
          } catch (error) {
            return {
              kind: notice.kind,
              error: error instanceof Error ? error.message : "AI 작업 상태를 조회하지 못했습니다.",
            };
          }
        }),
      );

      if (canceled) return;

      setAiJobNotices((current) => {
        let changed = false;
        const next = current.map((notice) => {
          const result = results.find((item) => item.kind === notice.kind);
          if (!result || !("data" in result)) return notice;

          const output = normalizeAiJobOutput(result.data.output);
          if (notice.status !== result.data.status || notice.output !== output || notice.failure !== result.data.failure) {
            changed = true;
          }
          return {
            ...notice,
            status: result.data.status,
            output,
            failure: result.data.failure,
          };
        });
        return changed ? next : current;
      });

      const failed = results.find((item) => "error" in item);
      if (failed && "error" in failed) {
        setAiJobError(failed.error ?? "AI 작업 상태를 조회하지 못했습니다.");
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 3000);

    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, [aiJobNotices]);

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
    return JSON.stringify(toTimePolicyComparable(timePolicyDraft)) !== JSON.stringify(toTimePolicyComparable(toTimePolicyDraft(settings)));
  }, [settings, timePolicyDraft]);

  const availableTagOptions = useMemo(() => {
    if (!settings) return [];
    const selectedTagIds = new Set(criteriaDrafts.map((criterion) => criterion.tagId));
    return settings.availableTags.filter((tag) => !selectedTagIds.has(tag.tagId));
  }, [criteriaDrafts, settings]);

  const visibleQuestions = useMemo(() => {
    if (!settings) return [];
    const visibleCriterionIds = new Set(
      criteriaDrafts
        .map((criterion) => criterion.criterionId)
        .filter((criterionId): criterionId is number => criterionId !== undefined),
    );
    return settings.questions.filter((question) => question.criterionId === null || visibleCriterionIds.has(question.criterionId));
  }, [criteriaDrafts, settings]);

  const questionSetPreview = useMemo(() => buildQuestionSetPreview(settings), [settings]);
  const questionSetPreviewSummary = useMemo(() => buildQuestionSetPreviewSummary(questionSetPreview), [questionSetPreview]);

  function addCriteriaDraft() {
    if (!settings || selectedTagId === "") return;

    const tag = settings.availableTags.find((item) => item.tagId === Number(selectedTagId));
    if (!tag) {
      setCriteriaError("추가할 평가 태그를 선택해주세요.");
      return;
    }

    setCriteriaError("");
    setCriteriaDrafts((current) => {
      const normalizedCriteria = normalizeCriteriaOrder(current);
      return [
        ...normalizedCriteria,
        {
          draftId: `new-${tag.tagId}`,
          tagId: tag.tagId,
          tagName: tag.tagName,
          category: tag.category,
          description: tag.description,
          weight: "10",
          passScore: "",
          sortOrder: String(normalizedCriteria.length + 1),
        },
      ];
    });
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
    const nextCriteriaDrafts = normalizeCriteriaOrder(criteriaDrafts.filter((criterion) => criterion.draftId !== draftId));
    setCriteriaDrafts(nextCriteriaDrafts);
    if (criterion?.criterionId !== undefined && questionForm.criterionId === String(criterion.criterionId)) {
      resetQuestionEditor(String(nextCriteriaDrafts.find((item) => item.criterionId !== undefined)?.criterionId ?? ""));
    }
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

  function updateTimePolicyPreset(field: TimePolicyField, value: string) {
    setTimePolicyError("");
    const modeField = field === "preparationTimeSec" ? "preparationTimeMode" : "answerTimeMode";
    setTimePolicyDraft((current) =>
      current
        ? {
            ...current,
            [modeField]: value,
            ...(value === CUSTOM_TIME_OPTION ? {} : { [field]: value }),
          }
        : current,
    );
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
      setTimePolicyDraft(toTimePolicyDraft({ ...settings, timePolicy: response.data.timePolicy }));
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

  async function handleSuggestCriteria() {
    if (!settings) return;

    setAiJobSubmitting("criteria");
    setAiJobError("");
    try {
      const jobDescription = buildJobDescription(settings);
      const response = await suggestEvaluationCriteria({
        postingId: settings.posting.postingId,
        jobDescription,
        talentProfile: "문제 해결력과 협업 태도를 갖춘 지원자",
        evaluationPolicy: "평가 기준과 질문 뱅크를 기반으로 근거 중심 평가 항목을 추천합니다.",
      });
      rememberAiJob("criteria", "AI 평가 기준 추천", response.data);
    } catch (error) {
      setAiJobError(error instanceof Error ? error.message : "AI 평가 기준 추천 요청에 실패했습니다.");
    } finally {
      setAiJobSubmitting(null);
    }
  }

  async function handleGenerateQuestions() {
    if (!settings) return;

    setAiJobSubmitting("questions");
    setAiJobError("");
    try {
      const response = await generateInterviewQuestions({
        postingId: settings.posting.postingId,
        jobDescription: buildJobDescription(settings),
        questionCount: Math.max(3, settings.criteria.length || 3),
      });
      rememberAiJob("questions", "JD 기반 질문 생성", response.data);
    } catch (error) {
      setAiJobError(error instanceof Error ? error.message : "JD 기반 질문 생성 요청에 실패했습니다.");
    } finally {
      setAiJobSubmitting(null);
    }
  }

  async function handleGenerateQuestionSet() {
    if (!settings) return;

    setShowQuestionSetPreview(true);

    if (settings.criteria.length === 0 || settings.questions.length === 0) {
      setAiJobError("질문 세트를 구성하려면 평가 기준과 질문 뱅크가 필요합니다.");
      return;
    }

    setAiJobSubmitting("questionSet");
    setAiJobError("");
    try {
      const questionTypes = uniqueQuestionTypes(settings.questions);
      const response = await generateQuestionSet({
        postingId: settings.posting.postingId,
        questionCount: Math.max(1, questionSetPreview.filter((item) => item.questionId !== null).length),
        criteria: settings.criteria.map((criterion) => ({
          criterionId: criterion.criterionId,
          name: criterion.tagName,
          weight: criterion.weight,
        })),
        questionTypes: questionTypes.length > 0 ? questionTypes : ["TECHNICAL"],
      });
      rememberAiJob("questionSet", "면접 질문 세트 구성", response.data);
    } catch (error) {
      setAiJobError(error instanceof Error ? error.message : "질문 세트 구성 요청에 실패했습니다.");
    } finally {
      setAiJobSubmitting(null);
    }
  }

  function rememberAiJob(kind: AiJobKind, label: string, result: AiJobResult) {
    setAiJobNotices((current) => [
      {
        kind,
        label,
        processLogId: result.processLogId,
        status: result.status,
        output: normalizeAiJobOutput(result.output),
        failure: result.failure,
      },
      ...current.filter((item) => item.kind !== kind),
    ]);
  }

  function applyCriteriaSuggestion(candidate: CriteriaSuggestionCandidate, selectedTagId?: number) {
    if (!settings) return;

    const matchedTag = findSuggestionTag(settings, criteriaDrafts, candidate, selectedTagId);
    if (!matchedTag) {
      setCriteriaError("이 추천안과 연결할 수 있는 평가 태그가 없습니다. 평가 태그를 먼저 추가해주세요.");
      return;
    }

    setCriteriaError("");
    setCriteriaDrafts((current) => {
      if (current.some((criterion) => criterion.tagId === matchedTag.tagId)) {
        return current;
      }
      const normalizedCriteria = normalizeCriteriaOrder(current);
      return [
        ...normalizedCriteria,
        {
          draftId: `ai-${matchedTag.tagId}-${Date.now()}`,
          tagId: matchedTag.tagId,
          tagName: matchedTag.tagName,
          category: matchedTag.category,
          description: matchedTag.description ?? candidate.description,
          weight: String(candidate.weight || 10),
          passScore: "",
          sortOrder: String(normalizedCriteria.length + 1),
        },
      ];
    });
  }

  async function applyQuestionCandidate(candidate: GeneratedQuestionCandidate, selectedCriterionId?: number) {
    if (!settings) return;

    const criterionId = selectedCriterionId ?? findCandidateCriterionId(settings, candidate);
    if (!criterionId) {
      setQuestionError("연결할 평가 기준 선택 필요");
      return;
    }

    const content = candidate.content.trim();
    const validationMessage = validateQuestionForm(settings, criterionId, content, null);
    if (validationMessage) {
      setQuestionError(validationMessage);
      return;
    }

    setQuestionSaving(true);
    setQuestionError("");
    try {
      const response = await createInterviewQuestion({
        postingId: settings.posting.postingId,
        criterionId,
        questionType: normalizeQuestionType(candidate.questionType),
        content,
      });

      setSettings((current) =>
        current
          ? {
              ...current,
              questions: [...current.questions, response.data.question],
            }
          : current,
      );
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "질문 후보 저장에 실패했습니다.");
    } finally {
      setQuestionSaving(false);
    }
  }

  function retryAiJob(kind: AiJobKind) {
    if (kind === "criteria") {
      void handleSuggestCriteria();
      return;
    }
    if (kind === "questions") {
      void handleGenerateQuestions();
      return;
    }
    void handleGenerateQuestionSet();
  }

  async function confirmAiQuestionSet(notice: AiJobNotice, groups: GeneratedQuestionSetCandidate[]) {
    if (!settings) return;

    const items = buildQuestionSetConfirmItems(settings, groups);
    if (items.length === 0) {
      setAiJobError("확정할 수 있는 질문이 없습니다. 질문 뱅크에 저장된 질문만 질문 세트로 확정할 수 있습니다.");
      return;
    }

    setQuestionSetConfirming(true);
    setAiJobError("");
    try {
      await confirmQuestionSet({
        postingId: settings.posting.postingId,
        title: `${settings.posting.title} 면접 질문 세트`,
        sourceProcessLogId: notice.processLogId,
        items,
      });
      setMessage(`면접 질문 세트가 확정되었습니다. 저장된 질문 ${items.length}개`);
    } catch (error) {
      setAiJobError(error instanceof Error ? error.message : "질문 세트 확정에 실패했습니다.");
    } finally {
      setQuestionSetConfirming(false);
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: "12px",
                  marginTop: "12px",
                }}
              >
                <Metric compact label="평가 기준" value={settings.criteria.length} />
                <Metric compact label="질문" value={visibleQuestions.length} />
                <Metric compact label="준비 시간" value={`${settings.timePolicy.preparationTimeSec}초`} />
                <Metric compact label="답변 시간" value={`${settings.timePolicy.answerTimeSec}초`} />
                <Metric compact label="재시도" value={settings.timePolicy.retryAllowed ? "허용" : "미허용"} />
              </div>
            </section>

            <form className="panel" style={{ padding: "18px 24px" }} onSubmit={handleTimePolicySave}>
              <div className="panel-head" style={{ alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <h2>면접 시간 정책</h2>
                </div>
              </div>
              {timePolicyError ? <p className="notice danger">{timePolicyError}</p> : null}
              {timePolicyDraft ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 160px max-content minmax(160px, 1fr)",
                    alignItems: "end",
                    columnGap: "12px",
                    rowGap: "12px",
                    overflowX: "auto",
                  }}
                >
                  <label style={{ gap: "6px", minWidth: 0 }}>
                    준비 시간
                    <select
                      aria-label="준비 시간 초"
                      style={{ minHeight: "40px", width: "100%" }}
                      value={timePolicyDraft.preparationTimeMode}
                      onChange={(event) => updateTimePolicyPreset("preparationTimeSec", event.target.value)}
                    >
                      <option value="0">0초</option>
                      <option value="30">30초</option>
                      <option value="60">60초</option>
                      <option value={CUSTOM_TIME_OPTION}>직접 입력</option>
                    </select>
                    {timePolicyDraft.preparationTimeMode === CUSTOM_TIME_OPTION ? (
                      <input
                        aria-label="준비 시간 직접 입력"
                        inputMode="numeric"
                        maxLength={3}
                        placeholder="초 단위"
                        style={{ minHeight: "40px", width: "100%" }}
                        type="text"
                        value={timePolicyDraft.preparationTimeSec}
                        onChange={(event) => updateTimePolicyDraft("preparationTimeSec", event.target.value)}
                      />
                    ) : null}
                  </label>
                  <label style={{ gap: "6px", minWidth: 0 }}>
                    답변 시간
                    <select
                      aria-label="답변 시간 초"
                      style={{ minHeight: "40px", width: "100%" }}
                      value={timePolicyDraft.answerTimeMode}
                      onChange={(event) => updateTimePolicyPreset("answerTimeSec", event.target.value)}
                    >
                      <option value="60">60초</option>
                      <option value="90">90초</option>
                      <option value="120">120초</option>
                      <option value={CUSTOM_TIME_OPTION}>직접 입력</option>
                    </select>
                    {timePolicyDraft.answerTimeMode === CUSTOM_TIME_OPTION ? (
                      <input
                        aria-label="답변 시간 직접 입력"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="초 단위"
                        style={{ minHeight: "40px", width: "100%" }}
                        type="text"
                        value={timePolicyDraft.answerTimeSec}
                        onChange={(event) => updateTimePolicyDraft("answerTimeSec", event.target.value)}
                      />
                    ) : null}
                  </label>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      minHeight: "40px",
                      padding: "0 4px 0 2px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <input
                      checked={timePolicyDraft.retryAllowed}
                      style={{ width: "18px", minWidth: "18px", minHeight: "18px" }}
                      type="checkbox"
                      onChange={(event) => updateTimePolicyDraft("retryAllowed", event.target.checked)}
                    />
                    <span>재시도 허용</span>
                  </label>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button className="btn secondary compact" type="button" disabled={!hasTimePolicyChanges || timePolicySaving} onClick={resetTimePolicyDraft}>
                      되돌리기
                    </button>
                    <button className="btn primary compact" type="submit" disabled={!hasTimePolicyChanges || timePolicySaving}>
                      {timePolicySaving ? "저장 중" : "저장"}
                    </button>
                  </div>
                </div>
              ) : null}
            </form>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>AI 요청 상태</h2>
                  <p>평가 기준 추천, JD 기반 질문 생성, 질문 세트 구성을 요청합니다.</p>
                </div>
                <div className="toolbar">
                  <button
                    className="btn secondary compact"
                    type="button"
                    disabled={aiJobSubmitting !== null}
                    onClick={() => void handleSuggestCriteria()}
                  >
                    {aiJobSubmitting === "criteria" ? "요청 중" : "평가 기준 추천"}
                  </button>
                  <button
                    className="btn secondary compact"
                    type="button"
                    disabled={aiJobSubmitting !== null}
                    onClick={() => void handleGenerateQuestions()}
                  >
                    {aiJobSubmitting === "questions" ? "요청 중" : "JD 질문 생성"}
                  </button>
                  <button
                    className="btn primary compact"
                    type="button"
                    disabled={aiJobSubmitting !== null}
                    onClick={() => void handleGenerateQuestionSet()}
                  >
                    {aiJobSubmitting === "questionSet" ? "요청 중" : "질문 세트 구성"}
                  </button>
                </div>
              </div>
              {aiJobError ? <p className="notice danger">{aiJobError}</p> : null}
              {aiJobNotices.length > 0 ? (
                <div className="posting-list">
                  {aiJobNotices.map((notice) => (
                    <article className="posting" key={notice.kind} style={{ alignItems: "start" }}>
                      <div className="logo-chip">AI</div>
                      <div style={{ display: "grid", gap: "10px" }}>
                        <div>
                          <h3>{notice.label}</h3>
                          <p>
                            작업 ID {notice.processLogId}
                            {notice.failure?.reason ? ` · ${formatAiFailureReason(notice.failure.reason)}` : ""}
                          </p>
                          {notice.status === "FAILED" ? (
                            <button className="btn secondary compact" type="button" disabled={aiJobSubmitting !== null} onClick={() => retryAiJob(notice.kind)}>
                              다시 요청
                            </button>
                          ) : null}
                        </div>
                        {notice.status === "COMPLETED" ? (
                          <AiJobPreview
                            notice={notice}
                            settings={settings}
                            criteriaDrafts={criteriaDrafts}
                            questionSaving={questionSaving}
                            questionSetConfirming={questionSetConfirming}
                            onApplyCriteria={applyCriteriaSuggestion}
                            onApplyQuestion={(candidate, selectedCriterionId) => void applyQuestionCandidate(candidate, selectedCriterionId)}
                            onConfirmQuestionSet={(groups) => void confirmAiQuestionSet(notice, groups)}
                          />
                        ) : null}
                      </div>
                      <AiStatusBadge status={notice.status} />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">등록된 AI 요청이 없습니다.</div>
              )}
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
                          <select
                            aria-label={`${criterion.tagName} 순서`}
                            value={criterion.sortOrder}
                            onChange={(event) => updateCriteriaDraft(criterion.draftId, "sortOrder", event.target.value)}
                          >
                            {criteriaDrafts.map((_, index) => (
                              <option key={index + 1} value={index + 1}>
                                {index + 1}
                              </option>
                            ))}
                          </select>
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
                {visibleQuestions.map((question) => (
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
                {visibleQuestions.length === 0 ? (
                  <div className="empty">등록된 질문이 없습니다.</div>
                ) : null}
              </div>
              {showQuestionSetPreview ? (
                <>
                  <div className="panel-head">
                    <div>
                      <h2>면접 질문 세트 미리보기</h2>
                      <p>평가 기준별 첫 번째 활성 질문을 기준으로 구성합니다. 연결된 질문이 없는 기준은 확정 대상에서 제외됩니다.</p>
                      {questionSetPreview.length > 0 ? (
                        <p>
                          확정 가능 질문 {questionSetPreviewSummary.confirmableCount}개
                          {questionSetPreviewSummary.missingCriteriaCount > 0
                            ? ` · 누락 기준 ${questionSetPreviewSummary.missingCriteriaCount}개`
                            : " · 모든 기준 연결 완료"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="posting-list question-list">
                    {questionSetPreview.map((item) => (
                      <article className="posting" key={item.criterionId}>
                        <div className="logo-chip">
                          {item.questionType ? getQuestionTypeLabel(item.questionType) : "미연결"}
                        </div>
                        <div>
                          <h3>{item.content}</h3>
                          <p>{item.criterionLabel}</p>
                          {item.questionId === null ? (
                            <p>질문 뱅크에 활성 질문을 추가하면 질문 세트에 포함할 수 있습니다.</p>
                          ) : null}
                        </div>
                        <span className={`badge ${item.questionId === null ? "warning" : "success"}`}>
                          {item.questionId === null ? "질문 없음" : "확정 가능"}
                        </span>
                      </article>
                    ))}
                    {questionSetPreview.length === 0 ? (
                      <div className="empty">미리보기할 평가 기준이 없습니다.</div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </section>
          </>
        )}
    </section>
  );
}

function buildJobDescription(settings: InterviewSettings) {
  const criteriaText =
    settings.criteria.length > 0
      ? settings.criteria.map((criterion) => `${criterion.tagName}(${criterion.category})`).join(", ")
      : "등록된 평가 기준 없음";
  const questionText =
    settings.questions.length > 0
      ? settings.questions
          .slice(0, 5)
          .map((question) => question.content)
          .join(" / ")
      : "등록된 질문 없음";

  return `공고명: ${settings.posting.title}\n평가 기준: ${criteriaText}\n질문 뱅크: ${questionText}`;
}

function uniqueQuestionTypes(questions: InterviewSettings["questions"]) {
  return Array.from(new Set(questions.map((question) => question.questionType)));
}

function buildQuestionSetPreview(settings: InterviewSettings | null): QuestionSetPreviewItem[] {
  if (!settings) return [];

  return [...settings.criteria]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((criterion) => {
      const question = settings.questions.find((item) => item.criterionId === criterion.criterionId && item.isActive);

      return {
        criterionId: criterion.criterionId,
        criterionLabel: `${criterion.tagName} · ${criterion.category}`,
        questionId: question?.questionId ?? null,
        questionType: question?.questionType ?? null,
        content: question?.content ?? "연결된 활성 질문이 없습니다.",
      };
    });
}

function buildQuestionSetPreviewSummary(items: QuestionSetPreviewItem[]) {
  const confirmableCount = items.filter((item) => item.questionId !== null).length;

  return {
    confirmableCount,
    missingCriteriaCount: Math.max(items.length - confirmableCount, 0),
  };
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

function Metric({ label, value, compact = false }: { label: string; value: number | string; compact?: boolean }) {
  return (
    <div
      className="metric"
      style={
        compact
          ? {
              minWidth: 0,
              padding: "10px 12px",
              textAlign: "center",
              background: "var(--surface-soft)",
              border: "1px solid var(--line-soft)",
              borderRadius: "12px",
            }
          : undefined
      }
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AiStatusBadge({ status }: { status: AiProcessStatus }) {
  const tone = status === "COMPLETED" ? "success" : status === "FAILED" ? "danger" : status === "RUNNING" ? "info" : "warning";
  return <span className={`badge ${tone}`}>{AI_STATUS_LABELS[status]}</span>;
}

function AiJobPreview({
  notice,
  settings,
  criteriaDrafts,
  questionSaving,
  questionSetConfirming,
  onApplyCriteria,
  onApplyQuestion,
  onConfirmQuestionSet,
}: {
  notice: AiJobNotice;
  settings: InterviewSettings;
  criteriaDrafts: CriteriaDraft[];
  questionSaving: boolean;
  questionSetConfirming: boolean;
  onApplyCriteria: (candidate: CriteriaSuggestionCandidate, selectedTagId?: number) => void;
  onApplyQuestion: (candidate: GeneratedQuestionCandidate, selectedCriterionId?: number) => void;
  onConfirmQuestionSet: (groups: GeneratedQuestionSetCandidate[]) => void;
}) {
  const [criteriaTagSelections, setCriteriaTagSelections] = useState<Record<string, string>>({});
  const [questionCriterionSelections, setQuestionCriterionSelections] = useState<Record<string, string>>({});
  const criteriaSuggestions = getCriteriaSuggestions(notice.output);
  const questionCandidates = getQuestionCandidates(notice.output);
  const questionSetPreview = getGeneratedQuestionSetPreview(notice.output);

  if (notice.kind === "criteria") {
    return (
      <div className="posting-list">
        {criteriaSuggestions.map((candidate, index) => {
          const key = `${candidate.title}-${index}`;
          const selectedTagId = toOptionalNumber(criteriaTagSelections[key]);
          const matchedTag = findSuggestionTag(settings, criteriaDrafts, candidate, selectedTagId);
          const availableTags = getAvailableSuggestionTags(settings, criteriaDrafts, candidate);
          return (
            <div className="posting" key={key}>
              <div className="logo-chip">{candidate.order || index + 1}</div>
              <div>
                <h3>{candidate.title}</h3>
                <p>{candidate.description}</p>
                <p>{candidate.suggestionReason}</p>
                <select
                  className="field"
                  value={matchedTag?.tagId ?? ""}
                  onChange={(event) =>
                    setCriteriaTagSelections((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                >
                  <option value="">연결 태그 선택</option>
                  {availableTags.map((tag) => (
                    <option key={tag.tagId} value={tag.tagId}>
                      {tag.tagName} · {tag.category}
                    </option>
                  ))}
                </select>
              </div>
              <span className="badge info">배점 {candidate.weight}</span>
              <button className="btn secondary compact" type="button" disabled={!matchedTag} onClick={() => onApplyCriteria(candidate, matchedTag?.tagId)}>
                {matchedTag ? "적용" : "연결 태그 없음"}
              </button>
            </div>
          );
        })}
        {criteriaSuggestions.length === 0 ? <div className="empty">표시할 평가 기준 추천 결과가 없습니다.</div> : null}
      </div>
    );
  }

  if (notice.kind === "questions") {
    return (
      <div className="posting-list">
        {questionCandidates.map((candidate, index) => {
          const key = `${candidate.content}-${index}`;
          const selectedCriterionId = toOptionalNumber(questionCriterionSelections[key]);
          const criterionId = selectedCriterionId ?? findCandidateCriterionId(settings, candidate);
          return (
            <div className="posting" key={key}>
              <div className="logo-chip">{normalizeQuestionType(candidate.questionType)}</div>
              <div>
                <h3>{candidate.content}</h3>
                <p>{criterionId ? getCriterionLabel(settings, criterionId) : "연결할 평가 기준 선택 필요"}</p>
                <p>
                  {candidate.category} · {candidate.difficulty} · {candidate.suggestionReason}
                </p>
                <select
                  className="field"
                  value={criterionId ?? ""}
                  onChange={(event) =>
                    setQuestionCriterionSelections((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                >
                  <option value="">평가 기준 선택</option>
                  {settings.criteria.map((criterion) => (
                    <option key={criterion.criterionId} value={criterion.criterionId}>
                      {criterion.tagName}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn secondary compact" type="button" disabled={!criterionId || questionSaving} onClick={() => onApplyQuestion(candidate, criterionId)}>
                {criterionId ? "질문 저장" : "기준 선택 필요"}
              </button>
            </div>
          );
        })}
        {questionCandidates.length === 0 ? <div className="empty">표시할 질문 생성 결과가 없습니다.</div> : null}
      </div>
    );
  }

  return (
    <div className="posting-list">
      {questionSetPreview.length > 0 ? (
        <QuestionSetConfirmNotice summary={buildQuestionSetConfirmSummary(settings, questionSetPreview)} />
      ) : null}
      {questionSetPreview.map((group, index) => {
        const groupSummary = buildQuestionSetConfirmSummary(settings, [group]);
        const firstConfirmableQuestion = buildQuestionSetConfirmItems(settings, [group]).length > 0;
        return (
          <div className="posting" key={`${group.criterionTitle}-${index}`}>
            <div className="logo-chip">{firstConfirmableQuestion ? "포함" : "누락"}</div>
            <div>
              <h3>{group.criterionTitle}</h3>
              <p>
                {group.questions.length > 0
                  ? group.questions.map((question) => question.content).join(" / ")
                  : "AI가 제안한 질문이 없습니다."}
              </p>
              {groupSummary.confirmableCount > 0 ? (
                <p>질문 뱅크의 활성 질문 {groupSummary.confirmableCount}개가 확정 대상입니다.</p>
              ) : (
                <p>질문 뱅크에 연결된 활성 질문이 없어 확정 대상에서 제외됩니다.</p>
              )}
            </div>
            <span className={`badge ${firstConfirmableQuestion ? "success" : "warning"}`}>
              {firstConfirmableQuestion ? "확정 가능" : "질문 없음"}
            </span>
          </div>
        );
      })}
      {questionSetPreview.length > 0 ? (
        <button
          className="btn primary compact"
          type="button"
          disabled={questionSetConfirming || buildQuestionSetConfirmItems(settings, questionSetPreview).length === 0}
          onClick={() => onConfirmQuestionSet(questionSetPreview)}
        >
          {questionSetConfirming ? "확정 중" : "질문 세트 확정"}
        </button>
      ) : null}
      {questionSetPreview.length === 0 ? <div className="empty">표시할 질문 세트 결과가 없습니다.</div> : null}
    </div>
  );
}

function QuestionSetConfirmNotice({ summary }: { summary: QuestionSetConfirmSummary }) {
  if (summary.confirmableCount === 0) {
    return (
      <div className="empty">
        질문 세트로 확정할 수 있는 활성 질문이 없습니다. 질문 뱅크에 평가 기준과 연결된 활성 질문을 먼저 추가해주세요.
      </div>
    );
  }

  return (
    <div className="empty">
      확정 시 활성 질문 {summary.confirmableCount}개가 저장됩니다.
      {summary.missingCriteriaCount > 0
        ? ` 연결된 질문이 없는 평가 기준 ${summary.missingCriteriaCount}개는 이번 질문 세트에서 제외됩니다.`
        : " 모든 평가 기준에 확정 가능한 질문이 연결되어 있습니다."}
    </div>
  );
}

function isTerminalAiStatus(status: AiProcessStatus) {
  return status === "COMPLETED" || status === "FAILED";
}

function normalizeAiJobOutput(output: unknown): AiJobOutput | undefined {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return undefined;
  }
  return output as AiJobOutput;
}

function getCriteriaSuggestions(output?: AiJobOutput): CriteriaSuggestionCandidate[] {
  if (Array.isArray(output?.criteriaSuggestions)) {
    return output.criteriaSuggestions;
  }

  return (output?.items ?? []).map((item, index) => ({
    title: item,
    description: "AI가 추천한 평가 기준 후보입니다.",
    weight: 10,
    order: index + 1,
    suggestionReason: "AI 생성 결과 검토가 필요합니다.",
  }));
}

function getQuestionCandidates(output?: AiJobOutput): GeneratedQuestionCandidate[] {
  if (Array.isArray(output?.questionCandidates)) {
    return output.questionCandidates;
  }

  return (output?.items ?? []).map((item) => ({
    content: item,
    category: "AI_GENERATED",
    difficulty: "MEDIUM",
    criterionTitle: "",
    expectedKeywords: [],
    suggestionReason: "AI 생성 결과 검토가 필요합니다.",
    questionType: "TECHNICAL",
  }));
}

function getGeneratedQuestionSetPreview(output?: AiJobOutput): GeneratedQuestionSetCandidate[] {
  if (Array.isArray(output?.questionSetPreview)) {
    return output.questionSetPreview;
  }

  const questions = getQuestionCandidates(output);
  if (questions.length === 0) return [];

  return [
    {
      criterionTitle: "AI 질문 세트",
      questions,
    },
  ];
}

function findSuggestionTag(
  settings: InterviewSettings,
  criteriaDrafts: CriteriaDraft[],
  candidate: CriteriaSuggestionCandidate,
  selectedTagId?: number,
) {
  const selectedTagIds = new Set(criteriaDrafts.map((criterion) => criterion.tagId));
  const availableTags = settings.availableTags.filter((tag) => !selectedTagIds.has(tag.tagId));
  if (selectedTagId) {
    const selected = availableTags.find((tag) => tag.tagId === selectedTagId);
    if (selected) return selected;
  }
  if (candidate.tagId) {
    const exact = availableTags.find((tag) => tag.tagId === candidate.tagId);
    if (exact) return exact;
  }

  const normalizedTitle = normalizeText(candidate.tagName ?? candidate.title);
  const normalizedCategory = normalizeText(candidate.category ?? "");
  return (
    availableTags.find((tag) => normalizeText(tag.tagName) === normalizedTitle) ??
    availableTags.find((tag) => normalizedTitle.includes(normalizeText(tag.tagName))) ??
    availableTags.find((tag) => normalizedCategory !== "" && normalizeText(tag.category) === normalizedCategory)
  );
}

function getAvailableSuggestionTags(
  settings: InterviewSettings,
  criteriaDrafts: CriteriaDraft[],
  candidate: CriteriaSuggestionCandidate,
) {
  const selectedTagIds = new Set(criteriaDrafts.map((criterion) => criterion.tagId));
  return settings.availableTags
    .filter((tag) => !selectedTagIds.has(tag.tagId) || tag.tagId === candidate.tagId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.tagId - b.tagId);
}

function findCandidateCriterionId(settings: InterviewSettings, candidate: GeneratedQuestionCandidate) {
  if (candidate.criterionId && settings.criteria.some((criterion) => criterion.criterionId === candidate.criterionId)) {
    return candidate.criterionId;
  }

  const normalizedTitle = normalizeText(candidate.criterionTitle ?? "");
  if (!normalizedTitle) {
    return undefined;
  }

  return (
    settings.criteria.find((criterion) => normalizeText(criterion.tagName) === normalizedTitle)?.criterionId ??
    settings.criteria.find((criterion) => normalizedTitle.includes(normalizeText(criterion.tagName)))?.criterionId ??
    settings.criteria.find((criterion) => normalizeText(criterion.category) === normalizedTitle)?.criterionId
  );
}

function buildQuestionSetConfirmItems(settings: InterviewSettings, groups: GeneratedQuestionSetCandidate[]) {
  const usedQuestionIds = new Set<number>();
  const items: Array<{ questionId: number; criterionId?: number | null; sortOrder: number }> = [];

  for (const group of groups) {
    for (const candidate of group.questions) {
      const question = findQuestionForCandidate(settings, candidate, group);
      if (!question || usedQuestionIds.has(question.questionId)) continue;
      usedQuestionIds.add(question.questionId);
      items.push({
        questionId: question.questionId,
        criterionId: question.criterionId,
        sortOrder: items.length + 1,
      });
    }
  }

  return items;
}

function buildQuestionSetConfirmSummary(settings: InterviewSettings, groups: GeneratedQuestionSetCandidate[]): QuestionSetConfirmSummary {
  const items = buildQuestionSetConfirmItems(settings, groups);
  const matchedCriterionIds = new Set(items.map((item) => item.criterionId).filter((criterionId): criterionId is number => Number.isInteger(criterionId)));
  const groupCriterionIds = new Set(
    groups
      .map((group) => group.criterionId ?? findCriterionIdByTitle(settings, group.criterionTitle))
      .filter((criterionId): criterionId is number => Number.isInteger(criterionId)),
  );
  const totalCriteriaCount = groupCriterionIds.size || groups.length;

  return {
    confirmableCount: items.length,
    missingCriteriaCount: Math.max(totalCriteriaCount - matchedCriterionIds.size, 0),
    totalCriteriaCount,
  };
}

function findQuestionForCandidate(
  settings: InterviewSettings,
  candidate: GeneratedQuestionCandidate,
  group?: GeneratedQuestionSetCandidate,
) {
  if (candidate.questionId) {
    return settings.questions.find((question) => question.questionId === candidate.questionId && question.isActive);
  }

  const normalizedContent = normalizeText(candidate.content);
  const exact = settings.questions.find((question) => normalizeText(question.content) === normalizedContent && question.isActive);
  if (exact) return exact;

  const criterionId =
    candidate.criterionId ??
    group?.criterionId ??
    findCriterionIdByTitle(settings, candidate.criterionTitle ?? group?.criterionTitle);
  if (!criterionId) return undefined;

  return settings.questions.find((question) => question.criterionId === criterionId && question.isActive);
}

function findCriterionIdByTitle(settings: InterviewSettings, title: string | undefined) {
  const normalizedTitle = normalizeText(title ?? "");
  if (!normalizedTitle) return undefined;
  return (
    settings.criteria.find((criterion) => normalizeText(criterion.tagName) === normalizedTitle)?.criterionId ??
    settings.criteria.find((criterion) => normalizedTitle.includes(normalizeText(criterion.tagName)))?.criterionId ??
    settings.criteria.find((criterion) => normalizeText(criterion.category) === normalizedTitle)?.criterionId
  );
}

function getQuestionTypeLabel(type: QuestionType) {
  return QUESTION_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function toOptionalNumber(value: string | undefined) {
  if (!value) return undefined;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined;
}

function formatAiFailureReason(reason: string) {
  if (reason.includes("AI queue publish failed")) {
    return "AI 작업 대기열에 연결하지 못했습니다. LocalStack과 worker 실행 상태를 확인해주세요.";
  }
  if (reason.toLowerCase().includes("guardrail")) {
    return "생성 결과가 검수 정책을 통과하지 못했습니다. 조건을 수정한 뒤 다시 요청해주세요.";
  }
  return "AI 결과 생성 중 오류가 발생했습니다. 다시 요청할 수 있습니다.";
}

function normalizeQuestionType(value: string | undefined): QuestionType {
  return QUESTION_TYPE_OPTIONS.some((option) => option.value === value) ? (value as QuestionType) : "TECHNICAL";
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

function normalizeCriteriaOrder(criteria: CriteriaDraft[]): CriteriaDraft[] {
  return [...criteria]
    .sort((left, right) => toNumber(left.sortOrder) - toNumber(right.sortOrder))
    .map((criterion, index) => ({
      ...criterion,
      sortOrder: String(index + 1),
    }));
}

function toTimePolicyDraft(settings: InterviewSettings): TimePolicyDraft {
  return {
    preparationTimeSec: String(settings.timePolicy.preparationTimeSec),
    preparationTimeMode: getTimePolicyMode(String(settings.timePolicy.preparationTimeSec), PREPARATION_TIME_OPTIONS),
    answerTimeSec: String(settings.timePolicy.answerTimeSec),
    answerTimeMode: getTimePolicyMode(String(settings.timePolicy.answerTimeSec), ANSWER_TIME_OPTIONS),
    retryAllowed: settings.timePolicy.retryAllowed,
  };
}

function toTimePolicyComparable(draft: TimePolicyDraft) {
  return {
    preparationTimeSec: draft.preparationTimeSec,
    answerTimeSec: draft.answerTimeSec,
    retryAllowed: draft.retryAllowed,
  };
}

function getTimePolicyMode(value: string, options: string[]) {
  return options.includes(value.trim()) ? value.trim() : CUSTOM_TIME_OPTION;
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
    if (sortOrder > criteria.length) {
      return "평가 기준 순서는 현재 평가 기준 개수를 넘을 수 없습니다.";
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
  if (draft.preparationTimeSec.trim() === "") {
    return "준비 시간을 입력해주세요.";
  }
  if (draft.answerTimeSec.trim() === "") {
    return "답변 시간을 입력해주세요.";
  }

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
