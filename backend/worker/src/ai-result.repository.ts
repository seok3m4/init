import { createHash } from "node:crypto";

export interface DocumentExtractionRecord {
  documentId: number;
  s3Key: string;
  extractedText: string;
}

export interface DocumentExtractionStatusRecord {
  documentId: number;
}

export interface FailedDocumentExtractionRecord {
  documentId: number;
}

export interface TranscriptRecord {
  answerId: number;
  transcript: string;
}

export interface FollowUpQuestionRecord {
  sessionId: number;
  answerId: number;
  content: string;
  policy: "MOCK" | "RECRUITING";
}

export interface GeneratedDraftRecord {
  kind: string;
  items: string[];
  reviewRequired: true;
}

export interface GeneratedReportEvidenceRecord {
  sourceType: "INTERVIEW_ANSWER" | "APPLICATION_DOCUMENT";
  answerId?: number;
  documentId?: number;
  documentRef?: string;
  text: string;
}

export interface GeneratedReportScoreRecord {
  criterionId: number;
  criterionName: string;
  score: number;
  rationale: string;
  evidences: GeneratedReportEvidenceRecord[];
}

export interface GeneratedReportRecord {
  reportId: number;
  reportType: "RECRUITING_REPORT" | "MOCK_INTERVIEW_REPORT";
  summary: string;
  totalScore: number;
  scores: GeneratedReportScoreRecord[];
}

export interface FailedReportRecord {
  reportId: number;
  reportType: "RECRUITING_REPORT" | "MOCK_INTERVIEW_REPORT";
  failureCategory: "RETRYABLE" | "NON_RETRYABLE";
  failureReason: string;
}

export interface EmbeddingRecord {
  sourceType: string;
  sourceTextHash: string;
  embeddingModel: string;
  embeddingDimension: number;
  metadataJson?: string;
}

export interface AiResultRepository {
  markDocumentExtractionStarted(record: DocumentExtractionStatusRecord): Promise<void>;
  saveDocumentExtraction(record: DocumentExtractionRecord): Promise<void>;
  markDocumentExtractionFailed(record: FailedDocumentExtractionRecord): Promise<void>;
  saveTranscript(record: TranscriptRecord): Promise<void>;
  saveFollowUpQuestion(record: FollowUpQuestionRecord): Promise<void>;
  saveGeneratedDraft(record: GeneratedDraftRecord): Promise<void>;
  saveGeneratedReport(record: GeneratedReportRecord): Promise<void>;
  markReportFailed(record: FailedReportRecord): Promise<void>;
  upsertEmbedding(record: Omit<EmbeddingRecord, "sourceTextHash"> & { sourceText: string }): Promise<EmbeddingRecord>;
}

export class InMemoryAiResultRepository implements AiResultRepository {
  readonly documentExtractions: DocumentExtractionRecord[] = [];
  readonly documentParseStatuses = new Map<number, "EXTRACTING" | "EXTRACTED" | "FAILED">();
  readonly documentParseStatusEvents: Array<{ documentId: number; status: "EXTRACTING" | "EXTRACTED" | "FAILED" }> = [];
  readonly transcripts: TranscriptRecord[] = [];
  readonly followUpQuestions: FollowUpQuestionRecord[] = [];
  readonly generatedDrafts: GeneratedDraftRecord[] = [];
  readonly generatedReports = new Map<number, GeneratedReportRecord>();
  readonly failedReports = new Map<number, FailedReportRecord>();
  readonly embeddings = new Map<string, EmbeddingRecord>();

  private readonly documentExtractionsById = new Map<number, DocumentExtractionRecord>();
  private readonly transcriptsByAnswerId = new Map<number, TranscriptRecord>();
  private readonly followUpQuestionsByKey = new Map<string, FollowUpQuestionRecord>();

  async markDocumentExtractionStarted(record: DocumentExtractionStatusRecord): Promise<void> {
    this.documentParseStatuses.set(record.documentId, "EXTRACTING");
    this.documentParseStatusEvents.push({ documentId: record.documentId, status: "EXTRACTING" });
  }

  async saveDocumentExtraction(record: DocumentExtractionRecord): Promise<void> {
    if (this.documentExtractionsById.has(record.documentId)) {
      return;
    }

    this.documentExtractionsById.set(record.documentId, record);
    this.documentExtractions.push(record);
    this.documentParseStatuses.set(record.documentId, "EXTRACTED");
    this.documentParseStatusEvents.push({ documentId: record.documentId, status: "EXTRACTED" });
  }

  async markDocumentExtractionFailed(record: FailedDocumentExtractionRecord): Promise<void> {
    this.documentParseStatuses.set(record.documentId, "FAILED");
    this.documentParseStatusEvents.push({ documentId: record.documentId, status: "FAILED" });
  }

  async saveTranscript(record: TranscriptRecord): Promise<void> {
    if (this.transcriptsByAnswerId.has(record.answerId)) {
      return;
    }

    this.transcriptsByAnswerId.set(record.answerId, record);
    this.transcripts.push(record);
  }

  async saveFollowUpQuestion(record: FollowUpQuestionRecord): Promise<void> {
    const key = `${record.policy}:${record.sessionId}:${record.answerId}`;
    if (this.followUpQuestionsByKey.has(key)) {
      return;
    }

    this.followUpQuestionsByKey.set(key, record);
    this.followUpQuestions.push(record);
  }

  async saveGeneratedDraft(record: GeneratedDraftRecord): Promise<void> {
    this.generatedDrafts.push(record);
  }

  async saveGeneratedReport(record: GeneratedReportRecord): Promise<void> {
    this.generatedReports.set(record.reportId, record);
    this.failedReports.delete(record.reportId);
  }

  async markReportFailed(record: FailedReportRecord): Promise<void> {
    this.failedReports.set(record.reportId, record);
  }

  async upsertEmbedding(record: Omit<EmbeddingRecord, "sourceTextHash"> & { sourceText: string }): Promise<EmbeddingRecord> {
    const sourceTextHash = hashSourceText(record.sourceText);
    const key = `${record.sourceType}:${sourceTextHash}`;
    const existing = this.embeddings.get(key);
    if (existing) {
      return existing;
    }

    const created: EmbeddingRecord = {
      sourceType: record.sourceType,
      sourceTextHash,
      embeddingModel: record.embeddingModel,
      embeddingDimension: record.embeddingDimension,
      metadataJson: record.metadataJson
    };
    this.embeddings.set(key, created);
    return created;
  }
}

export function hashSourceText(sourceText: string): string {
  return createHash("sha256").update(sourceText).digest("hex");
}
