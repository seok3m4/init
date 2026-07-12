import "reflect-metadata";
import { strict as assert } from "node:assert";
import { HttpException } from "@nestjs/common";
import {
  CandidateService,
  DEV_CANDIDATE_USER,
  InMemoryCandidateRepository,
} from "../../candidate";
import { InterviewController } from "../controller/interview.controller";
import type { NcsEvaluationRequestDto } from "../dto/interview.runtime.dto";
import { InMemoryInterviewRepository } from "../repository/in-memory-interview.repository";
import { InterviewService } from "../service/interview.service";
import { InMemoryReportRepository } from "../../report/repository/in-memory-report.repository";
import { AiJobDispatcherService } from "../../report/service/ai-job-dispatcher.service";
import { InMemoryAiJobQueuePublisher } from "../../report/service/ai-job-queue.publisher";

const validCandidateRequest = {
  headers: {},
  currentUser: { ...DEV_CANDIDATE_USER, companyId: null },
};

interface CanonicalNcsEvaluationInput {
  kind: string;
  deduplicationKey: string;
  payload: {
    step: string;
    sessionId: number;
    questionId: number;
    answerId?: number;
    transcript: string;
    evaluationSnapshot: {
      contractVersion: string;
      snapshotVersion: string;
      ncsContext: {
        sourceKind: string;
      };
      evaluationPolicy: {
        allowNonverbalScore: boolean;
      };
    };
  };
}

function createController() {
  const candidateService = new CandidateService(new InMemoryCandidateRepository());
  const interviewRepository = new InMemoryInterviewRepository();
  const queuePublisher = new InMemoryAiJobQueuePublisher();
  const dispatcher = new AiJobDispatcherService(new InMemoryReportRepository(), queuePublisher);
  const service = new InterviewService(candidateService, interviewRepository, dispatcher);
  return {
    controller: new InterviewController(service),
    queuePublisher,
  };
}

async function startMockInterview(controller: InterviewController, questionTypes: Array<"INTRO" | "TECHNICAL" | "EXPERIENCE">) {
  const started = await controller.startMockInterview(validCandidateRequest, {
    questionTypes,
    showQuestionText: true,
  });
  const questions = await controller.listMockQuestions(validCandidateRequest, String(started.data.sessionId));
  return {
    sessionId: started.data.sessionId,
    questionIds: questions.data.questions.map((question) => question.questionId),
  };
}

function parseCanonicalInput(inputRef: string): CanonicalNcsEvaluationInput {
  return JSON.parse(inputRef) as CanonicalNcsEvaluationInput;
}

async function expectHttpError(
  action: () => Promise<unknown>,
  expectedStatus: number,
  expectedCode: string,
): Promise<void> {
  try {
    await action();
    assert.fail("Expected HttpException");
  } catch (error) {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), expectedStatus);
    const response = error.getResponse() as { code?: string };
    assert.equal(response.code, expectedCode);
  }
}

