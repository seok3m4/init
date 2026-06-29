import { Module } from "@nestjs/common";
import { DevAuthAdapter } from "../../common/dev-auth/dev-auth.adapter";
import { AiJobDispatcherService } from "./service/ai-job-dispatcher.service";
import { AI_JOB_QUEUE_PUBLISHER, createAiJobQueuePublisher } from "./service/ai-job-queue.publisher";
import { AiReportPipelineService } from "./service/ai-report-pipeline.service";
import { GuardrailService } from "./service/guardrail.service";
import { InMemoryReportRepository } from "./repository/in-memory-report.repository";
import { MockAiReportProvider } from "./service/mock-ai-report.provider";
import { PrismaReportRepository } from "./repository/prisma-report.repository";
import { PrismaService } from "../../shared/prisma.service";
import { REPORT_REPOSITORY } from "./repository/report.repository";
import { CandidateMockReportsController, ReportsController } from "./controller/reports.controller";

const usePrismaRepository = process.env.NODE_ENV !== "test" && Boolean(process.env.DATABASE_URL);

const repositoryProviders = usePrismaRepository
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
  controllers: [ReportsController, CandidateMockReportsController],
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
  ],
  exports: [
    DevAuthAdapter,
    AiJobDispatcherService,
    GuardrailService,
    REPORT_REPOSITORY
  ]
})
export class ReportModule {}
