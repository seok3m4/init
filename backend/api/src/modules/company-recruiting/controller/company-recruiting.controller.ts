import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { CurrentUser } from "@init/common";

import { ok, okList, type RequestLike } from "../../../shared/response-envelope";
import { ApiEnvelopeResponse, ApiErrorResponses, ApiListEnvelopeResponse, ApiOperationId, ApiParamId } from "../../../swagger/swagger.decorators";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CompanyRecruitingService } from "../service/company-recruiting.service";
import { ApplicantEvaluationResponseDto, ApplicantResponseDto, InvitationResponseDto, RecruitmentResponseDto } from "../dto/company-recruiting-response.dto";
import { CreateApplicantDto } from "../dto/create-applicant.dto";
import { CreateRecruitmentDto } from "../dto/create-recruitment.dto";
import { InviteApplicantDto } from "../dto/invite-applicant.dto";
import { ListQueryDto } from "../dto/list-query.dto";
import { UpdateRecruitmentDto } from "../dto/update-recruitment.dto";
import { UpdateScreeningStatusDto } from "../dto/update-screening-status.dto";

type CompanyRequest = RequestLike & { currentUser: CurrentUser };

@UseGuards(JwtAuthGuard)
@ApiTags("Company Recruiting")
@ApiBearerAuth("bearer")
@ApiErrorResponses()
@Controller("company")
export class CompanyRecruitingController {
  constructor(@Inject(CompanyRecruitingService) private readonly companyRecruitingService: CompanyRecruitingService) {}

  @Post("recruitments")
  @ApiOperationId("API-080")
  @ApiOperation({ summary: "기업 공고 생성" })
  @ApiEnvelopeResponse(RecruitmentResponseDto, 201)
  async createRecruitment(
    @Req() request: CompanyRequest,
    @Body() dto: CreateRecruitmentDto,
  ) {
    const data = await this.companyRecruitingService.createRecruitment(request.currentUser, dto);
    return ok(request, data);
  }

  @Get("recruitments")
  @ApiOperationId("API-011/API-032")
  @ApiOperation({ summary: "회사별 공고 목록 조회와 검색/필터링" })
  @ApiListEnvelopeResponse(RecruitmentResponseDto)
  async listRecruitments(
    @Req() request: CompanyRequest,
    @Query() query: ListQueryDto,
  ) {
    const result = await this.companyRecruitingService.listRecruitments(request.currentUser, query);
    return okList(request, result.items, result.page);
  }

  @Get("recruitments/:recruitmentId")
  @ApiOperationId("API-013")
  @ApiOperation({ summary: "공고 상세 조회" })
  @ApiParamId("recruitmentId", "채용 공고 ID")
  @ApiEnvelopeResponse(RecruitmentResponseDto)
  async getRecruitment(
    @Req() request: CompanyRequest,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
  ) {
    const data = await this.companyRecruitingService.getRecruitment(request.currentUser, recruitmentId);
    return ok(request, data);
  }

  @Patch("recruitments/:recruitmentId")
  @ApiOperationId("API-083")
  @ApiOperation({ summary: "공고 설정 수정" })
  @ApiParamId("recruitmentId", "채용 공고 ID")
  @ApiEnvelopeResponse(RecruitmentResponseDto)
  async updateRecruitment(
    @Req() request: CompanyRequest,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
    @Body() dto: UpdateRecruitmentDto,
  ) {
    const data = await this.companyRecruitingService.updateRecruitment(request.currentUser, recruitmentId, dto);
    return ok(request, data);
  }

  @Delete("recruitments/:recruitmentId")
  @ApiOperationId("API-084")
  @ApiOperation({ summary: "공고 삭제/보관" })
  @ApiParamId("recruitmentId", "삭제할 채용 공고 ID")
  @ApiEnvelopeResponse(RecruitmentResponseDto)
  async deleteRecruitment(
    @Req() request: CompanyRequest,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
  ) {
    const data = await this.companyRecruitingService.deleteRecruitment(request.currentUser, recruitmentId);
    return ok(request, data);
  }

