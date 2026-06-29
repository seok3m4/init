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
import type { CurrentUser } from "@init/common";

import { ok, okList, type RequestLike } from "../../shared/response-envelope";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CompanyRecruitingService } from "./company-recruiting.service";
import { CreateApplicantDto } from "./dto/create-applicant.dto";
import { CreateRecruitmentDto } from "./dto/create-recruitment.dto";
import { InviteApplicantDto } from "./dto/invite-applicant.dto";
import { ListQueryDto } from "./dto/list-query.dto";
import { UpdateScreeningStatusDto } from "./dto/update-screening-status.dto";

type CompanyRequest = RequestLike & { currentUser: CurrentUser };

@UseGuards(JwtAuthGuard)
@Controller("company")
export class CompanyRecruitingController {
  constructor(private readonly companyRecruitingService: CompanyRecruitingService) {}

  @Post("recruitments")
  async createRecruitment(
    @Req() request: CompanyRequest,
    @Body() dto: CreateRecruitmentDto,
  ) {
    const data = await this.companyRecruitingService.createRecruitment(request.currentUser, dto);
    return ok(request, data);
  }

  @Get("recruitments")
  async listRecruitments(
    @Req() request: CompanyRequest,
    @Query() query: ListQueryDto,
  ) {
    const result = await this.companyRecruitingService.listRecruitments(request.currentUser, query);
    return okList(request, result.items, result.page);
  }

  @Get("recruitments/:recruitmentId")
  async getRecruitment(
    @Req() request: CompanyRequest,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
  ) {
    const data = await this.companyRecruitingService.getRecruitment(request.currentUser, recruitmentId);
    return ok(request, data);
  }

  @Post("recruitments/:recruitmentId/copy")
  async copyRecruitment(
    @Req() request: CompanyRequest,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
  ) {
    const data = await this.companyRecruitingService.copyRecruitment(request.currentUser, recruitmentId);
    return ok(request, data);
  }

  @Get("recruitments/:recruitmentId/applicants")
  async listRecruitmentApplicants(
    @Req() request: CompanyRequest,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
    @Query() query: ListQueryDto,
  ) {
    const result = await this.companyRecruitingService.listRecruitmentApplicants(request.currentUser, recruitmentId, query);
    return okList(request, result.items, result.page);
  }

  @Post("applicants")
  async registerApplicant(
    @Req() request: CompanyRequest,
    @Body() dto: CreateApplicantDto,
  ) {
    const data = await this.companyRecruitingService.registerApplicant(request.currentUser, dto);
    return ok(request, data);
  }

  @Get("applicants")
  async listApplicants(
    @Req() request: CompanyRequest,
    @Query() query: ListQueryDto & { recruitmentId?: number },
  ) {
    const recruitmentId = Number(query.recruitmentId);
    const result = await this.companyRecruitingService.listRecruitmentApplicants(request.currentUser, recruitmentId, query);
    return okList(request, result.items, result.page);
  }

  @Post("applicants/invitations")
  async inviteApplicant(
    @Req() request: CompanyRequest,
    @Body() dto: InviteApplicantDto,
  ) {
    const data = await this.companyRecruitingService.inviteApplicant(request.currentUser, dto);
    return ok(request, data);
  }

  @Get("applicants/:applicantId/evaluation")
  async getApplicantEvaluation(
    @Req() request: CompanyRequest,
    @Param("applicantId", ParseIntPipe) applicantId: number,
  ) {
    const data = await this.companyRecruitingService.getApplicantEvaluation(request.currentUser, applicantId);
    return ok(request, data);
  }

  @Patch("applicants/:applicantId/screening-status")
  async updateScreeningStatus(
    @Req() request: CompanyRequest,
    @Param("applicantId", ParseIntPipe) applicantId: number,
    @Body() dto: UpdateScreeningStatusDto,
  ) {
    const data = await this.companyRecruitingService.updateScreeningStatus(request.currentUser, applicantId, dto);
    return ok(request, data);
  }
}
