import { Body, Controller, Get, HttpCode, HttpException, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { CurrentUser } from "@init/common";
import { type RequestLike } from "../../../shared/response-envelope";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { resolveCurrentCandidate, CandidateDomainError } from "../../candidate";
import { DeviceCheckDto } from "../dto/interview.device-check.dto";
import {
  AiInterviewRequestDto,
  InsertFollowUpQuestionDto,
  SaveInterviewAnswerDto,
  StartMockInterviewDto,
} from "../dto/interview.runtime.dto";
import { interviewApiRoutePrefix, interviewApiRoutes } from "../interview.routes";
import { InterviewService } from "../service/interview.service";

type CandidateRequest = RequestLike & { currentUser: CurrentUser };

@UseGuards(JwtAuthGuard)
@Controller(interviewApiRoutePrefix)
export class InterviewController {
  constructor(@Inject(InterviewService) private readonly interviewService: InterviewService) {}

  @Post(interviewApiRoutes.mockInterviews)
  startMockInterview(@Req() request: CandidateRequest, @Body() dto: StartMockInterviewDto) {
    return this.handle(() => this.interviewService.startMockInterview(dto, resolveCurrentCandidate(request.currentUser)));
  }

  @Get(interviewApiRoutes.mockHistory)
  listMockInterviewHistory(@Req() request: CandidateRequest) {
    return this.handle(() => this.interviewService.listMockInterviewHistory(resolveCurrentCandidate(request.currentUser)));
  }

  @Get(interviewApiRoutes.mockRuntime)
  getMockRuntime(@Req() request: CandidateRequest, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.getMockRuntime(Number(sessionId), resolveCurrentCandidate(request.currentUser)));
  }

  @Get(interviewApiRoutes.mockQuestions)
  listMockQuestions(@Req() request: CandidateRequest, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.listMockQuestions(Number(sessionId), resolveCurrentCandidate(request.currentUser)));
  }

  @Post(interviewApiRoutes.mockAnswers)
  @HttpCode(201)
  saveMockAnswer(
    @Req() request: CandidateRequest,
    @Param("sessionId") sessionId: string,
    @Body() dto: SaveInterviewAnswerDto,
  ) {
    return this.handle(() => this.interviewService.saveMockAnswer(Number(sessionId), dto, resolveCurrentCandidate(request.currentUser)));
  }

  @Post(interviewApiRoutes.mockNextQuestion)
  moveMockNextQuestion(@Req() request: CandidateRequest, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.moveMockNextQuestion(Number(sessionId), resolveCurrentCandidate(request.currentUser)));
  }

  @Patch(interviewApiRoutes.mockComplete)
  completeMockInterview(@Req() request: CandidateRequest, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.completeMockInterview(Number(sessionId), resolveCurrentCandidate(request.currentUser)));
  }

  requestMockStt(
    request: CandidateRequest,
    sessionId: string,
    dto: AiInterviewRequestDto,
  ) {
    return this.handle(() => this.interviewService.requestMockStt(Number(sessionId), dto, resolveCurrentCandidate(request.currentUser)));
  }

  requestMockFollowUpQuestion(
    request: CandidateRequest,
    sessionId: string,
    dto: AiInterviewRequestDto,
  ) {
    return this.handle(() =>
      this.interviewService.requestMockFollowUpQuestion(Number(sessionId), dto, resolveCurrentCandidate(request.currentUser)),
    );
  }

  @Post(interviewApiRoutes.mockFollowUpQuestionInsert)
  insertMockFollowUpQuestion(
    @Req() request: CandidateRequest,
    @Param("sessionId") sessionId: string,
    @Body() dto: InsertFollowUpQuestionDto,
  ) {
    return this.handle(() =>
      this.interviewService.insertMockFollowUpQuestion(Number(sessionId), dto, resolveCurrentCandidate(request.currentUser)),
    );
  }

  @Post(interviewApiRoutes.deviceCheck)
  saveDeviceCheck(
    @Req() request: CandidateRequest,
    @Param("sessionId") sessionId: string,
    @Body() dto: DeviceCheckDto,
  ) {
    return this.handle(() => this.interviewService.saveDeviceCheck(Number(sessionId), dto, resolveCurrentCandidate(request.currentUser)));
  }

  @Post(interviewApiRoutes.startInterview)
  startInterview(@Req() request: CandidateRequest, @Param("applicationId") applicationId: string) {
    return this.handle(() => this.interviewService.startInterview(Number(applicationId), resolveCurrentCandidate(request.currentUser)));
  }

  @Get(interviewApiRoutes.interviewRuntime)
  getInterviewRuntime(@Req() request: CandidateRequest, @Param("applicationId") applicationId: string) {
    return this.handle(() => this.interviewService.getInterviewRuntime(Number(applicationId), resolveCurrentCandidate(request.currentUser)));
  }

  @Get(interviewApiRoutes.recruitingQuestions)
  listRecruitingQuestions(@Req() request: CandidateRequest, @Param("sessionId") sessionId: string) {
    return this.handle(() => this.interviewService.listRecruitingQuestions(Number(sessionId), resolveCurrentCandidate(request.currentUser)));
  }

  @Post(interviewApiRoutes.recruitingAnswers)
  @HttpCode(201)
  saveRecruitingAnswer(
    @Req() request: CandidateRequest,
    @Param("sessionId") sessionId: string,
    @Body() dto: SaveInterviewAnswerDto,
  ) {
    return this.handle(() =>
      this.interviewService.saveRecruitingAnswer(Number(sessionId), dto, resolveCurrentCandidate(request.currentUser)),
    );
  }

  @Post(interviewApiRoutes.recruitingNextQuestion)
  moveRecruitingNextQuestion(@Req() request: CandidateRequest, @Param("sessionId") sessionId: string) {
    return this.handle(() =>
      this.interviewService.moveRecruitingNextQuestion(Number(sessionId), resolveCurrentCandidate(request.currentUser)),
    );
  }

  @Patch(interviewApiRoutes.recruitingComplete)
  completeRecruitingInterview(@Req() request: CandidateRequest, @Param("sessionId") sessionId: string) {
    return this.handle(() =>
      this.interviewService.completeRecruitingInterview(Number(sessionId), resolveCurrentCandidate(request.currentUser)),
    );
  }

  requestRecruitingStt(
    request: CandidateRequest,
    sessionId: string,
    dto: AiInterviewRequestDto,
  ) {
    return this.handle(() =>
      this.interviewService.requestRecruitingStt(Number(sessionId), dto, resolveCurrentCandidate(request.currentUser)),
    );
  }

  requestRecruitingFollowUpQuestion(
    request: CandidateRequest,
    sessionId: string,
    dto: AiInterviewRequestDto,
  ) {
    return this.handle(() =>
      this.interviewService.requestRecruitingFollowUpQuestion(Number(sessionId), dto, resolveCurrentCandidate(request.currentUser)),
    );
  }

  @Post(interviewApiRoutes.recruitingFollowUpQuestionInsert)
  insertRecruitingFollowUpQuestion(
    @Req() request: CandidateRequest,
    @Param("sessionId") sessionId: string,
    @Body() dto: InsertFollowUpQuestionDto,
  ) {
    return this.handle(() =>
      this.interviewService.insertRecruitingFollowUpQuestion(Number(sessionId), dto, resolveCurrentCandidate(request.currentUser)),
    );
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
