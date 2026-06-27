import test from "node:test";
import assert from "node:assert/strict";
import { PrismaAiResultRepository } from "./prisma-ai-result.repository";

test("PrismaAiResultRepository stores document extraction into application_documents", async () => {
  const calls: Array<{ model: string; method: string; args: any }> = [];
  const repository = new PrismaAiResultRepository(fakePrisma(calls));

  await repository.saveDocumentExtraction({
    documentId: 7,
    s3Key: "candidate/1/resume.pdf",
    extractedText: "parsed resume text"
  });

  assert.deepEqual(calls[0], {
    model: "applicationDocument",
    method: "update",
    args: {
      where: { documentId: BigInt(7) },
      data: {
        parseStatus: "EXTRACTED",
        extractedText: "parsed resume text"
      }
    }
  });
});

test("PrismaAiResultRepository stores STT transcript into interview_answers", async () => {
  const calls: Array<{ model: string; method: string; args: any }> = [];
  const repository = new PrismaAiResultRepository(fakePrisma(calls));

  await repository.saveTranscript({
    answerId: 42,
    transcript: "hello"
  });

  assert.deepEqual(calls[0], {
    model: "interviewAnswer",
    method: "update",
    args: {
      where: { answerId: BigInt(42) },
      data: {
        transcript: "hello"
      }
    }
  });
});

test("PrismaAiResultRepository upserts one follow-up per answer and policy", async () => {
  const calls: Array<{ model: string; method: string; args: any }> = [];
  const repository = new PrismaAiResultRepository(fakePrisma(calls));

  await repository.saveFollowUpQuestion({
    sessionId: 3,
    answerId: 4,
    content: "Practice follow-up",
    policy: "MOCK"
  });

  assert.equal(calls[0].model, "followUpQuestion");
  assert.equal(calls[0].method, "upsert");
  assert.deepEqual(calls[0].args.where, {
    answerIdPolicy: {
      answerId: BigInt(4),
      policy: "MOCK"
    }
  });
  assert.equal(calls[0].args.create.generationStatus, "GENERATED");
  assert.deepEqual(calls[0].args.update, {});
});

test("PrismaAiResultRepository upserts embeddings by source_type and source_text_hash", async () => {
  const calls: Array<{ model: string; method: string; args: any }> = [];
  const repository = new PrismaAiResultRepository(fakePrisma(calls));

  const embedding = await repository.upsertEmbedding({
    sourceType: "APPLICATION_DOCUMENT",
    sourceText: "same text",
    embeddingModel: "text-embedding-3-small",
    embeddingDimension: 1536
  });

  assert.equal(calls[0].model, "embedding");
  assert.equal(calls[0].method, "upsert");
  assert.equal(calls[0].args.where.sourceTypeSourceTextHash.sourceType, "APPLICATION_DOCUMENT");
  assert.equal(calls[0].args.create.embeddingVector, "[]");
  assert.equal(embedding.sourceTextHash, calls[0].args.where.sourceTypeSourceTextHash.sourceTextHash);
});

function fakePrisma(calls: Array<{ model: string; method: string; args: any }>) {
  return {
    applicationDocument: {
      async update(args: any) {
        calls.push({ model: "applicationDocument", method: "update", args });
      }
    },
    interviewAnswer: {
      async update(args: any) {
        calls.push({ model: "interviewAnswer", method: "update", args });
      }
    },
    followUpQuestion: {
      async upsert(args: any) {
        calls.push({ model: "followUpQuestion", method: "upsert", args });
      }
    },
    embedding: {
      async upsert(args: any) {
        calls.push({ model: "embedding", method: "upsert", args });
        return {
          sourceType: args.create.sourceType,
          sourceTextHash: args.create.sourceTextHash,
          embeddingModel: args.create.embeddingModel,
          embeddingDimension: args.create.embeddingDimension,
          metadataJson: args.create.metadataJson
        };
      }
    },
    aiProcessLog: {
      async create(args: any) {
        calls.push({ model: "aiProcessLog", method: "create", args });
      }
    }
  };
}
