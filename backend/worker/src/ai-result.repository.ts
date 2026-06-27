import { createHash } from "node:crypto";

export interface DocumentExtractionRecord {
  documentId: number;
  s3Key: string;
  extractedText: string;
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

export interface EmbeddingRecord {
  sourceType: string;
  sourceTextHash: string;
  embeddingModel: string;
  embeddingDimension: number;
  metadataJson?: string;
}

export interface AiResultRepository {
  saveDocumentExtraction(record: DocumentExtractionRecord): Promise<void>;
  saveTranscript(record: TranscriptRecord): Promise<void>;
  saveFollowUpQuestion(record: FollowUpQuestionRecord): Promise<void>;
  saveGeneratedDraft(record: GeneratedDraftRecord): Promise<void>;
  upsertEmbedding(record: Omit<EmbeddingRecord, "sourceTextHash"> & { sourceText: string }): Promise<EmbeddingRecord>;
}

export class InMemoryAiResultRepository implements AiResultRepository {
  readonly documentExtractions: DocumentExtractionRecord[] = [];
  readonly transcripts: TranscriptRecord[] = [];
  readonly followUpQuestions: FollowUpQuestionRecord[] = [];
  readonly generatedDrafts: GeneratedDraftRecord[] = [];
  readonly embeddings = new Map<string, EmbeddingRecord>();

  private readonly documentExtractionsById = new Map<number, DocumentExtractionRecord>();
  private readonly transcriptsByAnswerId = new Map<number, TranscriptRecord>();
  private readonly followUpQuestionsByKey = new Map<string, FollowUpQuestionRecord>();

  async saveDocumentExtraction(record: DocumentExtractionRecord): Promise<void> {
    if (this.documentExtractionsById.has(record.documentId)) {
      return;
    }

    this.documentExtractionsById.set(record.documentId, record);
    this.documentExtractions.push(record);
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
