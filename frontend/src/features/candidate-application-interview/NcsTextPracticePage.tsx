"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RuntimeQuestionView } from "./api";
import {
  CandidatePageHead,
  CandidatePageShell,
  StatusNotice,
  getCandidateApi,
} from "./CandidatePages";
import {
  NcsEvaluationPollingTimeoutError,
  pollNcsEvaluation,
  queueTextInputNcsEvaluation,
  saveTextInputPracticeAnswer,
  type NcsBehaviorEvaluation,
  type NcsEvaluationProductOutput,
  type NcsEvidenceType,
} from "./ncs-evaluation";
import {
  clearNcsTextPracticeRecovery,
  loadNcsTextPracticeRecovery,
  saveNcsTextPracticeRecovery,
  type NcsTextPracticeRecovery,
} from "./ncs-text-practice-recovery";
import { candidateApplicationInterviewRoutes } from "./routes";
import styles from "./NcsTextPracticePage.module.css";

type PracticeFocus = "TECHNICAL" | "EXPERIENCE";
type EvaluationPhase = "IDLE" | "STARTING" | "ANSWERING" | "QUEUED" | "RUNNING" | "DELAYED" | "RESULT";

interface PracticeSession {
  sessionId: number;
  jobRole: string;
  focus: PracticeFocus;
  question: RuntimeQuestionView & { content: string };
}

const MAX_TRANSCRIPT_LENGTH = 20_000;
const JOB_ROLES = [
  "백엔드 개발자",
  "프론트엔드 개발자",
  "풀스택 개발자",
  "AI/ML 엔지니어",
  "데이터 엔지니어",
  "DevOps/SRE",
  "QA 엔지니어",
  "보안 엔지니어",
] as const;
const FOCUS_OPTIONS: Array<{ value: PracticeFocus; label: string }> = [
  { value: "TECHNICAL", label: "기술 의사결정" },
  { value: "EXPERIENCE", label: "경험과 적용" },
];
const EVIDENCE_LABELS: Record<NcsEvidenceType | "CONTRADICTION", string> = {
  SITUATION: "상황",
  TASK: "역할",
  ACTION: "행동",
  RATIONALE: "선택 근거",
  RESULT: "결과",
  REFLECTION: "회고",
  KNOWLEDGE: "지식",
  CONSTRAINT: "제약",
  TRADEOFF: "대안 비교",
  CONTRADICTION: "상충 근거",
};

