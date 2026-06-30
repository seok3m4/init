import type { ReportStatus } from "../../candidate";
import type { CandidateReportRepository } from "./candidate-report.repository";

export class InMemoryCandidateReportRepository implements CandidateReportRepository {
  private readonly mockReportStatuses = new Map<number, ReportStatus>();

  findMockReportStatus(reportId: number): ReportStatus | undefined {
    return this.mockReportStatuses.get(reportId);
  }

  saveMockReportStatus(reportId: number, status: ReportStatus): void {
    this.mockReportStatuses.set(reportId, status);
  }
}
