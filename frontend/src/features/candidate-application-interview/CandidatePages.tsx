"use client";

import "./CandidatePages.module.css";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DependencyList, FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { getAccessToken } from "../../api/client";
import {
  CandidateApiError,
  type CandidateApplicationStatusView,
  type CandidateApplicationSummary,
  type CandidateFileAsset,
  type CandidateInterviewRuntimeView,
  type CandidateJobQuery,
  type CandidateMockInterviewHistoryItem,
  type CandidateMockReportFeedback,
  type CandidateMockReportMedia,
  type CandidateMockReportSummary,
  type CandidateRecruitingReportView,
  type InterviewRuntimeSessionView,
  type QuestionType,
  type RuntimeFileAssetRequest,
  type RuntimeQuestionListResponse,
  type RuntimeQuestionView,
  type SaveInterviewAnswerRequest,
  createCandidateApiClient,
} from "./api";
import { candidateApplicationInterviewRoutes } from "./routes";
import {
  type CandidateApplicationFormState,
  type CandidateDeviceCheckState,
  type CandidateInterviewConsentState,
  type CandidatePortfolioLinkFormState,
  type CandidateResumeUploadState,
  type InterviewAnswerFormState,
  type StartMockInterviewState,
  defaultApplicationFormState,
  defaultCandidateJobQuery,
  defaultDeviceCheckState,
  defaultInterviewAnswerFormState,
  defaultInterviewConsentState,
  defaultPortfolioLinkFormState,
  defaultStartMockInterviewState,
  createResumeUploadStateFromFile,
  getCandidateApplicationInterviewActionHref,
  getCandidateApplicationReportHref,
  getMockReportHref,
  inferPortfolioLinkType,
  isAllowedInterviewMediaMimeType,
  requiredInterviewConsents,
  toDeviceCheckRequest,
  toCreatePortfolioLinkRequest,
  toSaveInterviewAnswerRequest,
  toSaveInterviewConsentRequest,
  toStartMockInterviewRequest,
  toUploadResumeRequest,
} from "./view-model";
import { CandidateApplicationView, CandidateJobDetailView, CandidateJobsView } from "./views";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const DEMO_CANDIDATE_ID = 1;
const questionTypeOptions: QuestionType[] = ["INTRO", "TECHNICAL", "EXPERIENCE", "SITUATION", "CLOSING"];

type CandidateNavSection = "jobs" | "applications" | "interview" | "reports" | "mypage";
type AsyncState<T> = {
  data?: T;
  loading: boolean;
  error?: string;
};
type RuntimeMode = "mock" | "recruiting";
type RuntimePageData = {
  runtime: RuntimePageSession;
  questions: RuntimeQuestionListResponse;
};
type RuntimePageSession = {
  sessionId: number;
  applicationId?: number;
  interviewType: InterviewRuntimeSessionView["interviewType"];
  status: InterviewRuntimeSessionView["status"];
  showQuestionText: boolean;
  canRecord: boolean;
  totalQuestions: number;
  answeredCount: number;
  currentQuestion?: RuntimeQuestionView;
  nextQuestionEndpoint: string;
  answerUploadEndpoint: string;
};
type MockReportDetailData = {
  feedback?: CandidateMockReportFeedback;
  feedbackError?: string;
  media?: CandidateMockReportMedia;
  mediaError?: string;
};
type ApplicationReportData = {
  status?: CandidateApplicationStatusView;
  statusError?: string;
  report?: CandidateRecruitingReportView;
  reportError?: string;
};
type LastSavedAnswer = {
  answerId: number;
  questionText: string;
  transcript: string;
  audioFileId?: number;
  audioS3Key?: string;
  videoFileId?: number;
  videoS3Key?: string;
};
type CameraPreviewInfo = {
  width: number;
  height: number;
  trackLabel?: string;
  trackState?: MediaStreamTrackState;
};
type CameraStreamResult = {
  stream: MediaStream;
  audioEnabled: boolean;
  audioLabel?: string;
  audioState?: MediaStreamTrackState;
  audioError?: unknown;
  fallbackLabel?: string;
};
type MicrophoneProbeResult = {
  ok: boolean;
  label?: string;
  state?: MediaStreamTrackState;
  error?: unknown;
};

export function CandidateJobsPage() {
  const [query, setQuery] = useState<CandidateJobQuery>(defaultCandidateJobQuery);
  const load = useCallback(() => getCandidateApi().listJobs(query), [query]);
  const { data, loading, error } = useCandidateResource(load, [query]);

  return (
    <CandidatePageShell active="jobs">
      <header className="candidate-jobs-head">
        <h1>채용공고</h1>
        <p>지원 가능한 채용공고를 둘러보세요.</p>
      </header>
      <StatusNotice loading={loading} error={error} />
      <CandidateJobsView
        jobs={data?.data.items ?? []}
        query={query}
        totalItems={data?.meta.page.totalItems ?? 0}
        onQueryChange={setQuery}
      />
    </CandidatePageShell>
  );
}

export function CandidateJobDetailPage({ jobId }: { jobId: number }) {
  const load = useCallback(() => getCandidateApi().getJobDetail(jobId), [jobId]);
  const { data, loading, error } = useCandidateResource(load, [jobId]);

  return (
    <CandidatePageShell active="jobs">
      <StatusNotice loading={loading} error={error} />
      {data ? <CandidateJobDetailView job={data.data} /> : null}
    </CandidatePageShell>
  );
}