export function NcsTextPracticePage() {
  const [jobRole, setJobRole] = useState<(typeof JOB_ROLES)[number]>("백엔드 개발자");
  const [focus, setFocus] = useState<PracticeFocus>("TECHNICAL");
  const [session, setSession] = useState<PracticeSession>();
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [baseTranscript, setBaseTranscript] = useState("");
  const [savedTranscript, setSavedTranscript] = useState("");
  const [followUpAttempt, setFollowUpAttempt] = useState<0 | 1>(0);
  const [result, setResult] = useState<NcsEvaluationProductOutput>();
  const [phase, setPhase] = useState<EvaluationPhase>("IDLE");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [pendingEvaluation, setPendingEvaluation] = useState<NcsTextPracticeRecovery>();
  const pollingControllerRef = useRef<AbortController | undefined>(undefined);
  const evaluationSubmissionRef = useRef(false);

  const resumePendingEvaluation = useCallback(async (pending: NcsTextPracticeRecovery) => {
    const controller = new AbortController();
    pollingControllerRef.current?.abort();
    pollingControllerRef.current = controller;
    setError("");
    setMessage("");
    setPhase("RUNNING");

    try {
      const evaluated = await pollNcsEvaluation({
        processLogId: pending.processLogId,
        getStatus: getCandidateApi().getAiJobStatus,
        signal: controller.signal,
        onStatus: (status) => {
          if (status === "PENDING") setPhase("QUEUED");
          if (status === "RUNNING") setPhase("RUNNING");
        },
      });
      clearNcsTextPracticeRecovery(window.sessionStorage);
      setPendingEvaluation(undefined);
      setBaseTranscript(pending.transcript);
      setSavedTranscript(pending.transcript);
      setResult(evaluated);
      setPhase("RESULT");
    } catch (evaluationError) {
      if ((evaluationError as Error)?.name === "AbortError") return;
      if (evaluationError instanceof NcsEvaluationPollingTimeoutError) {
        setMessage("평가 작업은 계속 처리 중입니다. 잠시 후 기존 작업을 다시 확인해 주세요.");
        setPhase("DELAYED");
        return;
      }
      clearNcsTextPracticeRecovery(window.sessionStorage);
      setPendingEvaluation(undefined);
      setBaseTranscript(pending.transcript);
      setSavedTranscript(pending.transcript);
      setError(errorMessage(evaluationError));
      setPhase("ANSWERING");
    }
  }, []);

  useEffect(() => {
    const pending = loadNcsTextPracticeRecovery(window.sessionStorage);
    if (pending) {
      setJobRole(pending.jobRole as (typeof JOB_ROLES)[number]);
      setFocus(pending.focus);
      setSession({
        sessionId: pending.sessionId,
        jobRole: pending.jobRole,
        focus: pending.focus,
        question: pending.question,
      });
      setCurrentPrompt(pending.currentPrompt);
      setAnswer("");
      setBaseTranscript(pending.transcript);
      setSavedTranscript(pending.transcript);
      setFollowUpAttempt(pending.followUpAttempt);
      setPendingEvaluation(pending);
      void resumePendingEvaluation(pending);
    }
    return () => pollingControllerRef.current?.abort();
  }, [resumePendingEvaluation]);

  const answerLimit = Math.max(
    0,
    MAX_TRANSCRIPT_LENGTH - baseTranscript.length - (baseTranscript ? 1 : 0),
  );
  const busy = ["STARTING", "QUEUED", "RUNNING", "DELAYED"].includes(phase);
  const activelyPolling = ["QUEUED", "RUNNING"].includes(phase);
  const resultSummary = useMemo(() => summarizeResult(result), [result]);

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pollingControllerRef.current?.abort();
    clearNcsTextPracticeRecovery(window.sessionStorage);
    setPendingEvaluation(undefined);
    setPhase("STARTING");
    setError("");
    setMessage("");

    try {
      const api = getCandidateApi();
      const started = await api.startMockInterview({
        jobRole,
        difficulty: "NORMAL",
        questionTypes: [focus],
        showQuestionText: true,
      });
      let question = started.data.currentQuestion;
      if (!question?.content) {
        const questions = await api.listMockQuestions(started.data.sessionId);
        question = questions.data.questions.find((item) => item.questionType === focus && item.content);
      }
      if (!question?.content) {
        throw new Error("평가 가능한 질문을 불러오지 못했습니다.");
      }

      setSession({
        sessionId: started.data.sessionId,
        jobRole,
        focus,
        question: question as RuntimeQuestionView & { content: string },
      });
      setCurrentPrompt(question.content);
      setAnswer("");
      setBaseTranscript("");
      setSavedTranscript("");
      setFollowUpAttempt(0);
      setResult(undefined);
      setSessionCompleted(false);
      setPhase("ANSWERING");
    } catch (startError) {
      setError(errorMessage(startError));
      setPhase("IDLE");
    }
  }

  async function handleEvaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || phase !== "ANSWERING" || sessionCompleted || evaluationSubmissionRef.current) return;

    const nextAnswer = answer.trim();
    if (!nextAnswer) {
      setError("답변을 입력해 주세요.");
      return;
    }
    const transcript = [baseTranscript, nextAnswer].filter(Boolean).join("\n");
    if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
      setError("누적 답변은 20,000자까지 입력할 수 있습니다.");
      return;
    }

    evaluationSubmissionRef.current = true;
    setError("");
    setMessage("");
    setPhase("QUEUED");

    try {
      const api = getCandidateApi();
      const persistedAnswer = await saveTextInputPracticeAnswer({
        sessionId: session.sessionId,
        questionId: session.question.questionId,
        transcript,
        saveAnswer: api.saveMockAnswer,
      });
      setSavedTranscript(persistedAnswer.transcript);
      const handoff = await queueTextInputNcsEvaluation({
        sessionId: session.sessionId,
        questionId: session.question.questionId,
        transcript: persistedAnswer.transcript,
        requestEvaluation: api.requestMockNcsEvaluation,
      });
      const pending: NcsTextPracticeRecovery = {
        version: 1,
        processLogId: handoff.processLogId,
        sessionId: session.sessionId,
        jobRole: session.jobRole,
        focus: session.focus,
        question: session.question,
        currentPrompt,
        transcript: persistedAnswer.transcript,
        followUpAttempt,
        storedAt: Date.now(),
      };
      saveNcsTextPracticeRecovery(window.sessionStorage, pending);
      setPendingEvaluation(pending);
      await resumePendingEvaluation(pending);
    } catch (evaluationError) {
      if ((evaluationError as Error)?.name !== "AbortError") {
        setError(errorMessage(evaluationError));
        setPhase("ANSWERING");
      }
    } finally {
      evaluationSubmissionRef.current = false;
    }
  }

  function handleFollowUp() {
    const suggestedQuestion = result?.followUp.suggestedQuestion;
    if (!suggestedQuestion || followUpAttempt > 0) return;
    setCurrentPrompt(suggestedQuestion);
    setAnswer("");
    setFollowUpAttempt(1);
    setResult(undefined);
    setError("");
    setMessage("");
    setPhase("ANSWERING");
  }

  async function handleComplete() {
    if (!session || sessionCompleted || !savedTranscript) return;
    setError("");
    setMessage("");
    try {
      const api = getCandidateApi();
      await saveTextInputPracticeAnswer({
        sessionId: session.sessionId,
        questionId: session.question.questionId,
        transcript: savedTranscript,
        saveAnswer: api.saveMockAnswer,
      });
      await api.completeMockInterview(session.sessionId);
      setSessionCompleted(true);
      setMessage("텍스트 연습을 완료했습니다.");
    } catch (completeError) {
      setError(errorMessage(completeError));
    }
  }

  async function handleNewQuestion() {
    if (session && savedTranscript && !sessionCompleted) {
      try {
        const api = getCandidateApi();
        await saveTextInputPracticeAnswer({
          sessionId: session.sessionId,
          questionId: session.question.questionId,
          transcript: savedTranscript,
          saveAnswer: api.saveMockAnswer,
        });
        await api.completeMockInterview(session.sessionId);
      } catch (completeError) {
        setError(errorMessage(completeError));
        return;
      }
    }
    pollingControllerRef.current?.abort();
    clearNcsTextPracticeRecovery(window.sessionStorage);
    setPendingEvaluation(undefined);
    setSession(undefined);
    setCurrentPrompt("");
    setAnswer("");
    setBaseTranscript("");
    setSavedTranscript("");
    setFollowUpAttempt(0);
    setResult(undefined);
    setSessionCompleted(false);
    setError("");
    setMessage("");
    setPhase("IDLE");
  }

  return (
    <CandidatePageShell active="interview">
      <section className={styles.page}>
        <CandidatePageHead
          eyebrow="NCS"
          title="텍스트 답변 연습"
          description="직무 역량 답변"
          actions={
            <Link className="btn secondary" href={candidateApplicationInterviewRoutes.mockInterviewStart}>
              화상 모의면접
            </Link>
          }
        />

        {!session ? (
          <section className={styles.setup} aria-labelledby="ncs-practice-setup-title">
            <div className={styles.setupHeading}>
              <span className={styles.stepLabel}>설정</span>
              <h2 id="ncs-practice-setup-title">연습할 직무와 질문을 선택하세요</h2>
            </div>
            <form className={styles.setupForm} onSubmit={handleStart}>
              <label className={styles.field}>
                <span>직무</span>
                <select
                  value={jobRole}
                  onChange={(event) => setJobRole(event.target.value as (typeof JOB_ROLES)[number])}
                >
                  {JOB_ROLES.map((role) => (
                    <option value={role} key={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className={styles.focusField}>
                <legend>질문 유형</legend>
                <div className={styles.segmented}>
                  {FOCUS_OPTIONS.map((option) => (
                    <label key={option.value}>
                      <input
                        type="radio"
                        name="practiceFocus"
                        value={option.value}
                        checked={focus === option.value}
                        onChange={() => setFocus(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className={styles.primaryButton} type="submit" disabled={busy}>
                {phase === "STARTING" ? "질문 준비 중" : "연습 시작"}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className={styles.workspace} aria-labelledby="ncs-current-question">
              <div className={styles.answerPane}>
                <div className={styles.questionMeta}>
                  <span>{followUpAttempt ? "추가 질문" : focusLabel(session.focus)}</span>
                  <span>{session.jobRole}</span>
                </div>
                <h2 id="ncs-current-question">{currentPrompt}</h2>
                <form className={styles.answerForm} onSubmit={handleEvaluate}>
                  <label htmlFor="ncs-practice-answer">답변</label>
                  <textarea
                    id="ncs-practice-answer"
                    value={answer}
                    maxLength={answerLimit}
                    placeholder="상황, 본인이 한 행동, 선택 이유와 확인한 결과를 중심으로 작성하세요."
                    readOnly={phase === "RESULT"}
                    disabled={busy || sessionCompleted}
                    onChange={(event) => setAnswer(event.target.value)}
                  />
                  <div className={styles.answerFooter}>
                    <span className={styles.characterCount}>
                      {answer.length.toLocaleString()} / {answerLimit.toLocaleString()}
                    </span>
                    <button
                      className={styles.primaryButton}
                      type="submit"
                      disabled={busy || phase === "RESULT" || sessionCompleted || !answer.trim()}
                    >
                      {phase === "QUEUED"
                        ? "평가 요청 중"
                        : phase === "RUNNING"
                          ? "답변 분석 중"
                          : phase === "DELAYED"
                            ? "처리 지연"
                            : phase === "RESULT"
                              ? "평가 완료"
                              : "답변 평가"}
                    </button>
                  </div>
                </form>
              </div>
              <aside className={styles.sessionPane} aria-label="연습 상태">
                <span className={styles.stepLabel}>세션</span>
                <dl>
                  <div>
                    <dt>직무</dt>
                    <dd>{session.jobRole}</dd>
                  </div>
                  <div>
                    <dt>질문</dt>
                    <dd>{focusLabel(session.focus)}</dd>
                  </div>
                  <div>
                    <dt>답변 단계</dt>
                    <dd>{followUpAttempt ? "근거 보완" : "첫 답변"}</dd>
                  </div>
                  <div>
                    <dt>평가 상태</dt>
                    <dd>{phaseLabel(phase)}</dd>
                  </div>
                </dl>
                {activelyPolling ? (
                  <div className={styles.progress} aria-label="평가 진행 중">
                    <span />
                  </div>
                ) : null}
              </aside>
            </section>

            <div className={styles.noticeRegion} aria-live="polite">
              <StatusNotice error={error || undefined} message={message || undefined} />
              {phase === "DELAYED" && pendingEvaluation ? (
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => void resumePendingEvaluation(pendingEvaluation)}
                >
                  기존 평가 다시 확인
                </button>
              ) : null}
            </div>

            {result && resultSummary ? (
              <section className={styles.result} aria-labelledby="ncs-result-title">
                <header className={styles.resultHeader}>
                  <div>
                    <span className={styles.stepLabel}>결과</span>
                    <h2 id="ncs-result-title">답변 평가</h2>
                  </div>
                  <span className={styles.coverageBadge} data-tone={result.coverage.status.toLowerCase()}>
                    평가 가능 범위 {Math.round(result.coverage.ratio * 100)}%
                  </span>
                </header>

                <div className={styles.summary}>
                  <div>
                    <span>행동 근거 점수</span>
                    <strong>{resultSummary.score === null ? "평가 보류" : String(resultSummary.score) + "점"}</strong>
                  </div>
                  <div>
                    <span>수준</span>
                    <strong>{resultSummary.levelLabel}</strong>
                  </div>
                  <div>
                    <span>확인된 근거</span>
                    <strong>{result.evidences.length}개</strong>
                  </div>
                  <div>
                    <span>답변 과정</span>
                    <strong>
                      {followUpAttempt
                        ? "꼬리질문 보완"
                        : result.followUp.required
                          ? "첫 답변 근거 부족"
                          : "첫 답변 완결"}
                    </strong>
                  </div>
                </div>

                {result.evaluationBasis ? (
                  <section className={styles.evaluationBasis} aria-labelledby="ncs-evaluation-basis-title">
                    <header>
                      <div>
                        <span data-source={result.evaluationBasis.sourceKind.toLowerCase()}>
                          {result.evaluationBasis.sourceKind === "OFFICIAL_NCS" ? "공식 NCS" : "서비스 합성 프로필"}
                        </span>
                        <h3 id="ncs-evaluation-basis-title">{result.evaluationBasis.unit.name}</h3>
                      </div>
                      <code>{result.evaluationBasis.unit.code}</code>
                    </header>
                    <p>{result.evaluationBasis.unit.definition}</p>
                    <ul>
                      {result.evaluationBasis.behaviorPoints.map((point) => (
                        <li key={point.behaviorPointId}>
                          <strong>{point.description}</strong>
                          <span>{point.requiredEvidence.map((type) => EVIDENCE_LABELS[type]).join(" · ")}</span>
                        </li>
                      ))}
                    </ul>
                    <small>{result.evaluationBasis.sourceVersion}</small>
                  </section>
                ) : null}

                <div className={styles.resultGrid}>
                  <section aria-labelledby="ncs-behavior-title">
                    <h3 id="ncs-behavior-title">행동 기준</h3>
                    <ul className={styles.behaviorList}>
                      {result.behaviorEvaluations.map((evaluation) => (
                        <BehaviorResult evaluation={evaluation} key={evaluation.behaviorPointId} />
                      ))}
                    </ul>
                  </section>
                  <section aria-labelledby="ncs-evidence-title">
                    <h3 id="ncs-evidence-title">발화 근거</h3>
                    {result.evidences.length ? (
                      <ul className={styles.evidenceList}>
                        {result.evidences.map((evidence) => (
                          <li key={evidence.evidenceId}>
                            <span>{EVIDENCE_LABELS[evidence.claimType]}</span>
                            <blockquote>{evidence.quote}</blockquote>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.emptyEvidence}>직접 인용할 수 있는 행동 근거가 없습니다.</p>
                    )}
                  </section>
                </div>

                {result.followUp.required ? (
                  <div className={styles.followUp} data-exhausted={followUpAttempt > 0}>
                    <div>
                      <span>{followUpAttempt > 0 ? "남은 근거" : "추가 질문"}</span>
                      <strong>
                        {followUpAttempt > 0
                          ? result.followUp.missingEvidence.map((item) => EVIDENCE_LABELS[item]).join(", ") ||
                            "구체적 행동 근거"
                          : result.followUp.suggestedQuestion}
                      </strong>
                    </div>
                    {followUpAttempt === 0 && result.followUp.suggestedQuestion ? (
                      <button className={styles.secondaryButton} type="button" onClick={handleFollowUp}>
                        추가 답변
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <footer className={styles.resultActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void handleComplete()}
                    disabled={sessionCompleted}
                  >
                    {sessionCompleted ? "연습 완료" : "연습 종료"}
                  </button>
                  <button className={styles.primaryButton} type="button" onClick={() => void handleNewQuestion()}>
                    새 질문
                  </button>
                </footer>
              </section>
            ) : null}
          </>
        )}

        {!session ? (
          <div className={styles.noticeRegion} aria-live="polite">
            <StatusNotice error={error || undefined} />
          </div>
        ) : null}
      </section>
    </CandidatePageShell>
  );
}

function BehaviorResult({ evaluation }: { evaluation: NcsBehaviorEvaluation }) {
  return (
    <li className={styles.behaviorItem} data-status={evaluation.status}>
      <div className={styles.behaviorHeading}>
        <strong>{evaluationStatusLabel(evaluation.status)}</strong>
        <span>{evaluation.score === null ? "점수 없음" : String(evaluation.score) + "점"}</span>
      </div>
      <p>{evaluation.rationale}</p>
      {evaluation.missingEvidence.length ? (
        <div className={styles.missingEvidence}>
          <span>보완</span>
          {evaluation.missingEvidence.map((item) => (
            <em key={item}>{EVIDENCE_LABELS[item]}</em>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function summarizeResult(result?: NcsEvaluationProductOutput) {
  if (!result) return undefined;
  const scored = result.behaviorEvaluations.filter(
    (
      evaluation,
    ): evaluation is NcsBehaviorEvaluation & {
      level: 1 | 2 | 3 | 4 | 5;
      score: 25 | 50 | 70 | 85 | 100;
    } => evaluation.level !== null && evaluation.score !== null,
  );
  if (!scored.length) {
    return { score: null, levelLabel: "근거 부족" };
  }
  const score = Math.round(scored.reduce((sum, item) => sum + item.score, 0) / scored.length);
  const level = Math.round(scored.reduce((sum, item) => sum + item.level, 0) / scored.length);
  return { score, levelLabel: levelLabel(level) };
}

function focusLabel(focus: PracticeFocus): string {
  return FOCUS_OPTIONS.find((option) => option.value === focus)?.label ?? focus;
}

function phaseLabel(phase: EvaluationPhase): string {
  const labels: Record<EvaluationPhase, string> = {
    IDLE: "설정 중",
    STARTING: "질문 준비 중",
    ANSWERING: "답변 작성 중",
    QUEUED: "평가 대기",
    RUNNING: "답변 분석 중",
    DELAYED: "처리 지연",
    RESULT: "평가 완료",
  };
  return labels[phase];
}

function evaluationStatusLabel(status: NcsBehaviorEvaluation["status"]): string {
  const labels: Record<NcsBehaviorEvaluation["status"], string> = {
    INSUFFICIENT_EVIDENCE: "근거 부족",
    NOT_DEMONSTRATED: "확인되지 않음",
    LIMITED: "제한적",
    DEVELOPING: "발전 중",
    DEMONSTRATED: "충분히 확인",
    STRONGLY_DEMONSTRATED: "명확히 확인",
  };
  return labels[status];
}

function levelLabel(level: number): string {
  return ["", "1단계", "2단계", "3단계", "4단계", "5단계"][level] ?? String(level) + "단계";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리할 수 없습니다.";
}
