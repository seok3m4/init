import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ok, type RequestLike } from "../../../shared/response-envelope";
import { ApiEnvelopeResponse, ApiErrorResponses, ApiOperationId, ApiParamId } from "../../../swagger/swagger.decorators";
import {
  PublicApplicationAccessLinkResponseDto,
  PublicApplicationResponseDto,
  PublicRecruitmentResponseDto,
} from "../dto/company-recruiting-response.dto";
import { RequestPublicApplicationAccessLinkDto } from "../dto/request-public-application-access-link.dto";
import { SubmitPublicApplicationDto } from "../dto/submit-public-application.dto";
import { CompanyRecruitingService } from "../service/company-recruiting.service";

@ApiTags("Public Recruitment")
@ApiErrorResponses()
@Controller("public/recruitments")
export class PublicRecruitmentController {
  constructor(@Inject(CompanyRecruitingService) private readonly companyRecruitingService: CompanyRecruitingService) {}

  @Get(":recruitmentId")
  @ApiOperationId("API-086")
  @ApiOperation({ summary: "공개 공고 상세 조회" })
  @ApiParamId("recruitmentId", "채용 공고 ID")
  @ApiEnvelopeResponse(PublicRecruitmentResponseDto)
  async getPublicRecruitment(
    @Req() request: RequestLike,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
  ) {
    const data = await this.companyRecruitingService.getPublicRecruitment(recruitmentId);
    return ok(request, data);
  }

  @Post(":recruitmentId/applications")
  @ApiOperationId("API-087")
  @ApiOperation({ summary: "공개 지원 폼 제출" })
  @ApiParamId("recruitmentId", "채용 공고 ID")
  @ApiEnvelopeResponse(PublicApplicationResponseDto, 201)
  async submitPublicApplication(
    @Req() request: RequestLike,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
    @Body() dto: SubmitPublicApplicationDto,
  ) {
    const data = await this.companyRecruitingService.submitPublicApplication(recruitmentId, dto);
    return ok(request, data);
  }

  @Post(":recruitmentId/applications/access-link")
  @ApiOperationId("API-088")
  @ApiOperation({ summary: "지원 현황 매직링크 재발급 요청" })
  @ApiParamId("recruitmentId", "채용 공고 ID")
  @ApiEnvelopeResponse(PublicApplicationAccessLinkResponseDto)
  async requestPublicApplicationAccessLink(
    @Req() request: RequestLike,
    @Param("recruitmentId", ParseIntPipe) recruitmentId: number,
    @Body() dto: RequestPublicApplicationAccessLinkDto,
  ) {
    const data = await this.companyRecruitingService.requestPublicApplicationAccessLink(recruitmentId, dto);
    return ok(request, data);
  }
}
