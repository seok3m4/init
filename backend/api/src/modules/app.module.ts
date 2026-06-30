import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../shared/prisma.service";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { CandidateModule } from "./candidate";
import { CompanyInterviewModule } from "./company-interview/company-interview.module";
import { CompanyRecruitingModule } from "./company-recruiting/company-recruiting.module";
import { HealthController } from "./health/controller/health.controller";
import { InterviewModule } from "./interview";
import { ReportModule } from "./report/report.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    CompanyRecruitingModule,
    CandidateModule,
    InterviewModule,
    ReportModule,
    AiModule,
    CompanyInterviewModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
