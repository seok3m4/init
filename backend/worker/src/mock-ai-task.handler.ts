import {
  AiResultRepository,
  GeneratedDraftRecord,
  GeneratedReportRecord,
  GeneratedReportScoreRecord
} from "./ai-result.repository";
import { NonRetryableAiWorkerFailure } from "./worker-errors";
import { AiTaskHandler, AiTaskResult, AiWorkerJob } from "./worker.types";

interface WorkerInput {
  kind?: string;
  payload?: Record<string, unknown>;
}

const MOCK_HIRING_DECISION_TERMS = ["합격", "탈락", "채용 적합", "채용 부적합", "hiring decision", "pass/fail"];

export class MockAiTaskHandler implements AiTaskHandler {
  constructor(private readonly results: AiResultRepository) {}

  async handle(job: AiWorkerJob): Promise<AiTaskResult> {
    const input = parseInput(job.inputRef);
    const payload = input.payload ?? {};

    switch (job.processType) {
      case "DOCUMENT_EXTRACT":
        return this.documentExtract(payload);
      case "STT":
        return this.stt(payload);
      case "FOLLOW_UP":
        return this.followUp(input.kind ?? "RECRUITING_FOLLOW_UP", payload);
      case "REPORT_GENERATE":
        return this.reportGenerate(input.kind ?? "RECRUITING_REPORT_GENERATE", payload, job.processLogId);
      case "CRITERIA_SUGGEST":
        return this.criteriaSuggest(payload);
      case "QUESTION_GENERATE":
        return this.questionGenerate(input.kind ?? "RECRUITING_QUESTION_GENERATE", payload);
      case "QUESTION_SET_GENERATE":
        return this.questionSetGenerate(payload);
      case "EMBEDDING":
        return this.embedding(payload);
      default:
        throw new NonRetryableAiWorkerFailure(`unsupported process type: ${job.processType}`);
    }
  }

  private documentExtract(payload: Record<string, unknown>): AiTaskResult {
    if ("fileContent" in payload) {
      throw new NonRetryableAiWorkerFailure("raw file content must not be sent to document extraction worker");
    }

    const documentId = positiveNumber(payload.documentId, "documentId");
    const s3Key = requiredText(payload.s3Key, "s3Key");
    const extractedText = `Extracted text from ${s3Key}`;

    return {
      outputRef: JSON.stringify({ documentId, s3Key }),
      guardrail: { result: "PASS", reason: null },
      finalSave: () =>
        this.results.saveDocumentExtraction({
          documentId,
          s3Key,
          extractedText
        })
    };
  }

  private stt(payload: Record<string, unknown>): AiTaskResult {
    const answerId = positiveNumber(payload.answerId, "answerId");
    const audioS3Key = requiredText(payload.audioS3Key, "audioS3Key");
    const transcript = `Transcript generated from ${audioS3Key}`;

    return {
      outputRef: JSON.stringify({ answerId, audioS3Key }),
      guardrail: { result: "PASS", reason: null },
      finalSave: () => this.results.saveTranscript({ answerId, transcript })
    };
  }

  private followUp(kind: string, payload: Record<string, unknown>): AiTaskResult {
    const sessionId = positiveNumber(payload.sessionId, "sessionId");
    const answerId = positiveNumber(payload.answerId, "answerId");
    const previousQuestion = requiredText(payload.previousQuestion, "previousQuestion");
    const transcript = requiredText(payload.transcript, "transcript");
    const policy = kind.startsWith("MOCK") ? "MOCK" : "RECRUITING";
    const jobDescription = typeof payload.jobDescription === "string" ? payload.jobDescription : undefined;
    const documentSummary = typeof payload.documentSummary === "string" ? payload.documentSummary : undefined;
    const context =
      policy === "MOCK"
        ? previousQuestion
        : [previousQuestion, jobDescription, documentSummary]
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            .map(shorten)
            .join(" | ");
    const content =
      policy === "MOCK"
        ? `Practice follow-up for "${shorten(previousQuestion)}" based on: ${shorten(transcript)}`
        : `Recruiting follow-up using ${context} based on: ${shorten(transcript)}`;

    return {
      outputRef: JSON.stringify({ sessionId, answerId, policy, previousQuestion, jobDescription, documentSummary }),
      guardrail: this.validateMockPolicy(policy, content),
      finalSave: () => this.results.saveFollowUpQuestion({ sessionId, answerId, content, policy })
    };
  }

