import { Module } from "@nestjs/common";
import { DevAuthAdapter } from "../../common/dev-auth/dev-auth.adapter";
import { PrismaService } from "../../shared/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { CandidateModule } from "../candidate";
import { InterviewModule } from "../interview";
import { AiJobDispatcherService } from "./ai-job-dispatcher.service";
import { AI_JOB_QUEUE_PUBLISHER, createAiJobQueuePublisher } from "./ai-job-queue.publisher";
import { AiReportPipelineService } from "./ai-report-pipeline.service";
import { GuardrailService } from "./guardrail.service";
import { InMemoryReportRepository } from "./in-memory-report.repository";
import { MockAiReportProvider } from "./mock-ai-report.provider";
import { PrismaReportRepository } from "./prisma-report.repository";
import { ReportController } from "./report.controller";
import { REPORT_REPOSITORY } from "./report.repository";
import { ReportService } from "./report.service";
import { CandidateMockReportsController, ReportsController } from "./reports.controller";

const repositoryProviders = process.env.DATABASE_URL
  ? [
      PrismaService,
      PrismaReportRepository,
      {
        provide: REPORT_REPOSITORY,
        useExisting: PrismaReportRepository,
      },
    ]
  : [
      InMemoryReportRepository,
      {
        provide: REPORT_REPOSITORY,
        useExisting: InMemoryReportRepository,
      },
    ];

@Module({
  imports: [AuthModule, CandidateModule, InterviewModule],
  controllers: [ReportsController, CandidateMockReportsController, ReportController],
  providers: [
    DevAuthAdapter,
    AiJobDispatcherService,
    {
      provide: AI_JOB_QUEUE_PUBLISHER,
      useFactory: () => createAiJobQueuePublisher(),
    },
    AiReportPipelineService,
    GuardrailService,
    MockAiReportProvider,
    ReportService,
    ...repositoryProviders,
  ],
  exports: [DevAuthAdapter, AiJobDispatcherService, GuardrailService, REPORT_REPOSITORY, ReportService],
})
export class ReportModule {}
