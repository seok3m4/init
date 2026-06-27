import { Module } from "@nestjs/common";
import { DevAuthAdapter } from "../common/dev-auth/dev-auth.adapter";
import { AiReportPipelineService } from "./ai-report-pipeline.service";
import { GuardrailService } from "./guardrail.service";
import { InMemoryReportRepository } from "./in-memory-report.repository";
import { MockAiReportProvider } from "./mock-ai-report.provider";
import { CandidateMockReportsController, ReportsController } from "./reports.controller";

@Module({
  controllers: [ReportsController, CandidateMockReportsController],
  providers: [DevAuthAdapter, AiReportPipelineService, GuardrailService, MockAiReportProvider, InMemoryReportRepository]
})
export class ReportsModule {}