  private criteriaSuggest(payload: Record<string, unknown>): AiTaskResult {
    const postingId = positiveNumber(payload.postingId, "postingId");
    const jobDescription = requiredText(payload.jobDescription, "jobDescription");
    const talentProfile = requiredText(payload.talentProfile, "talentProfile");
    const evaluationPolicy = requiredText(payload.evaluationPolicy, "evaluationPolicy");
    const items = [
      `Problem solving from ${shorten(jobDescription)}`,
      `Talent fit: ${shorten(talentProfile)}`,
      `Evaluation policy alignment: ${shorten(evaluationPolicy)}`
    ];

    return this.generatedDraft("CRITERIA_SUGGEST", items, {
      postingId,
      targetTables: ["criterion_tags", "evaluation_criteria"]
    });
  }

  private reportGenerate(kind: string, payload: Record<string, unknown>, processLogId: number): AiTaskResult {
    switch (payload.step) {
      case "EVALUATION_CONTEXT":
        return this.evaluationContext(payload, processLogId);
      case "ANSWER_EVALUATION":
        return this.answerEvaluation(payload, processLogId);
      case "COMMUNICATION_ANALYSIS":
        return this.communicationAnalysis(payload, processLogId);
      default:
        return this.finalReportGenerate(kind, payload, processLogId);
    }
  }

  private evaluationContext(payload: Record<string, unknown>, processLogId: number): AiTaskResult {
    const reportType = reportTypeOf(payload.reportType);
    const reportId = optionalPositiveNumber(payload.reportId, "reportId") ?? processLogId;
    const company = requiredObject(payload.company, "company");
    const posting = requiredObject(payload.posting, "posting");
    const application = requiredObject(payload.application, "application");
    const context = {
      reportType,
      companyId: positiveNumber(company.companyId, "company.companyId"),
      postingId: positiveNumber(posting.postingId, "posting.postingId"),
      applicationId: positiveNumber(application.applicationId, "application.applicationId"),
      candidateId: positiveNumber(application.candidateId, "application.candidateId"),
      jobDescription: requiredText(posting.jobDescription, "posting.jobDescription"),
      criteria: criteriaOf(payload.criteria),
      answers: answersOf(payload.answers),
      documentText: typeof application.documentText === "string" ? application.documentText : undefined,
      manualEvaluations: Array.isArray(payload.manualEvaluations) ? payload.manualEvaluations : []
    };

    return {
      outputRef: JSON.stringify({
        processLogId,
        report: reportSnapshot(reportId, reportType),
        context
      }),
      guardrail: { result: "PASS", reason: null }
    };
  }

  private answerEvaluation(payload: Record<string, unknown>, processLogId: number): AiTaskResult {
    const reportType = reportTypeOf(payload.reportType);
    const reportId = optionalPositiveNumber(payload.reportId, "reportId") ?? processLogId;
    const scores = this.scoreReport(
      criteriaOf(payload.criteria),
      answersOf(payload.answers),
      typeof payload.documentText === "string" ? payload.documentText : undefined
    );
    const guardrail = this.validateScores(reportType, scores);
    const evidences = scores.flatMap((score) => score.evidences);

    return {
      outputRef: JSON.stringify({
        processLogId,
        report: reportSnapshot(reportId, reportType),
        scores,
        evidences,
        guardrail,
        stored: {
          scoreCount: scores.length,
          evidenceCount: evidences.length
        }
      }),
      guardrail,
      finalSave: () => this.results.saveReportScoresAndEvidences({ reportId, scores })
    };
  }

