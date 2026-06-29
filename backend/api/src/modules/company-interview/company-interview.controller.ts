import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CompanyInterviewService } from './company-interview.service';
import { CurrentUserParam } from './decorators/current-user.decorator';
import { CurrentUser, ApiResponse } from './company-interview.types';
import { InterviewSettingsQueryDto } from './dto/interview-settings.dto';
import {
  SuggestEvaluationCriterionDto,
  UpdateEvaluationCriterionDto,
} from './dto/evaluation-criterion.dto';
import { CompanyDevAuthGuard } from './guards/company-dev-auth.guard';

@Controller('company/interviews')
@UseGuards(CompanyDevAuthGuard)
export class CompanyInterviewController {
  constructor(private readonly service: CompanyInterviewService) {}

  @Get('settings')
  getSettings(
    @CurrentUserParam() currentUser: CurrentUser,
    @Query() query: InterviewSettingsQueryDto,
  ) {
    return this.ok(this.service.getSettings(currentUser, query));
  }

  @Post('evaluation-criteria/suggest')
  @HttpCode(HttpStatus.ACCEPTED)
  suggestEvaluationCriteria(
    @CurrentUserParam() currentUser: CurrentUser,
    @Body() body: SuggestEvaluationCriterionDto,
  ) {
    return this.ok(this.service.suggestEvaluationCriteria(currentUser, body));
  }

  @Patch('evaluation-criteria')
  updateEvaluationCriteria(
    @CurrentUserParam() currentUser: CurrentUser,
    @Body() body: UpdateEvaluationCriterionDto,
  ) {
    return this.ok(this.service.updateEvaluationCriteria(currentUser, body));
  }

  private ok<T>(data: T): ApiResponse<T> {
    return {
      data,
      meta: {
        traceId: 'company-interview-local',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
