import { AiJobDispatcherService } from "./ai-job-dispatcher.service";
import { AiJobQueuePublisher } from "./ai-job-queue.publisher";
import { InMemoryReportRepository } from "../repository/in-memory-report.repository";

describe("AiJobDispatcherService", () => {
  it("reuses an existing process for an idempotent request", async () => {
    const repository = new InMemoryReportRepository();
    const messages: number[] = [];
    const publisher: AiJobQueuePublisher = {
      async publish(message) {
        messages.push(message.processLogId);
      }
    };
    const service = new AiJobDispatcherService(repository, publisher);
    const command = {
      processType: "REPORT_GENERATE" as const,
      input: { kind: "MOCK_NCS_ANSWER_EVALUATION", payload: { sessionId: 1 } },
      idempotencyKey: "ncs-evaluation:test-key"
    };

    const first = await service.dispatch(command);
    const second = await service.dispatch(command);

    expect(second.processLogId).toBe(first.processLogId);
    expect(second.deduplicated).toBe(true);
    expect(second.queued).toBe(true);
    expect(messages).toEqual([first.processLogId]);
  });

  it("requeues a failed idempotent request with the same process id", async () => {
    const repository = new InMemoryReportRepository();
    let attempt = 0;
    const publisher: AiJobQueuePublisher = {
      async publish() {
        attempt += 1;
        if (attempt === 1) throw new Error("temporary outage");
      }
    };
    const service = new AiJobDispatcherService(repository, publisher);
    const command = {
      processType: "REPORT_GENERATE" as const,
      input: { kind: "MOCK_NCS_ANSWER_EVALUATION", payload: { sessionId: 1 } },
      idempotencyKey: "ncs-evaluation:retry-key"
    };

    const failed = await service.dispatch(command);
    const retried = await service.dispatch(command);

    expect(failed.status).toBe("FAILED");
    expect(retried.processLogId).toBe(failed.processLogId);
    expect(retried.status).toBe("PENDING");
    expect(retried.queued).toBe(true);
    expect(retried.deduplicated).toBe(true);
    expect(attempt).toBe(2);
  });

  it("marks queued process failed when SQS publish fails", async () => {
    const repository = new InMemoryReportRepository();
    const publisher: AiJobQueuePublisher = {
      async publish() {
        throw new Error("SQS unavailable");
      }
    };
    const service = new AiJobDispatcherService(repository, publisher);

    const result = await service.dispatch({
      processType: "QUESTION_GENERATE",
      input: {
        kind: "RECRUITING_QUESTION_GENERATE",
        payload: {
          postingId: 2,
          jobDescription: "Backend engineer",
          questionCount: 2
        }
      }
    });

    expect(result.queued).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(result.failure).toEqual({
      category: "RETRYABLE",
      reason: "AI queue publish failed: SQS unavailable",
      retryable: true
    });
    await expect(repository.getProcess(result.processLogId)).resolves.toMatchObject({
      status: "FAILED",
      failure: result.failure
    });
  });

  it("marks report failed when report generation cannot be published", async () => {
    const repository = new InMemoryReportRepository();
    const publisher: AiJobQueuePublisher = {
      async publish() {
        throw new Error("SQS unavailable");
      }
    };
    const service = new AiJobDispatcherService(repository, publisher);

    const result = await service.dispatchReportGeneration({
      reportId: 3,
      reportType: "RECRUITING_REPORT",
      input: {
        kind: "RECRUITING_REPORT_GENERATE",
        payload: {
          reportId: 3,
          reportType: "RECRUITING_REPORT"
        }
      }
    });

    expect(result.queued).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(result.report.status).toBe("FAILED");
    expect(result.report.failure).toEqual(result.failure);
  });
});