  private communicationAnalysis(payload: Record<string, unknown>, processLogId: number): AiTaskResult {
    const reportType = reportTypeOf(payload.reportType);
    const reportId = optionalPositiveNumber(payload.reportId, "reportId") ?? processLogId;
    if (payload.consentConfirmed !== true) {
      throw new NonRetryableAiWorkerFailure("consentConfirmed is required for communication analysis");
    }

    const communicationAnalysis = {
      usage: "AUXILIARY_ONLY" as const,
      mediaQuality: requiredText(payload.mediaQuality, "mediaQuality"),
      metrics: payload.metrics && typeof payload.metrics === "object" && !Array.isArray(payload.metrics) ? payload.metrics : {},
      notes: [
        "Communication metrics are auxiliary only and must not be used as a decisive hiring signal.",
        ...stringArrayOf(payload.notes)
      ],
      decisionWeight: 0
    };

    return {
      outputRef: JSON.stringify({
        processLogId,
        report: reportSnapshot(reportId, reportType),
        communicationAnalysis
      }),
      guardrail: { result: "PASS", reason: null }
    };
  }

  private finalReportGenerate(kind: string, payload: Record<string, unknown>, processLogId: number): AiTaskResult {
    const reportId = optionalPositiveNumber(payload.reportId, "reportId") ?? processLogId;
    const reportType = reportTypeOf(payload.reportType);
    const generatedSummary = typeof payload.summary === "string" && payload.summary.trim() ? payload.summary : undefined;
    const jobDescription = generatedSummary
      ? typeof payload.jobDescription === "string" && payload.jobDescription.trim()
        ? payload.jobDescription
        : "generated report content"
      : requiredText(payload.jobDescription, "jobDescription");
    const criteria = Array.isArray(payload.criteria)
      ? criteriaOf(payload.criteria)
      : generatedSummary
        ? [{ criterionId: 1, name: "Expression policy", weight: 0 }]
        : criteriaOf(payload.criteria);
    const answers = Array.isArray(payload.answers)
      ? answersOf(payload.answers)
      : generatedSummary
        ? [{ answerId: 1, transcript: generatedSummary }]
        : answersOf(payload.answers);
    const documentText = typeof payload.documentText === "string" ? payload.documentText : undefined;
    const scores = this.scoreReport(criteria, answers, documentText);
    const totalScore = Math.round(scores.reduce((sum, score) => sum + score.score, 0) / scores.length);
    const summary = generatedSummary ?? (reportType === "RECRUITING_REPORT"
        ? `Recruiting report generated from ${answers.length} answer(s) for ${shorten(jobDescription)}.`
        : `Mock interview feedback generated from ${answers.length} answer(s).`);
    const report: GeneratedReportRecord = {
      reportId,
      reportType,
      summary,
      totalScore,
      scores
    };
    const guardrail = this.validateReport(report);

    return {
      outputRef: JSON.stringify({
        reportId,
        reportType,
        summary,
        totalScore,
        scores,
        evidences: scores.flatMap((score) => score.evidences),
        guardrail
      }),
      guardrail,
      finalSave: () => this.results.saveGeneratedReport(report)
    };
  }

  private questionGenerate(kind: string, payload: Record<string, unknown>): AiTaskResult {
    const questionCount = Number(payload.questionCount ?? 2);
    if (!Number.isInteger(questionCount) || questionCount <= 0) {
      throw new NonRetryableAiWorkerFailure("questionCount must be a positive integer");
    }
    const postingId = kind.startsWith("MOCK") ? undefined : positiveNumber(payload.postingId, "postingId");

    const items = Array.from({ length: questionCount }, (_, index) =>
      kind.startsWith("MOCK")
        ? `Mock interview practice question ${index + 1}`
        : `Recruiting interview question ${index + 1}: ${shorten(requiredText(payload.jobDescription, "jobDescription"))}`
    );

    return this.generatedDraft(kind, items, {
      postingId,
      targetTables: ["question_bank"]
    });
  }

