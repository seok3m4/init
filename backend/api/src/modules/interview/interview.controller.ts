import { Body, Controller, Get, Headers, HttpException, Param, Post } from "@nestjs/common";
import { CandidateDomainError, createCandidateErrorResponse, type CandidateAuthHeaders } from "../candidate";
import { DeviceCheckDto } from "./interview.device-check.dto";
import { interviewApiRoutePrefix, interviewApiRoutes } from "./interview.routes";
import { InterviewService } from "./interview.service";

@Controller(interviewApiRoutePrefix)
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post(interviewApiRoutes.deviceCheck)
  saveDeviceCheck(
    @Headers() headers: CandidateAuthHeaders,
    @Param("sessionId") sessionId: string,
    @Body() dto: DeviceCheckDto,
  ) {
    return this.handle(() => this.interviewService.saveDeviceCheck(Number(sessionId), dto, headers));
  }

  @Post(interviewApiRoutes.startInterview)
  startInterview(@Headers() headers: CandidateAuthHeaders, @Param("applicationId") applicationId: string) {
    return this.handle(() => this.interviewService.startInterview(Number(applicationId), headers));
  }

  @Get(interviewApiRoutes.interviewRuntime)
  getInterviewRuntime(@Headers() headers: CandidateAuthHeaders, @Param("applicationId") applicationId: string) {
    return this.handle(() => this.interviewService.getInterviewRuntime(Number(applicationId), headers));
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
