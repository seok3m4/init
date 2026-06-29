import { Module } from "@nestjs/common";
import { ReportModule } from "../report/report.module";
import { AiGuardrailsController } from "./controller/ai-guardrails.controller";
import { AiJobsStatusController, CandidateAiJobsController, CompanyAiJobsController } from "./controller/ai-jobs.controller";

@Module({
  imports: [ReportModule],
  controllers: [
    AiGuardrailsController,
    CandidateAiJobsController,
    CompanyAiJobsController,
    AiJobsStatusController
  ]
})
export class AiModule {}
