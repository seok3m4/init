import { Controller, Get, Headers, HttpException, Inject, Param } from "@nestjs/common";
import {
  CandidateDomainError,
  resolveCurrentCandidate,
  type CandidateAuthHeaders,
} from "../candidate";
import { reportApiRoutePrefix, reportApiRoutes } from "./report.routes";
import { ReportService } from "./report.service";

@Controller(reportApiRoutePrefix)
export class ReportController {
  constructor(@Inject(ReportService) private readonly reportService: ReportService) {}

  @Get(reportApiRoutes.mockReports)
  listMockReports(@Headers() headers: CandidateAuthHeaders) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return Promise.resolve(this.reportService.listMockReports(currentUser));
    });
  }

  @Get(reportApiRoutes.mockHistory)
  listMockInterviewHistory(@Headers() headers: CandidateAuthHeaders) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return Promise.resolve(this.reportService.listMockInterviewHistory(currentUser));
    });
  }

  @Get(reportApiRoutes.mockFeedback)
  getMockReportFeedback(@Headers() headers: CandidateAuthHeaders, @Param("reportId") reportId: string) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return Promise.resolve(this.reportService.getMockReportFeedback(Number(reportId), currentUser));
    });
  }

  @Get(reportApiRoutes.mockMedia)
  getMockReportMedia(@Headers() headers: CandidateAuthHeaders, @Param("reportId") reportId: string) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return this.reportService.getMockReportMedia(Number(reportId), currentUser);
    });
  }

  @Get(reportApiRoutes.applicationReport)
  getApplicationReport(@Headers() headers: CandidateAuthHeaders, @Param("applicationId") applicationId: string) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return this.reportService.getApplicationReport(Number(applicationId), currentUser);
    });
  }

  @Get(reportApiRoutes.applicationStatus)
  getApplicationStatus(@Headers() headers: CandidateAuthHeaders, @Param("applicationId") applicationId: string) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return this.reportService.getApplicationStatus(Number(applicationId), currentUser);
    });
  }

  private async handle<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof CandidateDomainError) {
        throw new HttpException(
          { code: error.code, message: error.message, details: error.details },
          error.statusCode,
        );
      }
      throw error;
    }
  }
}
