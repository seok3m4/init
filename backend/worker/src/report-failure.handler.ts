import { AiResultRepository, FailedReportRecord } from "./ai-result.repository";
import { AiWorkerJob, FailureReason } from "./worker.types";

interface ReportJobInput {
  payload?: {
    reportId?: unknown;
    reportType?: unknown;
  };
}

export function createReportFailureHandler(results: AiResultRepository) {
  return async (job: AiWorkerJob, failure: FailureReason): Promise<void> => {
    if (job.processType !== "REPORT_GENERATE") {
      return;
    }

    const failedReport = failedReportFromJob(job, failure);
    if (!failedReport) {
      return;
    }

    await results.markReportFailed(failedReport);
  };
}

function failedReportFromJob(job: AiWorkerJob, failure: FailureReason): FailedReportRecord | undefined {
  try {
    const input = JSON.parse(job.inputRef) as ReportJobInput;
    const reportId = Number(input.payload?.reportId);
    const reportType = input.payload?.reportType;
    if (!Number.isInteger(reportId) || reportId <= 0 || !isReportType(reportType)) {
      return undefined;
    }

    return {
      reportId,
      reportType,
      failureCategory: failure.category,
      failureReason: failure.reason
    };
  } catch {
    return undefined;
  }
}

function isReportType(value: unknown): value is FailedReportRecord["reportType"] {
  return value === "RECRUITING_REPORT" || value === "MOCK_INTERVIEW_REPORT";
}
