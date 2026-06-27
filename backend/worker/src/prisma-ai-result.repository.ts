import {
  AiResultRepository,
  DocumentExtractionRecord,
  DocumentExtractionStatusRecord,
  EmbeddingRecord,
  FailedDocumentExtractionRecord,
  FailedReportRecord,
  FollowUpQuestionRecord,
  GeneratedDraftRecord,
  GeneratedReportRecord,
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
  evaluationReport: {
    upsert(args: unknown): Promise<unknown>;
  };
  reportScore: {
    deleteMany(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
  };
  embedding: {
    upsert(args: unknown): Promise<EmbeddingRecord & { embeddingId?: bigint }>;
  };
}

export class PrismaAiResultRepository implements AiResultRepository {
  constructor(private readonly prisma: PrismaAiResultClient) {}

  async markDocumentExtractionStarted(record: DocumentExtractionStatusRecord): Promise<void> {
    await this.prisma.applicationDocument.update({
      where: { documentId: BigInt(record.documentId) },
      data: {
        parseStatus: "EXTRACTING"
      }
    });
  }

  async saveDocumentExtraction(record: DocumentExtractionRecord): Promise<void> {
    await this.prisma.applicationDocument.update({
      where: { documentId: BigInt(record.documentId) },
      data: {
        parseStatus: "EXTRACTED",
        extractedText: record.extractedText
      }
    });
  }

  async markDocumentExtractionFailed(record: FailedDocumentExtractionRecord): Promise<void> {
    await this.prisma.applicationDocument.update({
      where: { documentId: BigInt(record.documentId) },
      data: {
        parseStatus: "FAILED"
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

  async saveGeneratedDraft(_record: GeneratedDraftRecord): Promise<void> {
    return;
  }

  async saveGeneratedReport(record: GeneratedReportRecord): Promise<void> {
    await this.prisma.evaluationReport.upsert({
      where: { reportId: BigInt(record.reportId) },
      create: {
        reportId: BigInt(record.reportId),
        reportType: record.reportType,
        status: "COMPLETED",
        summary: record.summary,
        totalScore: record.totalScore,
        generatedAt: new Date()
      },
      update: {
        reportType: record.reportType,
        status: "COMPLETED",
        summary: record.summary,
        totalScore: record.totalScore,
        generatedAt: new Date(),
        failureCategory: null,
        failureReason: null
      }
    });

    await this.prisma.reportScore.deleteMany({
      where: { reportId: BigInt(record.reportId) }
    });

    for (const score of record.scores) {
      await this.prisma.reportScore.create({
        data: {
          scoreId: this.nextId(),
          reportId: BigInt(record.reportId),
          criterionId: BigInt(score.criterionId),
          score: score.score,
          rationale: score.rationale,
          evidences: {
            create: score.evidences.map((evidence) => ({
              evidenceId: this.nextId(),
              sourceType: evidence.sourceType,
              answerId: evidence.answerId ? BigInt(evidence.answerId) : null,
              documentId: evidence.documentId ? BigInt(evidence.documentId) : null,
              documentRef: evidence.documentRef ?? null,
              evidenceText: evidence.text
            }))
          }
        }
      });
    }
  }

  async markReportFailed(record: FailedReportRecord): Promise<void> {
    await this.prisma.evaluationReport.upsert({
      where: { reportId: BigInt(record.reportId) },
      create: {
        reportId: BigInt(record.reportId),
        reportType: record.reportType,
        status: "FAILED",
        failureCategory: record.failureCategory,
        failureReason: record.failureReason
      },
      update: {
        reportType: record.reportType,
        status: "FAILED",
        failureCategory: record.failureCategory,
        failureReason: record.failureReason
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
