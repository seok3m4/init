import { Controller, Get, Inject, Param, ParseIntPipe, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ok, type RequestLike } from "../../../shared/response-envelope";
import { ApiEnvelopeResponse, ApiErrorResponses, ApiOperationId, ApiParamId } from "../../../swagger/swagger.decorators";
import { PublicRecruitmentResponseDto } from "../dto/company-recruiting-response.dto";
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
}