describe("mock NCS evaluation API", () => {
  test("직접 입력을 trim한 canonical 평가 작업으로 전송한다", async () => {
    const { controller, queuePublisher } = createController();
    const { sessionId, questionIds } = await startMockInterview(controller, ["TECHNICAL"]);
    const questionId = questionIds[0] ?? 0;

    const response = await controller.requestMockNcsEvaluation(validCandidateRequest, String(sessionId), {
      questionId,
      answerSource: "TEXT_INPUT",
      transcript: "  복합 인덱스를 적용하고 동일 부하에서 p95를 다시 측정했습니다.  ",
    });

    assert.equal(response.data.accepted, true);
    assert.equal(response.data.processType, "REPORT_GENERATE");
    assert.equal(response.data.step, "NCS_ANSWER_EVALUATION");
    assert.equal(response.data.queued, true);
    assert.equal(response.data.answerId, undefined);
    assert.equal(queuePublisher.messages.length, 1);

    const input = parseCanonicalInput(response.data.inputRef);
    assert.equal(input.kind, "MOCK_NCS_ANSWER_EVALUATION");
    assert.match(input.deduplicationKey, /^ncs-evaluation:[a-f0-9]{64}$/);
    assert.equal(input.payload.step, "NCS_ANSWER_EVALUATION");
    assert.equal(input.payload.transcript, "복합 인덱스를 적용하고 동일 부하에서 p95를 다시 측정했습니다.");
    assert.equal(Object.hasOwn(input.payload, "answerId"), false);
    assert.equal(input.payload.evaluationSnapshot.contractVersion, "ncs-evaluation-product.v1");
    assert.equal(input.payload.evaluationSnapshot.ncsContext.sourceKind, "SYNTHETIC_NCS_LIKE");
    assert.equal(input.payload.evaluationSnapshot.evaluationPolicy.allowNonverbalScore, false);
  });

  test("저장 답변은 요청이 아닌 repository transcript를 사용한다", async () => {
    const { controller } = createController();
    const { sessionId, questionIds } = await startMockInterview(controller, ["EXPERIENCE"]);
    const questionId = questionIds[0] ?? 0;
    const saved = await controller.saveMockAnswer(validCandidateRequest, String(sessionId), {
      questionId,
      audioFile: {
        storageKey: "candidate/1/ncs-stored-answer.webm",
        originalName: "ncs-stored-answer.webm",
        mimeType: "audio/webm",
        sizeBytes: 1024,
      },
      transcript: "  새 도구를 학습한 뒤 배포 검증에 적용했고 오류율을 비교했습니다.  ",
      durationSeconds: 30,
    });

    const response = await controller.requestMockNcsEvaluation(validCandidateRequest, String(sessionId), {
      questionId,
      answerSource: "STORED_ANSWER",
      answerId: saved.data.answer.answerId,
    });
    const input = parseCanonicalInput(response.data.inputRef);

    assert.equal(response.data.answerId, saved.data.answer.answerId);
    assert.equal(input.payload.answerId, saved.data.answer.answerId);
    assert.equal(input.payload.transcript, "새 도구를 학습한 뒤 배포 검증에 적용했고 오류율을 비교했습니다.");
  });

  test("source 조합 위반과 client 평가 설정을 거부한다", async () => {
    const { controller } = createController();
    const { sessionId, questionIds } = await startMockInterview(controller, ["TECHNICAL"]);
    const questionId = questionIds[0] ?? 0;

    await expectHttpError(
      () =>
        controller.requestMockNcsEvaluation(validCandidateRequest, String(sessionId), {
          questionId,
          answerSource: "STORED_ANSWER",
          answerId: 1,
          transcript: "override",
        } as NcsEvaluationRequestDto),
      400,
      "COMMON_VALIDATION_FAILED",
    );
    await expectHttpError(
      () =>
        controller.requestMockNcsEvaluation(validCandidateRequest, String(sessionId), {
          questionId,
          answerSource: "TEXT_INPUT",
          answerId: 1,
          transcript: "직접 입력",
        } as NcsEvaluationRequestDto),
      400,
      "COMMON_VALIDATION_FAILED",
    );
    await expectHttpError(
      () =>
        controller.requestMockNcsEvaluation(validCandidateRequest, String(sessionId), {
          questionId,
          answerSource: "TEXT_INPUT",
          transcript: "직접 입력",
          evaluationSnapshot: { behaviorPoints: [] },
        } as unknown as NcsEvaluationRequestDto),
      400,
      "COMMON_VALIDATION_FAILED",
    );
  });

  test("세션에 없는 질문과 질문이 다른 저장 답변을 거부한다", async () => {
    const { controller } = createController();
    const { sessionId, questionIds } = await startMockInterview(controller, ["TECHNICAL", "EXPERIENCE"]);
    const firstQuestionId = questionIds[0] ?? 0;
    const secondQuestionId = questionIds[1] ?? 0;
    const saved = await controller.saveMockAnswer(validCandidateRequest, String(sessionId), {
      questionId: firstQuestionId,
      audioFile: {
        storageKey: "candidate/1/ncs-mismatch-answer.webm",
        originalName: "ncs-mismatch-answer.webm",
        mimeType: "audio/webm",
        sizeBytes: 1024,
      },
      transcript: "첫 번째 질문의 답변입니다.",
      durationSeconds: 20,
    });

    await expectHttpError(
      () =>
        controller.requestMockNcsEvaluation(validCandidateRequest, String(sessionId), {
          questionId: 999_999,
          answerSource: "TEXT_INPUT",
          transcript: "세션에 없는 질문입니다.",
        }),
      404,
      "COMMON_NOT_FOUND",
    );
    await expectHttpError(
      () =>
        controller.requestMockNcsEvaluation(validCandidateRequest, String(sessionId), {
          questionId: secondQuestionId,
          answerSource: "STORED_ANSWER",
          answerId: saved.data.answer.answerId,
        }),
      404,
      "COMMON_NOT_FOUND",
    );
  });

  test("평가 불가 질문과 STT 미완료 답변을 conflict로 반환한다", async () => {
    const introSetup = createController();
    const intro = await startMockInterview(introSetup.controller, ["INTRO"]);
    await expectHttpError(
      () =>
        introSetup.controller.requestMockNcsEvaluation(validCandidateRequest, String(intro.sessionId), {
          questionId: intro.questionIds[0] ?? 0,
          answerSource: "TEXT_INPUT",
          transcript: "자기소개 답변입니다.",
        }),
      409,
      "COMMON_CONFLICT",
    );

    const storedSetup = createController();
    const stored = await startMockInterview(storedSetup.controller, ["TECHNICAL"]);
    const questionId = stored.questionIds[0] ?? 0;
    const saved = await storedSetup.controller.saveMockAnswer(validCandidateRequest, String(stored.sessionId), {
      questionId,
      audioFile: {
        storageKey: "candidate/1/ncs-stt-pending.webm",
        originalName: "ncs-stt-pending.webm",
        mimeType: "audio/webm",
        sizeBytes: 1024,
      },
      durationSeconds: 20,
    });
    await expectHttpError(
      () =>
        storedSetup.controller.requestMockNcsEvaluation(validCandidateRequest, String(stored.sessionId), {
          questionId,
          answerSource: "STORED_ANSWER",
          answerId: saved.data.answer.answerId,
        }),
      409,
      "COMMON_CONFLICT",
    );
  });
});
