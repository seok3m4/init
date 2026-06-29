import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CurrentUser } from '@init/common';
import { ok, type RequestLike } from '../../shared/response-envelope';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyInterviewService } from './company-interview.service';
import { InterviewSettingsQueryDto } from './dto/interview-settings.dto';
import {
  SuggestEvaluationCriterionDto,
  UpdateEvaluationCriterionDto,
} from './dto/evaluation-criterion.dto';
import {
  CreateInterviewQuestionDto,
  CreateQuestionSetDto,
  GenerateInterviewQuestionsDto,
} from './dto/question-management.dto';

type CompanyRequest = RequestLike & { currentUser: CurrentUser };

@Controller('company/interviews')
@UseGuards(JwtAuthGuard)
export class CompanyInterviewController {
  constructor(private readonly service: CompanyInterviewService) {}

  @Get('settings')
  async getSettings(
    @Req() request: CompanyRequest,
    @Query() query: InterviewSettingsQueryDto,
  ) {
    const data = await this.service.getSettings(request.currentUser, query);
    return ok(request, data);
  }

  @Post('evaluation-criteria/suggest')
  @HttpCode(HttpStatus.ACCEPTED)
  async suggestEvaluationCriteria(
    @Req() request: CompanyRequest,
    @Body() body: SuggestEvaluationCriterionDto,
  ) {
    const data = await this.service.suggestEvaluationCriteria(
      request.currentUser,
      body,
    );
    return ok(request, data);
  }

  @Patch('evaluation-criteria')
  async updateEvaluationCriteria(
    @Req() request: CompanyRequest,
    @Body() body: UpdateEvaluationCriterionDto,
  ) {
    const data = await this.service.updateEvaluationCriteria(
      request.currentUser,
      body,
    );
    return ok(request, data);
  }

  @Post('questions')
  async createQuestion(
    @Req() request: CompanyRequest,
    @Body() body: CreateInterviewQuestionDto,
  ) {
    const data = await this.service.createQuestion(request.currentUser, body);
    return ok(request, data);
  }

  @Post('questions/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateQuestions(
    @Req() request: CompanyRequest,
    @Body() body: GenerateInterviewQuestionsDto,
  ) {
    const data = await this.service.generateQuestions(request.currentUser, body);
    return ok(request, data);
  }

  @Post('question-sets')
  @HttpCode(HttpStatus.ACCEPTED)
  async createQuestionSet(
    @Req() request: CompanyRequest,
    @Body() body: CreateQuestionSetDto,
  ) {
    const data = await this.service.createQuestionSet(request.currentUser, body);
    return ok(request, data);
  }
}
