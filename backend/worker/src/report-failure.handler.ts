import { AiResultRepository, FailedReportRecord } from "./ai-result.repository";
import { AiWorkerJob, FailureReason } from "./worker.types";

interface ReportJobInput {
  payload?: {
    reportId?: unknown;
    reportType?: unknown;
    documentId?: unknown;
  };
}

export function createDocumentExtractionStartHandler(results: AiResultRepository) {
  return async (job: AiWorkerJob): Promise<void> => {
    if (job.processType !== "DOCUMENT_EXTRACT") {
      return;
    }

    const documentId = documentIdFromJob(job);
    if (!documentId) {
      return;
    }

    await results.markDocumentExtractionStarted({ documentId });
  };
}

export function createReportFailureHandler(results: AiResultRepository) {
  return async (job: AiWorkerJob, failure: FailureReason): Promise<void> => {
    if (job.processType === "DOCUMENT_EXTRACT") {
      const documentId = documentIdFromJob(job);
      if (documentId) {
        await results.markDocumentExtractionFailed({ documentId });
      }
      return;
    }

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

function documentIdFromJob(job: AiWorkerJob): number | undefined {
  try {
    const input = JSON.parse(job.inputRef) as ReportJobInput;
    const documentId = Number(input.payload?.documentId);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return undefined;
    }
    return documentId;
  } catch {
    return undefined;
  }
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
