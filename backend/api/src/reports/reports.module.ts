import { Module } from "@nestjs/common";
import { DevAuthAdapter } from "../common/dev-auth/dev-auth.adapter";
import { AiJobDispatcherService } from "./ai-job-dispatcher.service";
import { AI_JOB_QUEUE_PUBLISHER, createAiJobQueuePublisher } from "./ai-job-queue.publisher";
import { AiJobsStatusController, CandidateAiJobsController, CompanyAiJobsController } from "./ai-jobs.controller";
import { AiReportPipelineService } from "./ai-report-pipeline.service";
import { GuardrailService } from "./guardrail.service";
import { InMemoryReportRepository } from "./in-memory-report.repository";
import { MockAiReportProvider } from "./mock-ai-report.provider";
import { PrismaReportRepository } from "./prisma-report.repository";
import { PrismaService } from "./prisma.service";
import { REPORT_REPOSITORY } from "./report.repository";
import { AiGuardrailsController } from "./ai-guardrails.controller";
import { CandidateMockReportsController, ReportsController } from "./reports.controller";

const repositoryProviders = process.env.DATABASE_URL
  ? [
      PrismaService,
      PrismaReportRepository,
      {
        provide: REPORT_REPOSITORY,
        useExisting: PrismaReportRepository
      }
    ]
  : [
      InMemoryReportRepository,
      {
        provide: REPORT_REPOSITORY,
        useExisting: InMemoryReportRepository
      }
    ];

@Module({
  controllers: [
    ReportsController,
    CandidateMockReportsController,
    AiGuardrailsController,
    CandidateAiJobsController,
    CompanyAiJobsController,
    AiJobsStatusController
  ],
  providers: [
    DevAuthAdapter,
    AiJobDispatcherService,
    {
      provide: AI_JOB_QUEUE_PUBLISHER,
      useFactory: () => createAiJobQueuePublisher()
    },
    AiReportPipelineService,
    GuardrailService,
    MockAiReportProvider,
    ...repositoryProviders
  ]
})
export class ReportsModule {}
