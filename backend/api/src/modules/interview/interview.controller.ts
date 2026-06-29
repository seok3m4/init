import { Body, Controller, Get, Headers, HttpCode, HttpException, Inject, Param, Patch, Post } from "@nestjs/common";
import { CandidateDomainError, createCandidateErrorResponse, type CandidateAuthHeaders } from "../candidate";
import { DeviceCheckDto } from "./interview.device-check.dto";
import { AiInterviewRequestDto, SaveInterviewAnswerDto, StartMockInterviewDto } from "./interview.runtime.dto";
import { interviewApiRoutePrefix, interviewApiRoutes } from "./interview.routes";
import { InterviewService } from "./interview.service";

@Controller(interviewApiRoutePrefix)
export class InterviewController {
  constructor(@Inject(InterviewService) private readonly interviewService: InterviewService) {}

  @Post(interviewApiRoutes.mockInterviews)
  startMockInterview(@Headers() headers: CandidateAuthHeaders, @Body() dto: StartMockInterviewDto) {
    return this.handle(() => this.interviewService.startMockInterview(dto, headers));
  }

  @Get(interviewApiRoutes.mockHistory)
  listMockInterviewHistory(@Headers() headers: CandidateAuthHeaders) {
    return this.handle(() => this.interviewService.listMockInterviewHistory(headers));
  }

  @Get(interviewApiRoutes.mockRuntime)
  getMockRuntime(@Headers() headers: CandidateAuthHeaders, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.getMockRuntime(Number(sessionId), headers));
  }

  @Get(interviewApiRoutes.mockQuestions)
  listMockQuestions(@Headers() headers: CandidateAuthHeaders, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.listMockQuestions(Number(sessionId), headers));
  }

  @Post(interviewApiRoutes.mockAnswers)
  @HttpCode(201)
  saveMockAnswer(
    @Headers() headers: CandidateAuthHeaders,
    @Param("sessionId") sessionId: string,
    @Body() dto: SaveInterviewAnswerDto,
  ) {
    return this.handle(() => this.interviewService.saveMockAnswer(Number(sessionId), dto, headers));
  }

  @Post(interviewApiRoutes.mockNextQuestion)
  moveMockNextQuestion(@Headers() headers: CandidateAuthHeaders, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.moveMockNextQuestion(Number(sessionId), headers));
  }

  @Patch(interviewApiRoutes.mockComplete)
  completeMockInterview(@Headers() headers: CandidateAuthHeaders, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.completeMockInterview(Number(sessionId), headers));
  }

  @Post(interviewApiRoutes.mockStt)
  @HttpCode(202)
  requestMockStt(
    @Headers() headers: CandidateAuthHeaders,
    @Param("sessionId") sessionId: string,
    @Body() dto: AiInterviewRequestDto,
  ) {
    return this.handle(() => this.interviewService.requestMockStt(Number(sessionId), dto, headers));
  }

  @Post(interviewApiRoutes.mockFollowUpQuestion)
  @HttpCode(202)
  requestMockFollowUpQuestion(
    @Headers() headers: CandidateAuthHeaders,
    @Param("sessionId") sessionId: string,
    @Body() dto: AiInterviewRequestDto,
  ) {
    return this.handle(() => this.interviewService.requestMockFollowUpQuestion(Number(sessionId), dto, headers));
  }

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

  @Get(interviewApiRoutes.recruitingQuestions)
  listRecruitingQuestions(@Headers() headers: CandidateAuthHeaders, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.listRecruitingQuestions(Number(sessionId), headers));
  }

  @Post(interviewApiRoutes.recruitingAnswers)
  @HttpCode(201)
  saveRecruitingAnswer(
    @Headers() headers: CandidateAuthHeaders,
    @Param("sessionId") sessionId: string,
    @Body() dto: SaveInterviewAnswerDto,
  ) {
    return this.handle(() => this.interviewService.saveRecruitingAnswer(Number(sessionId), dto, headers));
  }

  @Post(interviewApiRoutes.recruitingNextQuestion)
  moveRecruitingNextQuestion(@Headers() headers: CandidateAuthHeaders, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.moveRecruitingNextQuestion(Number(sessionId), headers));
  }

  @Patch(interviewApiRoutes.recruitingComplete)
  completeRecruitingInterview(@Headers() headers: CandidateAuthHeaders, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.completeRecruitingInterview(Number(sessionId), headers));
  }

  @Post(interviewApiRoutes.recruitingStt)
  @HttpCode(202)
  requestRecruitingStt(
    @Headers() headers: CandidateAuthHeaders,
    @Param("sessionId") sessionId: string,
    @Body() dto: AiInterviewRequestDto,
  ) {
    return this.handle(() => this.interviewService.requestRecruitingStt(Number(sessionId), dto, headers));
  }

  @Post(interviewApiRoutes.recruitingFollowUpQuestion)
  @HttpCode(202)
  requestRecruitingFollowUpQuestion(
    @Headers() headers: CandidateAuthHeaders,
    @Param("sessionId") sessionId: string,
    @Body() dto: AiInterviewRequestDto,
  ) {
    return this.handle(() => this.interviewService.requestRecruitingFollowUpQuestion(Number(sessionId), dto, headers));
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
