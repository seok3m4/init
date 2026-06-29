import { Module } from '@nestjs/common';
import { CompanyInterviewController } from './company-interview.controller';
import { CompanyInterviewService } from './company-interview.service';
import { CompanyDevAuthGuard } from './guards/company-dev-auth.guard';
import { COMPANY_INTERVIEW_REPOSITORY } from './repositories/company-interview.repository';
import { InMemoryCompanyInterviewRepository } from './repositories/in-memory-company-interview.repository';

@Module({
  controllers: [CompanyInterviewController],
  providers: [
    CompanyInterviewService,
    CompanyDevAuthGuard,
    {
      provide: COMPANY_INTERVIEW_REPOSITORY,
      useClass: InMemoryCompanyInterviewRepository,
    },
  ],
})
export class CompanyInterviewModule {}
