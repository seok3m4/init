import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { CurrentUserParam } from "../../common/current-user.decorator";
import type { CurrentUser } from "../../common/current-user.type";
import { DevAuthGuard } from "../../common/dev-auth.guard";
import { ok, okList, type RequestLike } from "../../common/response-envelope";
import { CompanyRecruitingService } from "./company-recruiting.service";
import { CreateApplicantDto } from "./dto/create-applicant.dto";
import { CreateRecruitmentDto } from "./dto/create-recruitment.dto";
import { InviteApplicantDto } from "./dto/invite-applicant.dto";
import { ListQueryDto } from "./dto/list-query.dto";
import { UpdateScreeningStatusDto } from "./dto/update-screening-status.dto";

@UseGuards(DevAuthGuard)
@Controller("api/v1/company")
export class CompanyRecruitingController {
  constructor(private readonly companyRecruitingService: CompanyRecruitingService) {}

  @Post("recruitments")
  async createRecruitment(
    @Req() request: RequestLike,
    @CurrentUserParam() currentUser: CurrentUser,
    @Body() dto: CreateRecruitmentDto,
  ) {
    const data = await this.companyRecruitingService.createRecruitment(currentUser, dto);
    return ok(request, data);
  }

  @Get("recruitments")
  async listRecruitments(
    @Req() request: RequestLike,
    @CurrentUserParam() currentUser: CurrentUser,
    @Query() query: ListQueryDto,
  ) {
    const result = await this.companyRecruitingService.listRecruitments(currentUser, query);
    return okList(request, result.items, result.page);
  }

  @Get("recruitments/:recruitmentId")
  async getRecruitment(
    @Req() request: RequestLike,
    @CurrentUserParam() currentUser: CurrentUser,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
  ) {
    const data = await this.companyRecruitingService.getRecruitment(currentUser, recruitmentId);
    return ok(request, data);
  }

  @Post("recruitments/:recruitmentId/copy")
  async copyRecruitment(
    @Req() request: RequestLike,
    @CurrentUserParam() currentUser: CurrentUser,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
  ) {
    const data = await this.companyRecruitingService.copyRecruitment(currentUser, recruitmentId);
    return ok(request, data);
  }

  @Get("recruitments/:recruitmentId/applicants")
  async listRecruitmentApplicants(
    @Req() request: RequestLike,
    @CurrentUserParam() currentUser: CurrentUser,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
    @Query() query: ListQueryDto,
  ) {
    const result = await this.companyRecruitingService.listRecruitmentApplicants(currentUser, recruitmentId, query);
    return okList(request, result.items, result.page);
  }

  @Post("applicants")
  async registerApplicant(
    @Req() request: RequestLike,
    @CurrentUserParam() currentUser: CurrentUser,
    @Body() dto: CreateApplicantDto,
  ) {
    const data = await this.companyRecruitingService.registerApplicant(currentUser, dto);
    return ok(request, data);
  }

  @Get("applicants")
  async listApplicants(
    @Req() request: RequestLike,
    @CurrentUserParam() currentUser: CurrentUser,
    @Query() query: ListQueryDto & { recruitmentId?: number },
  ) {
    const recruitmentId = Number(query.recruitmentId);
    const result = await this.companyRecruitingService.listRecruitmentApplicants(currentUser, recruitmentId, query);
    return okList(request, result.items, result.page);
  }

  @Post("applicants/invitations")
  async inviteApplicant(
    @Req() request: RequestLike,
    @CurrentUserParam() currentUser: CurrentUser,
    @Body() dto: InviteApplicantDto,
  ) {
    const data = await this.companyRecruitingService.inviteApplicant(currentUser, dto);
    return ok(request, data);
  }

  @Get("applicants/:applicantId/evaluation")
  async getApplicantEvaluation(
    @Req() request: RequestLike,
    @CurrentUserParam() currentUser: CurrentUser,
    @Param("applicantId", ParseIntPipe) applicantId: number,
  ) {
    const data = await this.companyRecruitingService.getApplicantEvaluation(currentUser, applicantId);
    return ok(request, data);
  }

  @Patch("applicants/:applicantId/screening-status")
  async updateScreeningStatus(
    @Req() request: RequestLike,
    @CurrentUserParam() currentUser: CurrentUser,
    @Param("applicantId", ParseIntPipe) applicantId: number,
    @Body() dto: UpdateScreeningStatusDto,
  ) {
    const data = await this.companyRecruitingService.updateScreeningStatus(currentUser, applicantId, dto);
    return ok(request, data);
  }
}
