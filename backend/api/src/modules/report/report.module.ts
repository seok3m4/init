import { Module } from "@nestjs/common";
import { DevAuthAdapter } from "../../common/dev-auth/dev-auth.adapter";
import { PrismaService } from "../../shared/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { CandidateModule } from "../candidate";
import { InterviewModule } from "../interview";
import { CandidateMockReportsController, ReportsController } from "./controller/reports.controller";
import { InMemoryReportRepository } from "./repository/in-memory-report.repository";
import { PrismaReportRepository } from "./repository/prisma-report.repository";
import { REPORT_REPOSITORY } from "./repository/report.repository";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";
import { AiJobDispatcherService } from "./service/ai-job-dispatcher.service";
import { AI_JOB_QUEUE_PUBLISHER, createAiJobQueuePublisher } from "./service/ai-job-queue.publisher";
import { AiReportPipelineService } from "./service/ai-report-pipeline.service";
import { GuardrailService } from "./service/guardrail.service";
import { MockAiReportProvider } from "./service/mock-ai-report.provider";

const usePrismaRepository = process.env.NODE_ENV !== "test" && Boolean(process.env.DATABASE_URL);

const repositoryProviders = usePrismaRepository
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