  @Post("recruitments/:recruitmentId/copy")
  @ApiOperationId("API-033")
  @ApiOperation({ summary: "마감 공고 복사" })
  @ApiParamId("recruitmentId", "복사할 마감 공고 ID")
  @ApiEnvelopeResponse(RecruitmentResponseDto)
  async copyRecruitment(
    @Req() request: CompanyRequest,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
  ) {
    const data = await this.companyRecruitingService.copyRecruitment(request.currentUser, recruitmentId);
    return ok(request, data);
  }

  @Get("recruitments/:recruitmentId/applicants")
  @ApiOperationId("API-014")
  @ApiOperation({ summary: "공고별 지원자 목록 조회" })
  @ApiParamId("recruitmentId", "채용 공고 ID")
  @ApiListEnvelopeResponse(ApplicantResponseDto)
  async listRecruitmentApplicants(
    @Req() request: CompanyRequest,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
    @Query() query: ListQueryDto,
  ) {
    const result = await this.companyRecruitingService.listRecruitmentApplicants(request.currentUser, recruitmentId, query);
    return okList(request, result.items, result.page);
  }

  @Post("applicants")
  @ApiOperationId("API-015")
  @ApiOperation({ summary: "지원자 직접 등록" })
  @ApiEnvelopeResponse(ApplicantResponseDto, 201)
  async registerApplicant(
    @Req() request: CompanyRequest,
    @Body() dto: CreateApplicantDto,
  ) {
    const data = await this.companyRecruitingService.registerApplicant(request.currentUser, dto);
    return ok(request, data);
  }

  @Get("applicants")
  @ApiOperationId("API-018")
  @ApiOperation({ summary: "지원자 목록 조회" })
  @ApiListEnvelopeResponse(ApplicantResponseDto)
  async listApplicants(
    @Req() request: CompanyRequest,
    @Query() query: ListQueryDto & { recruitmentId?: number },
  ) {
    const recruitmentId = Number(query.recruitmentId);
    const result = await this.companyRecruitingService.listRecruitmentApplicants(request.currentUser, recruitmentId, query);
    return okList(request, result.items, result.page);
  }

  @Post("applicants/invitations")
  @ApiOperationId("API-016")
  @ApiOperation({ summary: "지원자 초대 메일 발송 요청" })
  @ApiEnvelopeResponse(InvitationResponseDto)
  async inviteApplicant(
    @Req() request: CompanyRequest,
    @Body() dto: InviteApplicantDto,
  ) {
    const data = await this.companyRecruitingService.inviteApplicant(request.currentUser, dto);
    return ok(request, data);
  }

  @Get("applicants/:applicantId/evaluation")
  @ApiOperationId("API-020")
  @ApiOperation({ summary: "서류 평가와 채용 리포트 통합 조회" })
  @ApiParamId("applicantId", "지원자/application ID")
  @ApiEnvelopeResponse(ApplicantEvaluationResponseDto)
  async getApplicantEvaluation(
    @Req() request: CompanyRequest,
    @Param("applicantId", ParseIntPipe) applicantId: number,
  ) {
    const data = await this.companyRecruitingService.getApplicantEvaluation(request.currentUser, applicantId);
    return ok(request, data);
  }

  @Patch("applicants/:applicantId/screening-status")
  @ApiOperationId("API-012")
  @ApiOperation({ summary: "전형 상태 지정" })
  @ApiParamId("applicantId", "지원자/application ID")
  @ApiEnvelopeResponse(ApplicantResponseDto)
  async updateScreeningStatus(
    @Req() request: CompanyRequest,
    @Param("applicantId", ParseIntPipe) applicantId: number,
    @Body() dto: UpdateScreeningStatusDto,
  ) {
    const data = await this.companyRecruitingService.updateScreeningStatus(request.currentUser, applicantId, dto);
    return ok(request, data);
  }
}
