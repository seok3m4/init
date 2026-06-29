import { Module } from "@nestjs/common";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { CandidateModule } from "./candidate";
import { CompanyRecruitingModule } from "./company-recruiting/company-recruiting.module";
import { HealthController } from "./health.controller";
import { InterviewModule } from "./interview";
import { ReportModule } from "./report/report.module";
import { PrismaService } from "../shared/prisma.service";

@Module({
  imports: [AuthModule, CompanyRecruitingModule, CandidateModule, InterviewModule, ReportModule, AiModule],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