  private questionSetGenerate(payload: Record<string, unknown>): AiTaskResult {
    const postingId = positiveNumber(payload.postingId, "postingId");
    const questionCount = positiveNumber(payload.questionCount, "questionCount");
    const criteria = criteriaOf(payload.criteria);
    const questionTypes = nonEmptyStringArrayOf(payload.questionTypes, "questionTypes");
    const items = Array.from({ length: questionCount }, (_, index) => {
      const criterion = criteria[index % criteria.length];
      const questionType = questionTypes[index % questionTypes.length];
      return `${questionType} question ${index + 1} for ${criterion.name}`;
    });

    return this.generatedDraft("QUESTION_SET_GENERATE", items, {
      postingId,
      targetTables: ["question_bank"]
    });
  }

  private embedding(payload: Record<string, unknown>): AiTaskResult {
    const sourceType = requiredText(payload.sourceType, "sourceType");
    const sourceText = requiredText(payload.sourceText, "sourceText");
    const embeddingModel = typeof payload.embeddingModel === "string" ? payload.embeddingModel : "text-embedding-3-small";
    const embeddingDimension = Number(payload.embeddingDimension ?? 1536);
    if (!Number.isInteger(embeddingDimension) || embeddingDimension <= 0) {
      throw new NonRetryableAiWorkerFailure("embeddingDimension must be a positive integer");
    }

    return {
      outputRef: JSON.stringify({ sourceType }),
      finalSave: async () => {
        const embedding = await this.results.upsertEmbedding({
          sourceType,
          sourceText,
          embeddingModel,
          embeddingDimension,
          metadataJson: typeof payload.metadataJson === "string" ? payload.metadataJson : undefined
        });
        return void embedding;
      }
    };
  }

  private generatedDraft(
    kind: string,
    items: string[],
    options: {
      targetTables: GeneratedDraftRecord["targetTables"];
      postingId?: number;
    }
  ): AiTaskResult {
    const guardrail = this.validateMockPolicy(kind.startsWith("MOCK") ? "MOCK" : "RECRUITING", items.join("\n"));
    const draft = {
      kind,
      items,
      reviewRequired: true as const,
      targetTables: options.targetTables,
      postingId: options.postingId
    };
    return {
      outputRef: JSON.stringify(draft),
      guardrail,
      finalSave: () =>
        this.results.saveGeneratedDraft(draft)
    };
  }

  private validateMockPolicy(policy: "MOCK" | "RECRUITING", text: string) {
    if (policy !== "MOCK") {
      return { result: "PASS" as const, reason: null };
    }

    const banned = MOCK_HIRING_DECISION_TERMS.find((term) => text.includes(term));
    return banned
      ? {
          result: "BLOCKED" as const,
          reason: `mock interview output cannot include hiring decision expression: ${banned}`,
          failureCategory: "NON_RETRYABLE" as const
        }
      : { result: "PASS" as const, reason: null };
  }

  private scoreReport(
    criteria: Array<{ criterionId: number; name: string; weight: number }>,
    answers: Array<{ answerId: number; transcript: string }>,
    documentText?: string
  ): GeneratedReportScoreRecord[] {
    return criteria.map((criterion, index) => {
      const answer = answers[index % answers.length];
      const evidenceText = pickEvidence(answer.transcript, documentText);
      const score = Math.min(95, 70 + Math.min(10, Math.round(criterion.weight / 10)) + Math.min(10, Math.floor(evidenceText.length / 30)));
      return {
        criterionId: criterion.criterionId,
        criterionName: criterion.name,
        score,
        rationale: `${criterion.name} was evaluated from interview answer and document evidence.`,
        evidences: [
          {
            sourceType: "INTERVIEW_ANSWER",
            answerId: answer.answerId,
            text: pickEvidence(answer.transcript)
          },
          ...(documentText?.trim()
            ? [
                {
                  sourceType: "APPLICATION_DOCUMENT" as const,
                  documentRef: "payload.documentText",
                  text: pickEvidence(documentText)
                }
              ]
            : [])
        ]
      };
    });
  }

