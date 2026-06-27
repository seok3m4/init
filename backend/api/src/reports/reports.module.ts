import { Module } from "@nestjs/common";
import { DevAuthAdapter } from "../common/dev-auth/dev-auth.adapter";
import { AiReportPipelineService } from "./ai-report-pipeline.service";
import { GuardrailService } from "./guardrail.service";
import { MockAiReportProvider } from "./mock-ai-report.provider";
import { ReportsController } from "./reports.controller";

@Module({
  controllers: [ReportsController],
  providers: [DevAuthAdapter, AiReportPipelineService, GuardrailService, MockAiReportProvider]
})
export class ReportsModule {}
