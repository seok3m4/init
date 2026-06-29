import { Module } from "@nestjs/common";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { CompanyInterviewModule } from "./company-interview/company-interview.module";
import { CompanyRecruitingModule } from "./company-recruiting/company-recruiting.module";
import { HealthController } from "./health/controller/health.controller";
import { ReportModule } from "./report/report.module";
import { PrismaService } from "../shared/prisma.service";

@Module({
  imports: [
    AuthModule,
    CompanyRecruitingModule,
    ReportModule,
    AiModule,
    CompanyInterviewModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
