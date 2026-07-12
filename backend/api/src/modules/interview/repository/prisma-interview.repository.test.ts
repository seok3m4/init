import { strict as assert } from "node:assert";
import {
  InterviewStatus as PrismaInterviewStatus,
  InterviewType as PrismaInterviewType,
  QuestionType as PrismaQuestionType,
} from "@prisma/client";
import { PrismaInterviewRepository } from "./prisma-interview.repository";

describe("PrismaInterviewRepository", () => {
  it("uses the active company question set before the posting question bank for recruiting runtime", async () => {
    let postingQuestionBankQueried = false;
    const prisma = {
      interviewQuestionSet: {
        async findFirst(args: { where: { postingId: bigint; status: string } }) {
          assert.deepEqual(args.where, { postingId: 1n, status: "ACTIVE" });

          return {
            items: [
              {
                sortOrder: 2,
                question: recruitingQuestion(1001n, PrismaQuestionType.TECHNICAL, "NestJS 장애 대응 경험을 설명해주세요."),
              },
              {
                sortOrder: 1,
                question: recruitingQuestion(1002n, PrismaQuestionType.CLOSING, "이 JD에서 가장 자신 있는 업무를 설명해주세요."),
              },
              {
                sortOrder: 3,
                question: recruitingQuestion(1003n, PrismaQuestionType.FOLLOW_UP, "런타임 기본 질문에 섞이면 안 되는 꼬리질문입니다."),
              },
              {
                sortOrder: 4,
                question: { ...recruitingQuestion(1004n, PrismaQuestionType.EXPERIENCE, "비활성 질문입니다."), isActive: false },
              },
              {
                sortOrder: 5,
                question: { ...recruitingQuestion(1005n, PrismaQuestionType.SITUATION, "다른 공고 질문입니다."), postingId: 2n },
              },
            ],
          };
        },
      },
      question: {
        async findMany() {
          postingQuestionBankQueried = true;
          throw new Error("posting question bank should not be queried when an active question set exists");
        },
      },
    };
    const repository = new PrismaInterviewRepository(prisma as never);

    const questions = await repository.listQuestions({
      interviewType: "RECRUITING",
      postingId: 1,
    });

    assert.equal(postingQuestionBankQueried, false);
    assert.deepEqual(
      questions.map((question) => question.questionId),
      [1002, 1001],
    );
    assert.deepEqual(
      questions.map((question) => question.sortOrder),
      [1, 2],
    );
    assert.deepEqual(
      questions.map((question) => question.content),
      ["이 JD에서 가장 자신 있는 업무를 설명해주세요.", "NestJS 장애 대응 경험을 설명해주세요."],
    );
  });

  it("restores the persisted session question order without an in-memory cache", async () => {
    const prisma = {
      interviewSession: {
        async findFirst() {
          return {
            sessionId: 9001n,
            applicationId: null,
            candidateId: 1n,
            interviewType: PrismaInterviewType.MOCK,
            status: PrismaInterviewStatus.IN_PROGRESS,
            showQuestionText: true,
            startedAt: new Date("2026-07-13T00:00:00.000Z"),
            completedAt: null,
          };
        },
      },
      interviewSessionQuestion: {
        async findMany(args: {
          where: { sessionId: bigint };
          orderBy: { sortOrder: string };
          select: { questionId: boolean; runtimeQuestionId: boolean };
        }) {
          assert.deepEqual(args, {
            where: { sessionId: 9001n },
            orderBy: { sortOrder: "asc" },
            select: { questionId: true, runtimeQuestionId: true },
          });
          return [
            { questionId: 1202n, runtimeQuestionId: null },
            { questionId: 1201n, runtimeQuestionId: null },
          ];
        },
      },
      interviewAnswer: {
        async findMany() {
          return [];
        },
      },
    };
    const repository = new PrismaInterviewRepository(prisma as never);

    const session = await repository.findMockSession(9001);

    assert.deepEqual(session?.questionIds, [1202, 1201]);
    assert.equal(session?.currentQuestionIndex, 0);
  });
});

function recruitingQuestion(questionId: bigint, questionType: PrismaQuestionType, content: string) {
  return {
    questionId,
    companyId: 1n,
    postingId: 1n,
    criterionId: 1n,
    questionType,
    content,
    isActive: true,
  };
}
