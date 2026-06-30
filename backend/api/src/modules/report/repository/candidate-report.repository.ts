import type { ReportStatus } from "../../candidate";

export const CANDIDATE_REPORT_REPOSITORY = Symbol("CANDIDATE_REPORT_REPOSITORY");

export interface CandidateReportRepository {
  findMockReportStatus(reportId: number): ReportStatus | undefined;
  saveMockReportStatus(reportId: number, status: ReportStatus): void;
}
