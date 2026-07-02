import { Controller, Get, Inject, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ok, type RequestLike } from "../../../shared/response-envelope";
import { ApiEnvelopeResponse, ApiErrorResponses, ApiOperationId } from "../../../swagger/swagger.decorators";
import { PublicApplicationStatusResponseDto } from "../dto/company-recruiting-response.dto";
import { PublicApplicationStatusQueryDto } from "../dto/request-public-application-access-link.dto";
import { CompanyRecruitingService } from "../service/company-recruiting.service";

@ApiTags("Public Application")
@ApiErrorResponses()
@Controller("public/applications")
export class PublicApplicationController {
  constructor(@Inject(CompanyRecruitingService) private readonly companyRecruitingService: CompanyRecruitingService) {}

  @Get("status")
  @ApiOperationId("API-089")
  @ApiOperation({ summary: "매직링크 토큰 기반 지원 현황 조회" })
  @ApiEnvelopeResponse(PublicApplicationStatusResponseDto)
  async getPublicApplicationStatus(@Req() request: RequestLike, @Query() query: PublicApplicationStatusQueryDto) {
    const data = await this.companyRecruitingService.getPublicApplicationStatusByMagicLink(query.token);
    return ok(request, data);
  }
}