  private validateReport(report: GeneratedReportRecord) {
    return this.validateScores(report.reportType, report.scores, report.summary);
  }

  private validateScores(
    reportType: GeneratedReportRecord["reportType"],
    scores: GeneratedReportScoreRecord[],
    summary = ""
  ) {
    for (const score of scores) {
      if (!score.rationale.trim()) {
        return {
          result: "BLOCKED" as const,
          reason: `rationale is required for criterion ${score.criterionId}`,
          failureCategory: "NON_RETRYABLE" as const
        };
      }
      if (score.evidences.length === 0 || score.evidences.some((evidence) => !evidence.text.trim())) {
        return {
          result: "BLOCKED" as const,
          reason: `evidence is required for criterion ${score.criterionId}`,
          failureCategory: "NON_RETRYABLE" as const
        };
      }
    }

    if (reportType === "MOCK_INTERVIEW_REPORT") {
      const combinedText = [
        summary,
        ...scores.map((score) => score.rationale),
        ...scores.flatMap((score) => score.evidences.map((evidence) => evidence.text))
      ].join("\n");
      return this.validateMockPolicy("MOCK", combinedText);
    }

    return { result: "PASS" as const, reason: null };
  }
}

function parseInput(inputRef: string): WorkerInput {
  try {
    const parsed = JSON.parse(inputRef) as WorkerInput;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("inputRef must be a JSON object");
    }
    return parsed;
  } catch (error) {
    throw new NonRetryableAiWorkerFailure(error instanceof Error ? error.message : "invalid inputRef");
  }
}

function positiveNumber(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new NonRetryableAiWorkerFailure(`${name} must be a positive integer`);
  }
  return parsed;
}

function optionalPositiveNumber(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return positiveNumber(value, name);
}

function requiredText(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new NonRetryableAiWorkerFailure(`${name} is required`);
  }
  return value;
}

function requiredObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NonRetryableAiWorkerFailure(`${name} is required`);
  }
  return value as Record<string, unknown>;
}

function stringArrayOf(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function nonEmptyStringArrayOf(value: unknown, name: string): string[] {
  const values = stringArrayOf(value);
  if (values.length === 0) {
    throw new NonRetryableAiWorkerFailure(`${name} is required`);
  }
  return values;
}

function reportSnapshot(reportId: number, reportType: GeneratedReportRecord["reportType"]) {
  return {
    reportId,
    reportType,
    status: "GENERATING"
  };
}

function reportTypeOf(value: unknown): GeneratedReportRecord["reportType"] {
  if (value === "RECRUITING_REPORT" || value === "MOCK_INTERVIEW_REPORT") {
    return value;
  }
  throw new NonRetryableAiWorkerFailure("reportType is invalid");
}

function criteriaOf(value: unknown): Array<{ criterionId: number; name: string; weight: number }> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new NonRetryableAiWorkerFailure("criteria is required");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new NonRetryableAiWorkerFailure("criteria item must be an object");
    }
    const record = item as Record<string, unknown>;
    return {
      criterionId: positiveNumber(record.criterionId, "criterionId"),
      name: requiredText(record.name, "criterion name"),
      weight: Number.isFinite(Number(record.weight)) ? Number(record.weight) : 0
    };
  });
}

function answersOf(value: unknown): Array<{ answerId: number; transcript: string }> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new NonRetryableAiWorkerFailure("answers is required");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new NonRetryableAiWorkerFailure("answers item must be an object");
    }
    const record = item as Record<string, unknown>;
    return {
      answerId: positiveNumber(record.answerId, "answerId"),
      transcript: requiredText(record.transcript, "transcript")
    };
  });
}

function pickEvidence(transcript: string, documentText?: string): string {
  const source = transcript.trim() || documentText?.trim() || "";
  return shorten(source);
}

function shorten(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}