export function CandidateJobApplyPage({ jobId }: { jobId: number }) {
  const router = useRouter();
  const candidateId = getCurrentCandidateId();
  const [form, setForm] = useState<CandidateApplicationFormState>({
    ...defaultApplicationFormState,
    candidateName: "김지원",
    email: "jiwon@example.com",
    phone: "010-0000-0000",
    portfolioUrl: "https://github.com/jiwon",
  });
  const [latestResumeFile, setLatestResumeFile] = useState<CandidateFileAsset>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => getCandidateApi().getApplyView(jobId), [jobId]);
  const { data, loading, error } = useCandidateResource(load, [jobId]);

  async function handleResumeFileSelect(file: File) {
    setBusy(true);
    setMessage("");
    try {
      const uploadState = createResumeUploadStateFromFile(candidateId, file);
      const request = toUploadResumeRequest(uploadState);
      const result = await getCandidateApi().uploadResume(request);
      setLatestResumeFile(result.data);
      setForm((current) => ({ ...current, resumeFileId: result.data.fileId }));
      setMessage("이력서 파일 메타데이터가 등록되었습니다.");
    } catch (submitError) {
      setMessage(toErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function handleApplicationSubmit(request: Parameters<ReturnType<typeof getCandidateApi>["submitApplication"]>[1]) {
    setBusy(true);
    setMessage("");
    try {
      const api = getCandidateApi();
      if (request.portfolioUrl) {
        await api.createPortfolioLink(
          toCreatePortfolioLinkRequest({
            ...defaultPortfolioLinkFormState,
            url: request.portfolioUrl,
            linkType: inferPortfolioLinkType(request.portfolioUrl),
            description: request.coverLetter ?? "",
          }),
        );
      }
      const result = await api.submitApplication(jobId, request);
      setMessage(`지원서가 제출되었습니다. 접수 번호는 ${result.data.application.applicationId}번입니다.`);
      router.push(candidateApplicationInterviewRoutes.applications);
    } catch (submitError) {
      setMessage(toErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CandidatePageShell active="jobs">
      {data ? (
        <header className="candidate-apply-head">
          <h1>지원서 제출</h1>
          <p>{data.data.job.companyName} · {data.data.job.title}</p>
        </header>
      ) : null}
      <StatusNotice loading={loading || busy} error={error} message={message} />
      {data ? (
        <CandidateApplicationView
          busy={busy}
          job={data.data.job}
          latestResumeFile={latestResumeFile}
          state={form}
          onResumeFileSelect={handleResumeFileSelect}
          onStateChange={setForm}
          onSubmit={handleApplicationSubmit}
        />
      ) : null}
    </CandidatePageShell>
  );
}

export function CandidateApplicationsPage() {
  const load = useCallback(() => getCandidateApi().listApplications(), []);
  const { data, loading, error, refresh } = useCandidateResource(load, []);
  const applications = data?.data.items ?? [];
  const selectedApplication = applications[0];

  return (
    <CandidatePageShell active="applications">
      <CandidatePageHead
        eyebrow="지원현황"
        title="지원현황"
        description="지원 상태, 면접 상태, 리포트 상태를 한 곳에서 확인합니다."
        actions={
          <>
            <button className="btn secondary" type="button" onClick={refresh}>새로고침</button>
            <Link className="btn primary" href={candidateApplicationInterviewRoutes.jobs}>공고 찾기</Link>
          </>
        }
      />
      <StatusNotice loading={loading} error={error} />
      <section className="panel">
        {applications.length ? <ApplicationsTable applications={applications} /> : <p className="empty">제출된 지원서가 없습니다.</p>}
      </section>
      {selectedApplication ? (
        <section className="panel">
          <div className="panel-head">
            <p className="panel-title">선택한 지원 건 · {selectedApplication.companyName} / {selectedApplication.jobTitle}</p>
            <StatusPill value={selectedApplication.canStartInterview ? "응시 가능" : "응시 대기"} />
          </div>
          <div className="ph-box">AI 면접 방식, 유의사항, 답변 절차를 안내합니다.</div>
          <p className="label">응시 동의</p>
          <div className="toolbar">
            <span className="tag">{selectedApplication.consentCompleted ? "✓" : "☐"} 개인정보 수집 동의</span>
            <span className="tag">{selectedApplication.consentCompleted ? "✓" : "☐"} 영상/음성 수집 동의</span>
            <span className="tag">{selectedApplication.consentCompleted ? "✓" : "☐"} AI 분석 동의</span>
          </div>
          <p className="label">장치 점검</p>
          <div className="toolbar">
            <Link className="btn secondary" href={candidateApplicationInterviewRoutes.interviewGuide(selectedApplication.applicationId)}>카메라 점검</Link>
            <Link className="btn secondary" href={candidateApplicationInterviewRoutes.interviewGuide(selectedApplication.applicationId)}>마이크 점검</Link>
            <Link className="btn secondary" href={candidateApplicationInterviewRoutes.interviewGuide(selectedApplication.applicationId)}>네트워크 점검</Link>
          </div>
          <Link className="btn primary lg" href={candidateApplicationInterviewRoutes.interviewGuide(selectedApplication.applicationId)}>
            채용 AI 면접 시작
          </Link>
        </section>
      ) : null}
    </CandidatePageShell>
  );
}

export function CandidateInterviewGuidePage({ applicationId }: { applicationId: number }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [consentState, setConsentState] = useState<CandidateInterviewConsentState>(defaultInterviewConsentState);
  const [deviceState, setDeviceState] = useState<CandidateDeviceCheckState>(defaultDeviceCheckState);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => getCandidateApi().getInterviewGuide(applicationId), [applicationId]);
  const { data, loading, error, refresh } = useCandidateResource(load, [applicationId]);
  const guide = data?.data;

  useEffect(() => {
    return () => stopMediaStream(mediaStreamRef.current);
  }, []);

  useEffect(() => {
    if (guide) {
      setConsentState({ consentTypes: guide.requiredConsentTypes });
      setDeviceState({
        cameraGranted: guide.deviceCheckCompleted,
        microphoneGranted: guide.deviceCheckCompleted,
        networkStable: guide.deviceCheckCompleted,
      });
    }
  }, [guide]);

  async function handleConsentSubmit() {
    setBusy(true);
    setMessage("");
    try {
      await getCandidateApi().saveInterviewConsent(applicationId, toSaveInterviewConsentRequest(consentState));
      setMessage("필수 동의가 저장되었습니다.");
      refresh();
    } catch (submitError) {
      setMessage(toErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function handleDevicePreview() {
    setMessage("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("현재 브라우저에서 카메라/마이크 점검을 사용할 수 없습니다.");
      }
      stopMediaStream(mediaStreamRef.current);
      const { stream, audioEnabled, fallbackLabel } = await getCameraMediaStream();
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        await attachMediaStreamToVideo(videoRef.current, stream);
      }
      setDeviceState({ cameraGranted: true, microphoneGranted: audioEnabled, networkStable: navigator.onLine });
      setMessage(
        fallbackLabel
          ? `카메라를 연결했습니다. ${fallbackLabel} 장치 점검 저장을 눌러주세요.`
          : "카메라와 마이크 권한을 확인했습니다. 장치 점검 저장을 눌러주세요.",
      );
    } catch (previewError) {
      setDeviceState((current) => ({ ...current, networkStable: navigator.onLine }));
      setMessage(toErrorMessage(previewError));
    }
  }

  async function handleDeviceSubmit() {
    if (!guide) return;
    setBusy(true);
    setMessage("");
    try {
      await getCandidateApi().saveDeviceCheck(guide.sessionId, toDeviceCheckRequest(deviceState));
      setMessage("장치 점검이 저장되었습니다.");
      refresh();
    } catch (submitError) {
      setMessage(toErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function handleStartInterview() {
    setBusy(true);
    setMessage("");
    try {
      await getCandidateApi().startInterview(applicationId);
      router.push(candidateApplicationInterviewRoutes.interview(applicationId));
    } catch (submitError) {
      setMessage(toErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CandidatePageShell active="applications">
      <StatusNotice loading={loading || busy} error={error} message={message} />
      {guide ? (
        <>
          <CandidatePageHead
            eyebrow="면접 준비"
            title="채용 AI 면접 준비"
            description="필수 동의와 장치 점검이 완료되어야 면접을 시작할 수 있습니다."
            actions={<Link className="btn secondary" href={candidateApplicationInterviewRoutes.applications}>지원현황</Link>}
          />
          <section className="panel detail-stack">
            <div className="panel-head">
              <div>
                <h2>응시 안내</h2>
                <p>세션 ID {guide.sessionId} · {formatInterviewTypeLabel(guide.interviewType)}</p>
              </div>
              <StatusPill value={guide.canStart ? "START_READY" : "PREP_REQUIRED"} />
            </div>
            <dl className="candidate-feature__summary">
              <Definition label="응시 시작" value={formatDateTime(guide.interviewWindowStartsAt)} />
              <Definition label="응시 마감" value={formatDateTime(guide.interviewWindowEndsAt)} />
              <Definition label="동의 완료" value={guide.consentCompleted ? "완료" : "필요"} />
              <Definition label="장치 점검" value={guide.deviceCheckCompleted ? "완료" : "필요"} />
            </dl>
            <ListBlock title="진행 방식" items={guide.method} />
            <ListBlock title="필수 준비 사항" items={guide.requiredPreparations} />
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>필수 동의</h2>
                <p>개인정보, AI 분석, 녹화 동의를 저장합니다.</p>
              </div>
              <button className="btn secondary" type="button" disabled={busy} onClick={() => void handleConsentSubmit()}>
                동의 저장
              </button>
            </div>
            <div className="candidate-feature__checks">
              {requiredInterviewConsents.map((consentType) => (
                <label key={consentType}>
                  <input
                    type="checkbox"
                    checked={consentState.consentTypes.includes(consentType)}
                    onChange={() =>
                      setConsentState((current) => ({
                        consentTypes: toggleValue(current.consentTypes, consentType),
                      }))
                    }
                  />
                  {formatConsentTypeLabel(consentType)}
                </label>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>장치 점검</h2>
                <p>카메라, 마이크, 네트워크 상태를 확인합니다.</p>
              </div>
              <div className="toolbar">
                <button className="btn secondary" type="button" disabled={busy} onClick={() => void handleDevicePreview()}>
                  카메라 확인
                </button>
                <button className="btn secondary" type="button" disabled={busy} onClick={() => void handleDeviceSubmit()}>
                  점검 저장
                </button>
              </div>
            </div>
            <div className="candidate-runtime__preview">
              <video ref={videoRef} autoPlay muted playsInline />
              <dl className="candidate-feature__summary">
                <Definition label="카메라" value={deviceState.cameraGranted ? "허용" : "대기"} />
                <Definition label="마이크" value={deviceState.microphoneGranted ? "허용" : "대기"} />
                <Definition label="네트워크" value={deviceState.networkStable ? "정상" : "확인 필요"} />
              </dl>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>면접 시작</h2>
                <p>준비 상태가 모두 완료되면 채용 면접 런타임으로 이동합니다.</p>
              </div>
              <button className="btn primary" type="button" disabled={busy || !guide.canStart} onClick={() => void handleStartInterview()}>
                면접 시작
              </button>
            </div>
          </section>
        </>
      ) : null}
    </CandidatePageShell>
  );
}

export function CandidateInterviewPage({ applicationId }: { applicationId: number }) {
  const load = useCallback(async (): Promise<RuntimePageData> => {
    const api = getCandidateApi();
    const runtimeResult = await api.getInterviewRuntime(applicationId);
    const questionsResult = await api.listRecruitingQuestions(runtimeResult.data.sessionId);
    return {
      runtime: toRecruitingRuntimeSession(runtimeResult.data, questionsResult.data),
      questions: questionsResult.data,
    };
  }, [applicationId]);
  const resource = useCandidateResource(load, [applicationId]);

  return <InterviewRuntimePanel mode="recruiting" resource={resource} />;
}

export function CandidateMockInterviewStartPage() {
  const router = useRouter();
  const [state, setState] = useState<StartMockInterviewState>(defaultStartMockInterviewState);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const historyLoad = useCallback(() => getCandidateApi().listMockInterviewHistory(), []);
  const historyResource = useCandidateResource(historyLoad, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await getCandidateApi().startMockInterview(toStartMockInterviewRequest(state));
      router.push(candidateApplicationInterviewRoutes.mockInterview(result.data.sessionId));
    } catch (submitError) {
      setMessage(toErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CandidatePageShell active="interview">
      <CandidatePageHead
        eyebrow="모의면접"
        title="개인 연습용 AI 모의면접"
        description="합격/탈락 판단 없이 연습 피드백만 제공합니다."
        actions={<Link className="btn secondary" href={candidateApplicationInterviewRoutes.mockReports}>리포트 보기</Link>}
      />
      <StatusNotice loading={busy} message={message} />
      <form className="panel detail-stack candidate-mock-start-form" onSubmit={handleSubmit}>
        <p className="panel-title">모의면접 설정</p>
        <div className="candidate-mock-filters">
          <label className="candidate-filter-field">
            <span>직무</span>
            <select
              value={state.jobRole}
              onChange={(event) => setState((current) => ({ ...current, jobRole: event.target.value }))}
            >
              <option value="Backend">백엔드</option>
              <option value="Frontend">프론트엔드</option>
              <option value="Android">안드로이드</option>
              <option value="iOS">iOS</option>
              <option value="Full Stack">풀스택</option>
              <option value="AI">AI/ML</option>
            </select>
          </label>
          <label className="candidate-filter-field">
            <span>난이도</span>
            <select
              value={state.difficulty}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  difficulty: event.target.value as StartMockInterviewState["difficulty"],
                }))
              }
            >
              <option value="EASY">초급</option>
              <option value="NORMAL">중급</option>
              <option value="HARD">고급</option>
            </select>
          </label>
          <fieldset className="candidate-filter-field candidate-question-type-filter">
            <legend>질문 유형</legend>
            <div className="candidate-filter-chips">
              {questionTypeOptions.map((questionType) => (
                <label key={questionType}>
                  <input
                    type="checkbox"
                    checked={state.questionTypes?.includes(questionType) ?? false}
                    onChange={() =>
                      setState((current) => ({
                        ...current,
                        questionTypes: toggleValue(current.questionTypes ?? [], questionType),
                      }))
                    }
                  />
                  <span>{formatQuestionTypeLabel(questionType)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="toolbar candidate-mock-start-actions">
          <button className="btn primary" type="submit" disabled={busy}>모의면접 시작</button>
        </div>
      </form>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>연습 이력</h2>
            <p>이전 모의면접 기록과 리포트를 확인합니다.</p>
          </div>
        </div>
        <StatusNotice loading={historyResource.loading} error={historyResource.error} />
        {historyResource.data?.data.items.length ? (
          <MockHistoryTable history={historyResource.data.data.items} />
        ) : (
          <p className="empty">모의면접 이력이 없습니다.</p>
        )}
      </section>
    </CandidatePageShell>
  );
}

export function CandidateMockInterviewRuntimePage({ sessionId }: { sessionId: number }) {
  const load = useCallback(async (): Promise<RuntimePageData> => {
    const api = getCandidateApi();
    const [runtimeResult, questionsResult] = await Promise.all([
      api.getMockRuntime(sessionId),
      api.listMockQuestions(sessionId),
    ]);
    return {
      runtime: runtimeResult.data,
      questions: questionsResult.data,
    };
  }, [sessionId]);
  const resource = useCandidateResource(load, [sessionId]);

  return <InterviewRuntimePanel mode="mock" resource={resource} />;
}

export function CandidateMockReportsPage() {
  const load = useCallback(async () => {
    const api = getCandidateApi();
    const [reports, history] = await Promise.all([api.listMockReports(), api.listMockInterviewHistory()]);
    return {
      reports: reports.data.items,
      history: history.data.items,
    };
  }, []);
  const { data, loading, error, refresh } = useCandidateResource(load, []);

  return (
    <CandidatePageShell active="reports">
      <CandidatePageHead
        eyebrow="모의면접 리포트"
        title="모의면접 리포트"
        description="연습 이력과 생성된 피드백 리포트를 확인합니다."
        actions={
          <>
            <button className="btn secondary" type="button" onClick={refresh}>새로고침</button>
            <Link className="btn primary" href={candidateApplicationInterviewRoutes.mockInterviewStart}>모의면접 시작</Link>
          </>
        }
      />
      <StatusNotice loading={loading} error={error} />
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>리포트 목록</h2>
            <p>지원자에게 허용된 모의면접 피드백만 표시합니다.</p>
          </div>
        </div>
        {data?.reports.length ? <MockReportsTable reports={data.reports} /> : <p className="empty">아직 생성된 모의면접 리포트가 없습니다.</p>}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>연습 이력</h2>
            <p>모의면접 세션 진행 상태를 확인합니다.</p>
          </div>
        </div>
        {data?.history.length ? <MockHistoryTable history={data.history} /> : <p className="empty">모의면접 이력이 없습니다.</p>}
      </section>
    </CandidatePageShell>
  );
}

export function CandidateMockReportDetailPage({ reportId }: { reportId: number }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (): Promise<MockReportDetailData> => {
    const api = getCandidateApi();
    const [feedbackResult, mediaResult] = await Promise.allSettled([
      api.getMockReportFeedback(reportId),
      api.getMockReportMedia(reportId),
    ]);
    return {
      feedback: feedbackResult.status === "fulfilled" ? feedbackResult.value.data : undefined,
      feedbackError: feedbackResult.status === "rejected" ? toErrorMessage(feedbackResult.reason) : undefined,
      media: mediaResult.status === "fulfilled" ? mediaResult.value.data : undefined,
      mediaError: mediaResult.status === "rejected" ? toErrorMessage(mediaResult.reason) : undefined,
    };
  }, [reportId]);
  const { data, loading, error, refresh } = useCandidateResource(load, [reportId]);

  async function handleGenerate() {
    setBusy(true);
    setMessage("");
    try {
      const result = await getCandidateApi().requestMockReportGeneration(reportId);
      setMessage(`리포트 생성 요청이 접수되었습니다. 요청 상태: ${formatProcessTypeLabel(result.data.processType)}`);
      refresh();
    } catch (generateError) {
      setMessage(toErrorMessage(generateError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CandidatePageShell active="reports">
      <CandidatePageHead
        eyebrow="리포트 상세"
        title="모의면접 리포트"
        description="분석 결과를 지원자 연습용 피드백으로 확인합니다."
        actions={<Link className="btn secondary" href={candidateApplicationInterviewRoutes.mockReports}>목록</Link>}
      />
      <StatusNotice loading={loading || busy} error={error} message={message} />
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>종합 피드백</h2>
            <p>합격/탈락 판단이나 내부 점수는 노출하지 않습니다.</p>
          </div>
          <button className="btn secondary" type="button" disabled={busy} onClick={() => void handleGenerate()}>
            리포트 생성 요청
          </button>
        </div>
        {data?.feedback ? <MockFeedbackView feedback={data.feedback} /> : <p className="notice danger">{data?.feedbackError ?? "피드백을 불러오지 못했습니다."}</p>}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>역량별 점수</h2>
            <p>AI 리포트 점수 데이터가 연결되면 항목별 시각화를 표시합니다.</p>
          </div>
        </div>
        <div className="ph-box">현재 D 후보자 조회 API에는 역량 점수 필드가 없어, 피드백 텍스트 중심으로 표시합니다.</div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>영상 / 스크립트 동시 조회</h2>
            <p>본인 세션의 file_assets 참조만 표시합니다.</p>
          </div>
        </div>
        {data?.media ? <MockMediaView media={data.media} /> : <p className="notice danger">{data?.mediaError ?? "미디어를 불러오지 못했습니다."}</p>}
      </section>
    </CandidatePageShell>
  );
}

export function CandidateApplicationReportPage({ applicationId }: { applicationId: number }) {
  const load = useCallback(async (): Promise<ApplicationReportData> => {
    const api = getCandidateApi();
    const [statusResult, reportResult] = await Promise.allSettled([
      api.getApplicationStatus(applicationId),
      api.getApplicationReport(applicationId),
    ]);
    return {
      status: statusResult.status === "fulfilled" ? statusResult.value.data : undefined,
      statusError: statusResult.status === "rejected" ? toErrorMessage(statusResult.reason) : undefined,
      report: reportResult.status === "fulfilled" ? reportResult.value.data : undefined,
      reportError: reportResult.status === "rejected" ? toErrorMessage(reportResult.reason) : undefined,
    };
  }, [applicationId]);
  const { data, loading, error, refresh } = useCandidateResource(load, [applicationId]);

  return (
    <CandidatePageShell active="applications">
      <CandidatePageHead
        eyebrow="채용 결과"
        title="채용 AI 면접 결과"
        description={data?.status ? `${data.status.companyName} · ${data.status.jobTitle}` : "지원자에게 공개 가능한 제한 결과와 전형 상태만 표시합니다."}
        actions={
          <div className="toolbar">
            <StatusPill value="채용 리포트" />
            <StatusPill value="지원자 제한 조회" />
            <button className="btn secondary" type="button" onClick={refresh}>새로고침</button>
          </div>
        }
      />
      <StatusNotice loading={loading} error={error} />
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>전형 상태</h2>
            <p>지원서와 면접 세션 진행 상태를 확인합니다.</p>
          </div>
        </div>
        {data?.status ? <ApplicationStatusView status={data.status} /> : <p className="notice danger">{data?.statusError ?? "전형 상태를 불러오지 못했습니다."}</p>}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>지원자용 결과</h2>
            <p>기업용 상세 점수, 평가 근거, 내부 메모는 노출하지 않습니다.</p>
          </div>
        </div>
        {data?.report ? <RecruitingReportView report={data.report} /> : <p className="notice">{data?.reportError ?? "리포트가 아직 준비되지 않았습니다."}</p>}
      </section>
      <Link className="btn primary" href={candidateApplicationInterviewRoutes.applications}>지원현황으로 돌아가기</Link>
    </CandidatePageShell>
  );
}

export function CandidateMyPage() {
  const candidateId = getCurrentCandidateId();
  const [resumeState, setResumeState] = useState<CandidateResumeUploadState>({
    candidateId,
    storageKey: "",
    originalName: "",
    mimeType: "",
    sizeBytes: 0,
  });
  const [portfolioFileState, setPortfolioFileState] = useState<CandidateResumeUploadState>({
    candidateId,
    storageKey: "",
    originalName: "",
    mimeType: "",
    sizeBytes: 0,
  });
  const [portfolioState, setPortfolioState] = useState<CandidatePortfolioLinkFormState>(defaultPortfolioLinkFormState);
  const [latestResumeFile, setLatestResumeFile] = useState<CandidateFileAsset>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const portfolioInputRef = useRef<HTMLInputElement | null>(null);

  async function handleResumeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const request = toUploadResumeRequest(resumeState);
      const result = await getCandidateApi().uploadResume(request);
      setLatestResumeFile(result.data);
      setMessage("이력서가 업로드되었습니다.");
    } catch (submitError) {
      setMessage(toErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function handlePortfolioSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const api = getCandidateApi();
      let fileId = portfolioState.fileId;
      if (portfolioFileState.storageKey) {
        const fileResult = await api.uploadResume(toUploadResumeRequest(portfolioFileState));
        fileId = fileResult.data.fileId;
      }
      await api.createPortfolioLink(toCreatePortfolioLinkRequest({ ...portfolioState, fileId }));
      setPortfolioState(defaultPortfolioLinkFormState);
      setPortfolioFileState({ candidateId, storageKey: "", originalName: "", mimeType: "", sizeBytes: 0 });
      setMessage("포트폴리오/깃허브가 등록되었습니다.");
    } catch (submitError) {
      setMessage(toErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CandidatePageShell active="mypage">
      <section className="candidate-mypage">
        <header className="candidate-mypage__head">
          <h1>지원자 마이페이지</h1>
          <p>이력서와 포트폴리오를 관리합니다.</p>
        </header>
      <StatusNotice loading={busy} message={message} />
        <div className="candidate-mypage__cards">
          <form className="candidate-mypage-card candidate-resume-card" onSubmit={handleResumeSubmit}>
            <h2>이력서 업로드</h2>
            <button
              className="candidate-upload-drop"
              type="button"
              onClick={() => resumeInputRef.current?.click()}
            >
              <span className="candidate-upload-icon" aria-hidden="true">
                <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
                  <path d="M12 16V4m0 0-5 5m5-5 5 5M5 20h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                </svg>
              </span>
              <span>{resumeState.originalName || "PDF, DOCX 파일을 선택하세요"}</span>
            </button>
            <input
              ref={resumeInputRef}
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="candidate-hidden-file"
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) setResumeState(createResumeUploadStateFromFile(candidateId, file));
              }}
            />
            <button className="btn primary candidate-mypage-action" type="submit" disabled={busy}>
              업로드
            </button>
            <p className="candidate-mypage-note">
              {latestResumeFile
                ? `${latestResumeFile.originalName} 업로드 완료`
                : "업로드 후 서류 텍스트 추출 및 분석 대기 상태로 전환됩니다."}
            </p>
          </form>

          <form className="candidate-mypage-card candidate-portfolio-card" onSubmit={handlePortfolioSubmit}>
            <h2>포트폴리오 / 깃허브 등록</h2>
            <label>
              주소
              <input
                placeholder="https://github.com/..."
                type="url"
                value={portfolioState.url}
                onChange={(event) =>
                  setPortfolioState({
                    ...portfolioState,
                    url: event.currentTarget.value,
                    linkType: inferPortfolioLinkType(event.currentTarget.value),
                  })
                }
              />
            </label>
            <label>
              설명
              <input
                placeholder="프로젝트 설명"
                value={portfolioState.description}
                onChange={(event) => setPortfolioState({ ...portfolioState, description: event.currentTarget.value })}
              />
            </label>
            <label>
              파일 첨부
              <button
                className="candidate-file-picker"
                type="button"
                onClick={() => portfolioInputRef.current?.click()}
              >
                {portfolioFileState.originalName || "파일 선택"}
              </button>
              <input
                ref={portfolioInputRef}
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="candidate-hidden-file"
                type="file"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) setPortfolioFileState(createResumeUploadStateFromFile(candidateId, file));
                }}
              />
            </label>
            <button className="btn primary candidate-mypage-action" type="submit" disabled={busy}>
              등록
            </button>
          </form>
        </div>

        <section className="candidate-alert-card">
          <div className="candidate-alert-card__head">
            <h2>응시 안내 알림</h2>
            <span>v2.0</span>
          </div>
          <div className="candidate-alert-table" role="table" aria-label="응시 안내 알림">
            <div className="candidate-alert-row candidate-alert-row--head" role="row">
              <span role="columnheader">회사</span>
              <span role="columnheader">응시 링크</span>
              <span role="columnheader">마감일</span>
              <span role="columnheader">상태</span>
            </div>
            <div className="candidate-alert-row" role="row">
              <span role="cell">A사</span>
              <span role="cell">
                <Link className="candidate-alert-link" href={candidateApplicationInterviewRoutes.applications}>
                  면접 응시
                </Link>
              </span>
              <span role="cell">07.01</span>
              <span role="cell">
                <span className="candidate-alert-status">발송 완료</span>
              </span>
            </div>
          </div>
        </section>
      </section>
    </CandidatePageShell>
  );
}

function InterviewRuntimePanel({
  mode,
  resource,
}: {
  mode: RuntimeMode;
  resource: ReturnType<typeof useCandidateResource<RuntimePageData>>;
}) {
  const { data, loading, error, refresh } = resource;
  const router = useRouter();
  const currentQuestion = data?.runtime.currentQuestion;
  const [answer, setAnswer] = useState<InterviewAnswerFormState>(defaultInterviewAnswerFormState);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<LastSavedAnswer>();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [cameraPreviewStatus, setCameraPreviewStatus] = useState("카메라 대기");
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("");
  const [microphoneStatus, setMicrophoneStatus] = useState("마이크 대기");
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordedFileName, setRecordedFileName] = useState("");
  const [setupCompleted, setSetupCompleted] = useState(mode !== "mock");
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<number>>(() => new Set());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const microphoneFrameRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef(0);
  const submitAfterRecordingStopRef = useRef(false);
  const autoRecordingQuestionRef = useRef<number | null>(null);
  const hasAnswerFile = Boolean(answer.videoFile || answer.audioFile || answer.videoFileId || answer.audioFileId);
  const canSubmitAnswer = Boolean(currentQuestion && hasAnswerFile && answer.durationSeconds > 0 && !recording);
  const currentQuestionAnswered = Boolean(
    currentQuestion &&
      (answeredQuestionIds.has(currentQuestion.questionId) ||
        data?.questions.questions.some((question) => question.questionId === currentQuestion.questionId && question.answered)),
  );

  useEffect(() => {
    if (currentQuestion) {
      setAnswer((current) => ({ ...current, questionId: currentQuestion.questionId }));
      setRecordedFileName("");
      submitAfterRecordingStopRef.current = false;
    }
  }, [currentQuestion]);

  useEffect(() => {
    void refreshCameraDevices();
    return () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      stopMicrophoneMeter();
      stopMediaStream(streamRef.current);
    };
    // Camera/device probing is intentionally run once when the runtime panel mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data) return;
    setAnsweredQuestionIds((current) => {
      const next = new Set(current);
      data.questions.questions.forEach((question) => {
        if (question.answered) next.add(question.questionId);
      });
      return next.size === current.size ? current : next;
    });
  }, [data]);

  useEffect(() => {
    if (!setupCompleted || !streamRef.current || !videoRef.current) return;
    void attachMediaStreamToVideo(videoRef.current, streamRef.current);
  }, [setupCompleted]);

  useEffect(() => {
    if (!data || !setupCompleted || !cameraReady || !microphoneReady || !currentQuestion || currentQuestionAnswered) return;
    if (recording || answer.videoFile || answer.audioFile) return;
    if (autoRecordingQuestionRef.current === currentQuestion.questionId) return;
    autoRecordingQuestionRef.current = currentQuestion.questionId;
    void handleStartRecording();
    // Auto-recording is guarded by refs and should not restart on every function identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data?.runtime.sessionId,
    setupCompleted,
    cameraReady,
    microphoneReady,
    currentQuestion?.questionId,
    currentQuestionAnswered,
    recording,
    answer.videoFile,
    answer.audioFile,
  ]);

  async function refreshCameraDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === "videoinput");
    const audioDevices = devices.filter((device) => device.kind === "audioinput");
    setCameraDevices(videoDevices);
    setMicrophoneDevices(audioDevices);
    if (!selectedCameraId && videoDevices.length === 1) {
      setSelectedCameraId(videoDevices[0]?.deviceId ?? "");
    }
    if (!selectedMicrophoneId && audioDevices.length === 1) {
      setSelectedMicrophoneId(audioDevices[0]?.deviceId ?? "");
    }
  }

  function stopMicrophoneMeter() {
    if (microphoneFrameRef.current !== null) {
      window.cancelAnimationFrame(microphoneFrameRef.current);
      microphoneFrameRef.current = null;
    }
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setMicrophoneLevel(0);
  }

  function startMicrophoneMeter(stream: MediaStream) {
    stopMicrophoneMeter();
    const [audioTrack] = stream.getAudioTracks();
    if (!audioTrack) return;

    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;

    const audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    audioContextRef.current = audioContext;
    const samples = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      samples.forEach((sample) => {
        peak = Math.max(peak, Math.abs(sample - 128));
      });
      setMicrophoneLevel(Math.min(100, Math.round((peak / 128) * 100)));
      microphoneFrameRef.current = window.requestAnimationFrame(tick);
    };

    tick();
  }

  async function handleEnableCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("이 브라우저에서는 카메라/마이크를 사용할 수 없습니다.");
      return;
    }

    try {
      stopMicrophoneMeter();
      stopMediaStream(streamRef.current);
      setCameraReady(false);
      setMicrophoneReady(false);
      setCameraPreviewStatus("카메라 연결 중");
      setMicrophoneStatus("마이크 연결 중");
      const streamResult = await getCameraMediaStream(selectedCameraId, selectedMicrophoneId);
      const { stream, fallbackLabel } = streamResult;
      streamRef.current = stream;

      let previewInfo: CameraPreviewInfo | undefined;
      if (videoRef.current) {
        previewInfo = await attachMediaStreamToVideo(videoRef.current, stream);
      }

      setCameraReady(true);
      setMicrophoneReady(streamResult.audioEnabled);
      setCameraPreviewStatus(formatCameraPreviewStatus(previewInfo, fallbackLabel));
      setMicrophoneStatus(formatMicrophoneStatus(streamResult));
      if (streamResult.audioEnabled) {
        startMicrophoneMeter(stream);
      } else {
        setMicrophoneLevel(0);
      }
      await refreshCameraDevices();
      setMessage(fallbackLabel ? `카메라가 연결되었습니다. ${fallbackLabel}` : "카메라와 마이크가 연결되었습니다.");
    } catch (cameraError) {
      setCameraReady(false);
      stopMicrophoneMeter();
      const errorMessage = formatMediaError(cameraError);
      const microphoneProbe = await probeMicrophone(selectedMicrophoneId);
      setCameraPreviewStatus(`카메라 연결 실패: ${errorMessage}`);
      setMicrophoneReady(microphoneProbe.ok);
      setMicrophoneStatus(formatMicrophoneProbeStatus(microphoneProbe));
      setMessage(
        microphoneProbe.ok
          ? `${errorMessage} 마이크는 연결되지만 녹화를 위해 카메라 권한도 필요합니다.`
          : `${errorMessage} ${formatMicrophoneProbeStatus(microphoneProbe)}`,
      );
    }
  }

  async function handleEnterInterview() {
    if (!streamRef.current || !cameraReady || !microphoneReady) {
      await handleEnableCamera();
    }

    const stream = streamRef.current;
    const hasLiveVideo = stream?.getVideoTracks().some((track) => track.readyState === "live") ?? false;
    const hasLiveAudio = stream?.getAudioTracks().some((track) => track.readyState === "live") ?? false;
    if (!hasLiveVideo || !hasLiveAudio) {
      setMessage("카메라와 마이크 점검을 완료한 뒤 면접을 시작해주세요.");
      return;
    }

    setSetupCompleted(true);
    setMessage("면접이 시작되었습니다. 답변 녹화가 자동으로 진행됩니다.");
    if (currentQuestion) {
      autoRecordingQuestionRef.current = null;
      window.setTimeout(() => void handleStartRecording(), 0);
    }
  }

  async function handleStartRecording() {
    if (!data || !currentQuestion) return;
    if (!data.runtime.canRecord) {
      setMessage("이 세션은 녹화를 시작할 수 없는 상태입니다.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setMessage("이 브라우저에서는 녹화를 사용할 수 없습니다.");
      return;
    }

    if (!streamRef.current) {
      await handleEnableCamera();
    }

    const stream = streamRef.current;
    if (!stream) return;
    if (!stream.getAudioTracks().some((track) => track.readyState === "live")) {
      setMessage("마이크가 연결되지 않았습니다. 마이크 장치를 선택한 뒤 카메라 점검을 다시 눌러주세요.");
      setMicrophoneReady(false);
      return;
    }

    try {
      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || mimeType || "video/webm";
        const blob = new Blob(recordingChunksRef.current, { type: recordedMimeType });
        const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        const fileName = `${mode}-answer-${data.runtime.sessionId}-${currentQuestion.questionId}.${mediaFileExtension(recordedMimeType)}`;
        const audioFileName = `${mode}-answer-${data.runtime.sessionId}-${currentQuestion.questionId}-audio.webm`;
        const videoFile = createRuntimeFileAssetFromMetadata(fileName, recordedMimeType, blob.size);
        const audioFile = stream.getAudioTracks().some((track) => track.readyState === "live")
          ? createRuntimeFileAssetFromMetadata(audioFileName, "audio/webm", blob.size)
          : undefined;

        if (!videoFile) {
          setMessage("지원하지 않는 녹화 파일 형식입니다.");
          setRecording(false);
          return;
        }

        setAnswer((current) => ({
          ...current,
          questionId: currentQuestion.questionId,
          durationSeconds,
          videoFile,
          videoFileId: undefined,
          audioFile,
          audioFileId: undefined,
        }));
        setRecordedFileName(fileName);
        setRecording(false);
        if (submitAfterRecordingStopRef.current) {
          submitAfterRecordingStopRef.current = false;
          void submitAnswerRequest(
            toSaveInterviewAnswerRequest({
              questionId: currentQuestion.questionId,
              durationSeconds,
              videoFile,
              audioFile,
            }),
            currentQuestion,
          );
          return;
        }
        setMessage("녹화가 준비되었습니다. 답변 제출을 눌러 저장하세요.");
      };

      recorder.start();
      setRecordedFileName("");
      setRecording(true);
      setMessage("녹화 중입니다. 답변을 마치면 녹화 종료를 눌러주세요.");
    } catch (recordError) {
      setRecording(false);
      setMessage(toErrorMessage(recordError));
    }
  }

  function handleStopRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      recorder.stop();
      return;
    }
    setRecording(false);
  }

  function handleReplayPrompt() {
    setMessage("질문 음성을 다시 재생했습니다.");
  }

  async function submitAnswerRequest(request: SaveInterviewAnswerRequest, question = currentQuestion) {
    if (!data) return;
    setBusy(true);
    setMessage("");
    try {
      const api = getCandidateApi();
      const result =
        mode === "mock"
          ? await api.saveMockAnswer(data.runtime.sessionId, request)
          : await api.saveRecruitingAnswer(data.runtime.sessionId, request);
      setLastAnswer({
        answerId: result.data.answer.answerId,
        questionText: question?.content ?? question?.audioPrompt ?? "이전 질문",
        transcript: `${formatQuestionTypeLabel(question?.questionType)} 답변 파일이 저장되었습니다.`,
        audioFileId: result.data.audioFile?.fileId ?? result.data.answer.audioFileId,
        audioS3Key: result.data.audioFile?.storageKey,
        videoFileId: result.data.videoFile?.fileId ?? result.data.answer.videoFileId,
        videoS3Key: result.data.videoFile?.storageKey,
      });
      setAnsweredQuestionIds((current) => {
        const next = new Set(current);
        next.add(request.questionId);
        return next;
      });
      setMessage(`답변이 저장되었습니다. 답변 번호는 ${result.data.answer.answerId}번입니다.`);
      refresh();
    } catch (submitError) {
      setMessage(toErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitAnswer) {
      setMessage("녹화 종료 후 답변 제출을 눌러주세요.");
      return;
    }
    await submitAnswerRequest(toSaveInterviewAnswerRequest(answer));
  }

  function handleAnswerComplete() {
    if (currentQuestionAnswered) {
      setMessage("이미 저장된 답변입니다. 다음 질문으로 이동해주세요.");
      return;
    }

    if (recording) {
      submitAfterRecordingStopRef.current = true;
      handleStopRecording();
      return;
    }

    if (canSubmitAnswer) {
      void submitAnswerRequest(toSaveInterviewAnswerRequest(answer));
      return;
    }

    setMessage("답변 녹화가 아직 준비되지 않았습니다.");
  }

  async function handleNextQuestion() {
    if (!data) return;
    setBusy(true);
    setMessage("");
    try {
      const api = getCandidateApi();
      await (mode === "mock"
        ? api.moveMockNextQuestion(data.runtime.sessionId)
        : api.moveRecruitingNextQuestion(data.runtime.sessionId));
      setAnswer(defaultInterviewAnswerFormState);
      setRecordedFileName("");
      autoRecordingQuestionRef.current = null;
      refresh();
    } catch (submitError) {
      setMessage(toErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (!data) return;
    setBusy(true);
    setMessage("");
    try {
      const api = getCandidateApi();
      const result = await (mode === "mock"
        ? api.completeMockInterview(data.runtime.sessionId)
        : api.completeRecruitingInterview(data.runtime.sessionId));
      setMessage(`면접이 완료되었습니다. ${result.data.answeredCount}/${result.data.totalQuestions} 답변 제출`);
      if (mode === "recruiting" && data.runtime.applicationId) {
        router.push(candidateApplicationInterviewRoutes.applicationReport(data.runtime.applicationId));
        return;
      }
      router.push(candidateApplicationInterviewRoutes.mockReportDetail(result.data.sessionId));
    } catch (submitError) {
      setMessage(toErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  function handleNextOrComplete() {
    if (canCompleteInterview) {
      void handleComplete();
      return;
    }
    void handleNextQuestion();
  }

  const runtimeTitle = mode === "mock" ? "AI 모의면접 진행" : "채용 AI 면접 진행";
  const questionNumber = data
    ? Math.min(data.runtime.answeredCount + 1, data.runtime.totalQuestions || 1)
    : 0;
  const statusThirdLine = mode === "mock" ? "꼬리질문 생성 가능" : "업로드 상태 정상";
  const answeredQuestionCount = data
    ? data.questions.questions.filter((question) => question.answered || answeredQuestionIds.has(question.questionId)).length
    : 0;
  const canMoveNextQuestion = Boolean(data && currentQuestionAnswered && answeredQuestionCount < data.runtime.totalQuestions);
  const canCompleteInterview = Boolean(data && answeredQuestionCount === data.runtime.totalQuestions && !recording);

  return (
    <main className="candidate-interview-app">
      <header className="iv-top">
        <Link className="brand" href={candidateApplicationInterviewRoutes.mockInterviewStart}>
          <Image src="/logo-init.png" alt="init" width={1010} height={375} priority />
        </Link>
        <span className="center">{runtimeTitle}</span>
        <span className="timer" aria-label="남은 시간">01:30</span>
      </header>

      <section className="iv-body">
        <StatusNotice loading={loading || busy} error={error} message={message} />
        {data && !setupCompleted ? (
          <section className="candidate-device-setup">
            <div className="candidate-device-setup__head">
              <div>
                <p className="candidate-feature__eyebrow">장치 점검</p>
                <h1>카메라와 마이크를 확인해주세요</h1>
                <p>모의면접을 시작하면 답변 녹화가 자동으로 진행됩니다.</p>
              </div>
              <button className="btn primary" type="button" disabled={busy || !cameraReady || !microphoneReady} onClick={() => void handleEnterInterview()}>
                면접 시작
              </button>
            </div>
            <div className="candidate-device-setup__grid">
              <div className="video-box candidate-device-preview">
                <video ref={videoRef} autoPlay muted playsInline />
                <div className="camera-debug">{cameraPreviewStatus}</div>
                {!cameraReady ? (
                  <div className="vlabel">
                    <div className="vcam">⌾</div>
                    카메라 미리보기
                  </div>
                ) : null}
              </div>
              <aside className="panel candidate-runtime-status-panel">
                <p className="panel-title">장치 상태</p>
                <div className="status-list">
                  <div className="status-line"><span className={cameraReady ? "ok" : "wait"}>{cameraReady ? "✓" : "!"}</span> 카메라 {cameraReady ? "정상" : "대기"}</div>
                  <div className="status-line"><span className={microphoneReady ? "ok" : "wait"}>{microphoneReady ? "✓" : "!"}</span> {microphoneStatus}</div>
                  <div className="mic-meter" aria-label={`마이크 입력 ${microphoneLevel}%`}>
                    <span style={{ width: `${microphoneLevel}%` }} />
                  </div>
                  <div className="status-line"><span className="ok">✓</span> 네트워크 정상</div>
                </div>
                <div className="candidate-device-controls">
                  <select
                    aria-label="카메라 선택"
                    className="camera-select"
                    value={selectedCameraId}
                    onChange={(event) => setSelectedCameraId(event.target.value)}
                  >
                    <option value="">기본 카메라</option>
                    {cameraDevices.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `카메라 ${index + 1}`}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="마이크 선택"
                    className="camera-select"
                    value={selectedMicrophoneId}
                    onChange={(event) => setSelectedMicrophoneId(event.target.value)}
                  >
                    <option value="">기본 마이크</option>
                    {microphoneDevices.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `마이크 ${index + 1}`}
                      </option>
                    ))}
                  </select>
                  <button className="btn" type="button" disabled={busy || recording} onClick={() => void refreshCameraDevices()}>
                    장치 새로고침
                  </button>
                  <button className="btn" type="button" disabled={busy || recording} onClick={() => void handleEnableCamera()}>
                    카메라/마이크 점검
                  </button>
                </div>
              </aside>
            </div>
          </section>
        ) : null}
        {data && setupCompleted ? (
          <>
            <section className="q-card">
              {mode === "recruiting" ? <div className="qm">채용 AI 면접</div> : null}
              <div className="qn">질문 {questionNumber} / {data.runtime.totalQuestions}</div>
              <div className="qt">
                {currentQuestion
                  ? subtitlesEnabled
                    ? formatRuntimeQuestionPrompt(currentQuestion, true)
                    : "자막이 꺼져 있습니다. 질문 음성을 듣고 답변해주세요."
                  : "현재 질문을 불러올 수 없습니다."}
              </div>
            </section>

            <section className="iv-grid">
              <div className="video-box">
                <video ref={videoRef} autoPlay muted playsInline />
                <div className="camera-debug">{cameraPreviewStatus}</div>
                {recording ? (
                  <div className="recbadge"><span className="pulse" /> 녹화 중</div>
                ) : null}
                {!cameraReady ? (
                  <div className="vlabel">
                    <div className="vcam">⌾</div>
                    카메라 미리보기
                  </div>
                ) : null}
              </div>

              <aside className="panel candidate-runtime-status-panel">
                <p className="panel-title">답변 상태</p>
                <div className="status-list">
                  <div className="status-line"><span className={cameraReady ? "ok" : "wait"}>{cameraReady ? "✓" : "!"}</span> 카메라 {cameraReady ? "정상" : "대기"}</div>
                  <div className="status-line"><span className={microphoneReady ? "ok" : "wait"}>{microphoneReady ? "✓" : "!"}</span> {microphoneStatus}</div>
                  <div className="mic-meter" aria-label={`마이크 입력 ${microphoneLevel}%`}>
                    <span style={{ width: `${microphoneLevel}%` }} />
                  </div>
                  <div className="status-line"><span className="ok">✓</span> 네트워크 정상</div>
                  <div className="status-line"><span className={lastAnswer ? "ok" : "wait"}>{lastAnswer ? "✓" : "!"}</span> {statusThirdLine}</div>
                  <div className="status-line"><span className={recordedFileName || answer.videoFile ? "ok" : "wait"}>{recordedFileName || answer.videoFile ? "✓" : "!"}</span> 답변 파일 {recordedFileName || answer.videoFile ? "준비 완료" : "대기"}</div>
                </div>
                <dl className="candidate-runtime-meta">
                  <Definition label="세션" value={`#${data.runtime.sessionId}`} />
                  <Definition label="진행" value={`${data.runtime.answeredCount}/${data.runtime.totalQuestions}`} />
                  <Definition label="상태" value={<StatusPill value={data.runtime.status} />} />
                </dl>
              </aside>
            </section>

            <form className="candidate-runtime-form candidate-runtime-form--compact" onSubmit={handleSaveAnswer}>
              <div className="toolbar candidate-interview-controls">
                <button className="btn" type="button" onClick={handleReplayPrompt}>
                  질문 음성 다시 듣기
                </button>
                <button
                  className="btn primary"
                  type="button"
                  disabled={busy || !currentQuestion || currentQuestionAnswered || (!recording && !canSubmitAnswer)}
                  onClick={handleAnswerComplete}
                >
                  답변 완료
                </button>
                <button
                  className="btn"
                  type="button"
                  disabled={busy || recording || !(canMoveNextQuestion || canCompleteInterview)}
                  onClick={handleNextOrComplete}
                >
                  {canCompleteInterview ? "면접 완료" : "다음 질문"}
                </button>
                <button
                  className={`subtitle-toggle ${subtitlesEnabled ? "on" : ""}`}
                  type="button"
                  aria-pressed={subtitlesEnabled}
                  onClick={() => setSubtitlesEnabled((current) => !current)}
                >
                  {subtitlesEnabled ? "자막 ON" : "자막 OFF"}
                </button>
              </div>
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}

function CandidatePageShell({ active, children }: { active: CandidateNavSection; children: ReactNode }) {
  return (
    <main className="app-shell candidate-app">
      <CandidateNav active={active} />
      <section className="app-page">{children}</section>
    </main>
  );
}

function CandidateNav({ active }: { active: CandidateNavSection }) {
  const mockActive = active === "interview" || active === "reports";
  const recruitingActive = active === "jobs" || active === "applications";

  return (
    <header className="gnb">
      <div className="gnb-left">
        <Link className="brand" href={candidateApplicationInterviewRoutes.jobs}>
          <Image src="/logo-init.png" alt="init" width={1010} height={375} priority />
        </Link>
        <nav className="gnb-menu" aria-label="지원자 메뉴">
          <div className={`gnb-item ${mockActive ? "active" : ""}`}>
            <Link className="gnb-link" href={candidateApplicationInterviewRoutes.mockInterviewStart} aria-current={mockActive ? "page" : undefined}>
              AI 모의면접
              <span className="gnb-caret" aria-hidden="true">⌄</span>
            </Link>
            <div className="gnb-panel">
              <Link className={active === "interview" ? "active" : ""} href={candidateApplicationInterviewRoutes.mockInterviewStart}>
                면접시작
              </Link>
              <Link className={active === "reports" ? "active" : ""} href={candidateApplicationInterviewRoutes.mockReports}>
                평가 리포트
              </Link>
            </div>
          </div>
          <div className={`gnb-item ${recruitingActive ? "active" : ""}`}>
            <Link className="gnb-link" href={candidateApplicationInterviewRoutes.jobs} aria-current={recruitingActive ? "page" : undefined}>
              채용정보
              <span className="gnb-caret" aria-hidden="true">⌄</span>
            </Link>
            <div className="gnb-panel">
              <Link className={active === "jobs" ? "active" : ""} href={candidateApplicationInterviewRoutes.jobs}>
                채용공고
              </Link>
              <Link className={active === "applications" ? "active" : ""} href={candidateApplicationInterviewRoutes.applications}>
                지원현황
              </Link>
            </div>
          </div>
          <div className={`gnb-item ${active === "mypage" ? "active" : ""}`}>
            <Link className="gnb-link" href={candidateApplicationInterviewRoutes.mypage} aria-current={active === "mypage" ? "page" : undefined}>
              마이페이지
            </Link>
          </div>
        </nav>
      </div>
      <div className="gnb-right">
        <button className="icon-btn" aria-label="알림" type="button">
          <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
        <div className="avatar" aria-label="지원자 계정">JW</div>
      </div>
    </header>
  );
}

function CandidatePageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="toolbar">{actions}</div> : null}
    </div>
  );
}

function StatusNotice({ loading, error, message }: { loading?: boolean; error?: string; message?: string }) {
  if (error) {
    const loginRequired = error.includes("로그인");
    return (
      <div className="notice danger">
        <span>{error}</span>
        {loginRequired ? <Link className="btn secondary compact" href="/login">로그인으로 이동</Link> : null}
      </div>
    );
  }
  if (message) return <p className="notice">{message}</p>;
  if (loading) return <p className="notice">불러오는 중입니다.</p>;
  return null;
}

function ApplicationsTable({ applications }: { applications: CandidateApplicationSummary[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>지원서</th>
            <th>공고</th>
            <th>지원 상태</th>
            <th>면접 상태</th>
            <th>리포트</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.applicationId}>
              <td>#{application.applicationId}<span>{formatDateTime(application.submittedAt)}</span></td>
              <td>{application.companyName}<span>{application.jobTitle}</span></td>
              <td><StatusPill value={application.applicationStatus} /></td>
              <td><StatusPill value={application.interviewStatus} /></td>
              <td><StatusPill value={application.reportStatus} /></td>
              <td>
                <div className="toolbar">
                  <Link className="btn secondary compact" href={getCandidateApplicationInterviewActionHref(application)}>
                    {getInterviewActionLabel(application)}
                  </Link>
                  <Link className="btn secondary compact" href={getCandidateApplicationReportHref(application)}>
                    결과/요약
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getInterviewActionLabel(application: CandidateApplicationSummary): string {
  if (application.interviewStatus === "COMPLETED") return "면접 완료";
  if (application.interviewStatus === "IN_PROGRESS") return "면접 계속하기";
  if (application.canStartInterview || application.interviewStatus === "READY") return "AI 면접 응시하기";
  return "면접 준비";
}

function MockReportsTable({ reports }: { reports: CandidateMockReportSummary[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>리포트</th>
            <th>세션</th>
            <th>면접 상태</th>
            <th>리포트 상태</th>
            <th>답변</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.reportId}>
              <td>#{report.reportId}<span>{formatDateTime(report.updatedAt)}</span></td>
              <td>세션 #{report.sessionId}</td>
              <td><StatusPill value={report.status} /></td>
              <td><StatusPill value={report.reportStatus} /></td>
              <td>{report.answeredCount}/{report.totalQuestions}</td>
              <td>
                <Link className="btn secondary compact" href={getMockReportHref(report)}>상세</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockHistoryTable({ history }: { history: CandidateMockInterviewHistoryItem[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>세션</th>
            <th>면접 상태</th>
            <th>리포트 상태</th>
            <th>답변</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item) => (
            <tr key={item.sessionId}>
              <td>#{item.sessionId}<span>{formatDateTime(item.updatedAt)}</span></td>
              <td><StatusPill value={item.status} /></td>
              <td><StatusPill value={item.reportStatus} /></td>
              <td>{item.answeredCount}/{item.totalQuestions}</td>
              <td>
                {item.status === "IN_PROGRESS" ? (
                  <Link className="btn secondary compact" href={candidateApplicationInterviewRoutes.mockInterview(item.sessionId)}>이어하기</Link>
                ) : (
                  <Link className="btn secondary compact" href={candidateApplicationInterviewRoutes.mockReportDetail(item.reportId)}>리포트</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockFeedbackView({ feedback }: { feedback: CandidateMockReportFeedback }) {
  return (
    <div className="detail-stack">
      <dl className="candidate-feature__summary">
        <Definition label="상태" value={<StatusPill value={feedback.status} />} />
        <Definition label="생성 시각" value={feedback.generatedAt ? formatDateTime(feedback.generatedAt) : "-"} />
        <Definition label="공개 범위" value={feedback.visibilityPolicy.candidateFacingOnly ? "지원자용" : "확인 필요"} />
      </dl>
      <p className="description-box">{feedback.summary ?? "리포트 생성 중입니다."}</p>
      <ListBlock title="강점" items={feedback.strengths} />
      <ListBlock title="개선점" items={feedback.improvements} />
      <ListBlock title="다음 연습" items={feedback.nextPractice} />
    </div>
  );
}

function MockMediaView({ media }: { media: CandidateMockReportMedia }) {
  if (!media.media.length) return <p className="empty">연결된 답변 파일이 없습니다.</p>;
  const primary = media.media[0];
  return (
    <div className="detail-stack">
      <div className="iv-grid report-media-grid">
        <div className="video-box report-video-box">
          <div className="vlabel">
            <div className="vcam">▶</div>
            {primary.videoFile?.originalName ?? "답변 영상"}
          </div>
        </div>
        <div className="script-box">
          <strong>Q.</strong> {primary.questionContent ?? `질문 #${primary.questionId}`}<br /><br />
          <strong>A.</strong> {primary.transcript ?? primary.transcriptStatus}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>질문</th>
              <th>영상</th>
              <th>음성</th>
              <th>답변 시간</th>
              <th>스크립트</th>
            </tr>
          </thead>
          <tbody>
            {media.media.map((item) => (
              <tr key={item.answerId}>
                <td>#{item.questionId}<span>{formatQuestionTypeLabel(item.questionType)}</span></td>
                <td>{item.videoFile?.originalName ?? "-"}</td>
                <td>{item.audioFile?.originalName ?? "-"}</td>
                <td>{item.durationSeconds}s</td>
                <td>{item.transcript ?? item.transcriptStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApplicationStatusView({ status }: { status: CandidateApplicationStatusView }) {
  return (
    <dl className="candidate-feature__summary">
      <Definition label="회사" value={status.companyName} />
      <Definition label="공고" value={status.jobTitle} />
      <Definition label="지원 상태" value={<StatusPill value={status.applicationStatus} />} />
      <Definition label="서류 상태" value={<StatusPill value={status.documentStatus} />} />
      <Definition label="면접 상태" value={<StatusPill value={status.interviewStatus} />} />
      <Definition label="리포트 상태" value={<StatusPill value={status.reportStatus} />} />
      <Definition label="세션 ID" value={status.sessionId} />
      <Definition label="제출일" value={formatDateTime(status.submittedAt)} />
    </dl>
  );
}

function RecruitingReportView({ report }: { report: CandidateRecruitingReportView }) {
  return (
    <div className="detail-stack">
      <dl className="candidate-feature__summary">
        <Definition label="상태" value={<StatusPill value={report.status} />} />
        <Definition label="회사" value={report.companyName} />
        <Definition label="공고" value={report.jobTitle} />
        <Definition label="다음 단계" value={report.nextStepLabel} />
      </dl>
      <p className="description-box">{report.candidateMessage}</p>
      {report.summary ? <p className="description-box">{report.summary}</p> : null}
    </div>
  );
}

function formatRuntimeQuestionPrompt(question: RuntimeQuestionView, showText: boolean): string {
  if (showText && question.content) return question.content;
  return formatAudioPrompt(question.audioPrompt);
}

function formatAudioPrompt(audioPrompt?: string): string {
  if (!audioPrompt) return "질문을 준비 중입니다.";
  if (audioPrompt.startsWith("audio://")) return "음성 질문을 듣고 답변해주세요.";
  return audioPrompt;
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="candidate-section-title">{title}</h3>
      {items.length ? (
        <ul className="candidate-feature__tags">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="empty">표시할 항목이 없습니다.</p>
      )}
    </div>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StatusPill({ value }: { value: ReactNode }) {
  const text = String(value);
  const tone = getStatusTone(text);
  return <span className={`badge ${tone}`}>{formatStatusLabel(text)}</span>;
}

function getStatusTone(value: string): "success" | "warning" | "neutral" {
  const successValues = new Set([
    "ANSWERED",
    "COMPLETED",
    "EXTRACTED",
    "INTERVIEW_DONE",
    "OPEN",
    "PASSED",
    "READY",
    "START_READY",
    "SUBMITTED",
    "응시 가능",
  ]);
  const warningValues = new Set([
    "CURRENT",
    "EXTRACTING",
    "GENERATING",
    "IN_PROGRESS",
    "IN_REVIEW",
    "INTERVIEW_WAITING",
    "NOT_READY",
    "NOT_SUBMITTED",
    "PENDING",
    "PREP_REQUIRED",
    "WAITING",
    "응시 대기",
  ]);

  if (successValues.has(value)) return "success";
  if (warningValues.has(value)) return "warning";
  return "neutral";
}

function formatStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    ACTIVE: "활성",
    ANSWERED: "답변 완료",
    APPLIED: "지원 완료",
    ARCHIVED: "보관",
    CLOSED: "마감",
    COMPLETED: "완료",
    CURRENT: "현재 질문",
    DRAFT: "임시저장",
    EXTRACTED: "추출 완료",
    EXTRACTING: "추출 중",
    FAILED: "실패",
    GENERATING: "생성 중",
    IN_PROGRESS: "진행 중",
    IN_REVIEW: "검토 중",
    INTERVIEW_DONE: "면접 완료",
    INTERVIEW_WAITING: "면접 대기",
    INVITED: "초대됨",
    NOT_READY: "준비 전",
    NOT_SUBMITTED: "미제출",
    OPEN: "공개",
    PASSED: "통과",
    PENDING: "대기",
    PREP_REQUIRED: "준비 필요",
    READY: "준비 완료",
    REJECTED: "반려",
    START_READY: "응시 가능",
    SUBMITTED: "제출 완료",
    CANCELED: "취소",
    WAITING: "대기",
    "채용 리포트": "채용 리포트",
    "지원자 제한 조회": "지원자 제한 조회",
    "응시 가능": "응시 가능",
    "응시 대기": "응시 대기",
  };

  return labels[value] ?? value;
}

function formatQuestionTypeLabel(questionType?: string): string {
  const labels: Record<string, string> = {
    INTRO: "자기소개",
    TECHNICAL: "기술 질문",
    EXPERIENCE: "경험 질문",
    SITUATION: "상황 질문",
    CLOSING: "마무리",
    INTERVIEW: "면접",
  };

  return questionType ? labels[questionType] ?? questionType : "면접";
}

function formatConsentTypeLabel(consentType: string): string {
  const labels: Record<string, string> = {
    PRIVACY_COLLECTION: "개인정보 수집·이용 동의",
    AI_DOCUMENT_ANALYSIS: "이력서/포트폴리오 AI 분석 동의",
    AI_INTERVIEW_RECORDING: "AI 면접 녹화·녹음 안내 확인",
  };

  return labels[consentType] ?? consentType;
}

function formatInterviewTypeLabel(interviewType: string): string {
  const labels: Record<string, string> = {
    MOCK: "모의면접",
    RECRUITING: "채용 면접",
  };

  return labels[interviewType] ?? interviewType;
}

function formatProcessTypeLabel(processType: string): string {
  const labels: Record<string, string> = {
    STT: "음성 텍스트 변환",
    FOLLOW_UP: "꼬리질문 생성",
    REPORT_GENERATE: "리포트 생성",
  };

  return labels[processType] ?? processType;
}

function useCandidateResource<T>(load: () => Promise<T>, dependencies: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((current) => current + 1), []);

  useEffect(() => {
    let alive = true;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    load()
      .then((data) => {
        if (alive) setState({ data, loading: false });
      })
      .catch((error) => {
        if (alive) setState({ loading: false, error: toErrorMessage(error) });
      });
    return () => {
      alive = false;
    };
    // The dependency list is supplied by each caller, mirroring React's hook API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshKey, ...dependencies]);

  return { ...state, refresh };
}

function getCandidateApi() {
  return createCandidateApiClient({
    baseUrl: API_BASE_URL,
    headers: getCandidateHeaders(),
  });
}

function getCandidateHeaders(): HeadersInit {
  const token = readAccessToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

function readAccessToken(): string | null {
  return getAccessToken();
}

function getCurrentCandidateId(): number {
  const token = readAccessToken();
  if (!token) return DEMO_CANDIDATE_ID;

  try {
    const [, payload] = token.split(".");
    if (!payload) return DEMO_CANDIDATE_ID;
    const decoded = JSON.parse(window.atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { candidateId?: number };
    return decoded.candidateId ?? DEMO_CANDIDATE_ID;
  } catch {
    return DEMO_CANDIDATE_ID;
  }
}

function toRecruitingRuntimeSession(
  runtime: CandidateInterviewRuntimeView,
  questions: RuntimeQuestionListResponse,
): RuntimePageSession {
  const currentQuestion =
    questions.questions.find((question) => question.current) ??
    questions.questions.find((question) => question.questionId === questions.currentQuestionId);

  return {
    sessionId: runtime.sessionId,
    applicationId: runtime.applicationId,
    interviewType: runtime.interviewType,
    status: runtime.status,
    showQuestionText: runtime.showQuestionText,
    canRecord: runtime.canRecord,
    totalQuestions: questions.questions.length,
    answeredCount: questions.questions.filter((question) => question.answered).length,
    currentQuestion,
    nextQuestionEndpoint: runtime.nextQuestionEndpoint,
    answerUploadEndpoint: runtime.answerUploadEndpoint,
  };
}

function createRuntimeFileAssetFromMetadata(
  originalName: string,
  mimeType: string,
  sizeBytes: number,
): RuntimeFileAssetRequest | undefined {
  const normalizedMimeType = normalizeInterviewMediaMimeType(mimeType);
  if (!normalizedMimeType) return undefined;
  return {
    storageKey: `candidate/${getCurrentCandidateId()}/interviews/${Date.now()}-${safeFileName(originalName)}`,
    originalName,
    mimeType: normalizedMimeType,
    sizeBytes,
  };
}

function normalizeInterviewMediaMimeType(mimeType: string): RuntimeFileAssetRequest["mimeType"] | undefined {
  const baseMimeType = mimeType.split(";")[0]?.trim().toLowerCase();
  return isAllowedInterviewMediaMimeType(baseMimeType) ? baseMimeType : undefined;
}

function getSupportedRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((mimeType) =>
    MediaRecorder.isTypeSupported(mimeType),
  );
}

function mediaFileExtension(mimeType: string): "mp4" | "webm" {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

function safeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "answer";
}

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function getCameraMediaStream(cameraDeviceId = "", microphoneDeviceId = ""): Promise<CameraStreamResult> {
  const videoAttempts: Array<MediaTrackConstraints | boolean> = cameraDeviceId
    ? [{ deviceId: { ideal: cameraDeviceId } }, true]
    : [{ facingMode: "user" }, true];
  const audioAttempts: Array<MediaTrackConstraints | boolean> = microphoneDeviceId
    ? [{ deviceId: { ideal: microphoneDeviceId } }, true]
    : [true];
  let lastError: unknown;
  let lastAudioError: unknown;

  for (const video of videoAttempts) {
    for (const audio of audioAttempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
        const [audioTrack] = stream.getAudioTracks();
        return {
          stream,
          audioEnabled: Boolean(audioTrack),
          audioLabel: audioTrack?.label,
          audioState: audioTrack?.readyState,
        };
      } catch (errorWithAudio) {
        lastAudioError = errorWithAudio;
        lastError = errorWithAudio;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      return {
        stream,
        audioEnabled: false,
        audioError: lastAudioError,
        fallbackLabel: `마이크 연결 실패: ${formatMediaError(lastAudioError, "microphone")} 카메라만 연결했습니다.`,
      };
    } catch (errorWithoutAudio) {
      lastError = errorWithoutAudio;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("카메라 연결에 실패했습니다.");
}

async function probeMicrophone(microphoneDeviceId = ""): Promise<MicrophoneProbeResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: new Error("이 브라우저에서는 마이크를 사용할 수 없습니다.") };
  }

  try {
    const audio = microphoneDeviceId ? { deviceId: { ideal: microphoneDeviceId } } : true;
    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio });
    const [track] = stream.getAudioTracks();
    const result: MicrophoneProbeResult = {
      ok: Boolean(track),
      label: track?.label,
      state: track?.readyState,
    };
    stopMediaStream(stream);
    return result;
  } catch (error) {
    return { ok: false, error };
  }
}

async function attachMediaStreamToVideo(video: HTMLVideoElement, stream: MediaStream): Promise<CameraPreviewInfo> {
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = null;
  video.srcObject = stream;

  await waitForVideoMetadata(video);
  await video.play();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const [track] = stream.getVideoTracks();
  return {
    width: video.videoWidth,
    height: video.videoHeight,
    trackLabel: track?.label,
    trackState: track?.readyState,
  };
}

function waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", done);
      video.removeEventListener("canplay", done);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const timeoutId = window.setTimeout(done, 1500);
    video.addEventListener("loadedmetadata", done, { once: true });
    video.addEventListener("canplay", done, { once: true });
  });
}

function formatCameraPreviewStatus(info?: CameraPreviewInfo, fallbackLabel?: string): string {
  if (!info) return "카메라 연결됨";
  const size = info.width > 0 && info.height > 0 ? `${info.width}x${info.height}` : "프레임 없음";
  const label = info.trackLabel || "선택된 카메라";
  return [label, size, info.trackState ?? "live", fallbackLabel].filter(Boolean).join(" · ");
}

function formatMicrophoneStatus(result: CameraStreamResult): string {
  if (result.audioEnabled) {
    return `${result.audioLabel || "선택된 마이크"} · ${result.audioState ?? "live"}`;
  }
  return `마이크 실패: ${formatMediaError(result.audioError, "microphone")}`;
}

function formatMicrophoneProbeStatus(result: MicrophoneProbeResult): string {
  if (result.ok) {
    return `${result.label || "선택된 마이크"} · ${result.state ?? "live"} · 카메라 권한 대기`;
  }
  return `마이크 연결 실패: ${formatMediaError(result.error, "microphone")}`;
}

function formatMediaError(error: unknown, device: "camera" | "microphone" = "camera"): string {
  const label = device === "microphone" ? "마이크" : "카메라";
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return `브라우저 ${label} 권한이 차단되어 있습니다. 주소창 권한 설정에서 허용한 뒤 다시 시도해주세요.`;
    if (error.name === "NotFoundError") return `사용 가능한 ${label} 장치를 찾지 못했습니다.`;
    if (error.name === "NotReadableError") return `다른 앱이 ${label}를 사용 중이거나 장치를 읽을 수 없습니다.`;
    if (error.name === "OverconstrainedError") return `선택한 ${label} 조건을 만족하는 장치를 찾지 못했습니다.`;
    return `${error.name}: ${error.message}`;
  }
  return error instanceof Error ? error.message : `${label} 연결에 실패했습니다.`;
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value];
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof CandidateApiError) {
    if (error.status === 401) return "로그인 후 이용해주세요. 지원자 계정으로 로그인하면 본인 지원현황과 면접 세션만 표시됩니다.";
    return error.body?.error.message ?? error.message;
  }
  return error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
}
