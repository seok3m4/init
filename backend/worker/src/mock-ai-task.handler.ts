import { AiResultRepository } from "./ai-result.repository";
import { NonRetryableAiWorkerFailure } from "./worker-errors";
import { AiTaskHandler, AiTaskResult, AiWorkerJob } from "./worker.types";

interface WorkerInput {
  kind?: string;
  payload?: Record<string, unknown>;
}

const MOCK_HIRING_DECISION_TERMS = ["합격", "탈락", "채용 적합", "채용 부적합"];

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
    const transcript = requiredText(payload.transcript, "transcript");
    const policy = kind.startsWith("MOCK") ? "MOCK" : "RECRUITING";
    const content =
      policy === "MOCK"
        ? `Practice follow-up based on: ${shorten(transcript)}`
        : `Recruiting follow-up based on job evidence: ${shorten(transcript)}`;

    return {
      outputRef: JSON.stringify({ sessionId, answerId, policy }),
      guardrail: this.validateMockPolicy(policy, content),
      finalSave: () => this.results.saveFollowUpQuestion({ sessionId, answerId, content, policy })
    };
  }

  private criteriaSuggest(payload: Record<string, unknown>): AiTaskResult {
    const jobDescription = requiredText(payload.jobDescription, "jobDescription");
    const talentProfile = typeof payload.talentProfile === "string" ? payload.talentProfile : "team fit";
    const items = [`Problem solving from ${shorten(jobDescription)}`, `Talent fit: ${shorten(talentProfile)}`];

    return this.generatedDraft("CRITERIA_SUGGEST", items);
  }

  private questionGenerate(kind: string, payload: Record<string, unknown>): AiTaskResult {
    const questionCount = Number(payload.questionCount ?? 2);
    if (!Number.isInteger(questionCount) || questionCount <= 0) {
      throw new NonRetryableAiWorkerFailure("questionCount must be a positive integer");
    }

    const items = Array.from({ length: questionCount }, (_, index) =>
      kind.startsWith("MOCK")
        ? `Mock interview practice question ${index + 1}`
        : `Recruiting interview question ${index + 1}: ${shorten(requiredText(payload.jobDescription, "jobDescription"))}`
    );

    return this.generatedDraft(kind, items);
  }

  private questionSetGenerate(payload: Record<string, unknown>): AiTaskResult {
    positiveNumber(payload.postingId, "postingId");
    const questionCount = positiveNumber(payload.questionCount, "questionCount");
    const items = Array.from({ length: questionCount }, (_, index) => `Question set item ${index + 1}`);

    return this.generatedDraft("QUESTION_SET_GENERATE", items);
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

  private generatedDraft(kind: string, items: string[]): AiTaskResult {
    const guardrail = this.validateMockPolicy(kind.startsWith("MOCK") ? "MOCK" : "RECRUITING", items.join("\n"));
    return {
      outputRef: JSON.stringify({ kind, reviewRequired: true }),
      guardrail,
      finalSave: () =>
        this.results.saveGeneratedDraft({
          kind,
          items,
          reviewRequired: true
        })
    };
  }

  private validateMockPolicy(policy: "MOCK" | "RECRUITING", text: string) {
    if (policy !== "MOCK") {
      return { result: "PASS" as const, reason: null };
    }

    const banned = MOCK_HIRING_DECISION_TERMS.find((term) => text.includes(term));
    return banned
      ? { result: "BLOCKED" as const, reason: `mock interview output cannot include hiring decision expression: ${banned}` }
      : { result: "PASS" as const, reason: null };
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

function requiredText(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new NonRetryableAiWorkerFailure(`${name} is required`);
  }
  return value;
}

function shorten(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}
