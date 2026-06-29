import { Body, Controller, Get, Headers, HttpCode, HttpException, Param, Post, Query } from "@nestjs/common";
import { resolveCurrentCandidate, type CandidateAuthHeaders } from "./candidate.auth";
import { CandidateService, CandidateDomainError } from "./candidate.service";
import { CandidateJobListQueryDto } from "./dto/candidate-job-list-query.dto";
import { CreatePortfolioLinkDto } from "./dto/create-portfolio-link.dto";
import { SaveInterviewConsentDto } from "./dto/save-interview-consent.dto";
import { SubmitApplicationDto } from "./dto/submit-application.dto";
import { UploadResumeDto } from "./dto/upload-resume.dto";
import { candidateApiRoutePrefix, candidateApiRoutes } from "./candidate.routes";
import { createCandidateErrorResponse } from "./candidate.errors";

@Controller(candidateApiRoutePrefix)
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Get(candidateApiRoutes.jobs)
  listJobs(@Headers() headers: CandidateAuthHeaders, @Query() query: CandidateJobListQueryDto) {
    return this.handle(() => {
      resolveCurrentCandidate(headers);
      return this.candidateService.listJobs(query);
    });
  }

  @Get(candidateApiRoutes.jobDetail)
  getJobDetail(@Headers() headers: CandidateAuthHeaders, @Param("jobId") jobId: string) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return this.candidateService.getJobDetail(Number(jobId), currentUser);
    });
  }

  @Get(candidateApiRoutes.applyView)
  getApplyView(@Headers() headers: CandidateAuthHeaders, @Param("jobId") jobId: string) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return this.candidateService.getApplyView(Number(jobId), currentUser);
    });
  }

  @Post(candidateApiRoutes.submitApplication)
  @HttpCode(201)
  submitApplication(
    @Headers() headers: CandidateAuthHeaders,
    @Param("jobId") jobId: string,
    @Body() dto: SubmitApplicationDto,
  ) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return this.candidateService.submitApplication(Number(jobId), dto, currentUser);
    });
  }

  @Post(candidateApiRoutes.resume)
  @HttpCode(201)
  uploadResume(@Headers() headers: CandidateAuthHeaders, @Body() dto: UploadResumeDto) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return this.candidateService.uploadResume(dto, currentUser);
    });
  }

  @Post(candidateApiRoutes.portfolioLinks)
  @HttpCode(201)
  createPortfolioLink(@Headers() headers: CandidateAuthHeaders, @Body() dto: CreatePortfolioLinkDto) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return this.candidateService.createPortfolioLink(dto, currentUser);
    });
  }

  @Get(candidateApiRoutes.applications)
  listApplications(@Headers() headers: CandidateAuthHeaders) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return this.candidateService.listApplications(currentUser);
    });
  }

  @Get(candidateApiRoutes.interviewGuide)
  getInterviewGuide(@Headers() headers: CandidateAuthHeaders, @Param("applicationId") applicationId: string) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return this.candidateService.getInterviewGuide(Number(applicationId), currentUser);
    });
  }

  @Post(candidateApiRoutes.interviewConsent)
  saveInterviewConsent(
    @Headers() headers: CandidateAuthHeaders,
    @Param("applicationId") applicationId: string,
    @Body() dto: SaveInterviewConsentDto,
  ) {
    return this.handle(() => {
      const currentUser = resolveCurrentCandidate(headers);
      return this.candidateService.saveInterviewConsent(Number(applicationId), dto, currentUser);
    });
  }

  private async handle<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof CandidateDomainError) {
        throw new HttpException(createCandidateErrorResponse(error), error.statusCode);
      }
      throw error;
    }
  }
}
