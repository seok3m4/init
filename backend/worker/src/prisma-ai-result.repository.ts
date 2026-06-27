import {
  AiResultRepository,
  DocumentExtractionRecord,
  EmbeddingRecord,
  FollowUpQuestionRecord,
  GeneratedDraftRecord,
  TranscriptRecord,
  hashSourceText
} from "./ai-result.repository";

interface PrismaAiResultClient {
  applicationDocument: {
    update(args: unknown): Promise<unknown>;
  };
  interviewAnswer: {
    update(args: unknown): Promise<unknown>;
  };
  followUpQuestion: {
    upsert(args: unknown): Promise<unknown>;
  };
  embedding: {
    upsert(args: unknown): Promise<EmbeddingRecord & { embeddingId?: bigint }>;
  };
  aiProcessLog?: {
    create(args: unknown): Promise<unknown>;
  };
}

export class PrismaAiResultRepository implements AiResultRepository {
  constructor(private readonly prisma: PrismaAiResultClient) {}

  async saveDocumentExtraction(record: DocumentExtractionRecord): Promise<void> {
    await this.prisma.applicationDocument.update({
      where: { documentId: BigInt(record.documentId) },
      data: {
        parseStatus: "EXTRACTED",
        extractedText: record.extractedText
      }
    });
  }

  async saveTranscript(record: TranscriptRecord): Promise<void> {
    await this.prisma.interviewAnswer.update({
      where: { answerId: BigInt(record.answerId) },
      data: {
        transcript: record.transcript
      }
    });
  }

  async saveFollowUpQuestion(record: FollowUpQuestionRecord): Promise<void> {
    await this.prisma.followUpQuestion.upsert({
      where: {
        answerIdPolicy: {
          answerId: BigInt(record.answerId),
          policy: record.policy
        }
      },
      create: {
        followUpId: this.nextId(),
        answerId: BigInt(record.answerId),
        content: record.content,
        generationStatus: "GENERATED",
        policy: record.policy,
        createdAt: new Date()
      },
      update: {}
    });
  }

  async saveGeneratedDraft(record: GeneratedDraftRecord): Promise<void> {
    await this.prisma.aiProcessLog?.create({
      data: {
        processLogId: this.nextId(),
        processType: record.kind,
        status: "COMPLETED",
        inputRef: JSON.stringify({ reviewRequired: record.reviewRequired }),
        outputRef: JSON.stringify({ items: record.items }),
        createdAt: new Date()
      }
    });
  }

  async upsertEmbedding(record: Omit<EmbeddingRecord, "sourceTextHash"> & { sourceText: string }): Promise<EmbeddingRecord> {
    const sourceTextHash = hashSourceText(record.sourceText);
    const now = new Date();
    const embedding = await this.prisma.embedding.upsert({
      where: {
        sourceTypeSourceTextHash: {
          sourceType: record.sourceType,
          sourceTextHash
        }
      },
      create: {
        embeddingId: this.nextId(),
        sourceType: record.sourceType,
        sourceTextHash,
        embeddingModel: record.embeddingModel,
        embeddingDimension: record.embeddingDimension,
        embeddingVector: "[]",
        metadataJson: record.metadataJson,
        createdAt: now,
        updatedAt: now
      },
      update: {
        updatedAt: now
      }
    });

    return {
      sourceType: embedding.sourceType,
      sourceTextHash: embedding.sourceTextHash,
      embeddingModel: embedding.embeddingModel,
      embeddingDimension: embedding.embeddingDimension,
      metadataJson: embedding.metadataJson
    };
  }

  private nextId(): bigint {
    return BigInt(Date.now()) * BigInt(1000) + BigInt(Math.floor(Math.random() * 1000));
  }
}
