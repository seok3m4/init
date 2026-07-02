import { Module } from "@nestjs/common";
import { DevAuthAdapter } from "../../common/dev-auth/dev-auth.adapter";
import { PrismaService } from "../../shared/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { CandidateModule } from "../candidate";
import { InterviewModule } from "../interview";
import { ReportController } from "./controller/report.controller";
import { ReportsController } from "./controller/reports.controller";
import { CANDIDATE_REPORT_REPOSITORY } from "./repository/candidate-report.repository";
import { InMemoryCandidateReportRepository } from "./repository/in-memory-candidate-report.repository";
import { InMemoryReportRepository } from "./repository/in-memory-report.repository";
import { PrismaCandidateReportRepository } from "./repository/prisma-candidate-report.repository";
import { PrismaReportRepository } from "./repository/prisma-report.repository";
import { REPORT_REPOSITORY } from "./repository/report.repository";
import { AiJobDispatcherService } from "./service/ai-job-dispatcher.service";
import { AI_JOB_QUEUE_PUBLISHER, createAiJobQueuePublisher } from "./service/ai-job-queue.publisher";
import { AiReportPipelineService } from "./service/ai-report-pipeline.service";
import { GuardrailService } from "./service/guardrail.service";
import { MockAiReportProvider } from "./service/mock-ai-report.provider";
import { ReportService } from "./service/report.service";

const usePrismaRepository = process.env.NODE_ENV !== "test" && Boolean(process.env.DATABASE_URL);

const repositoryProviders = usePrismaRepository
  ? [
      PrismaService,
      {
        provide: REPORT_REPOSITORY,
        inject: [PrismaService],
        useFactory: (prisma: PrismaService) => new PrismaReportRepository(prisma),
      },
    ]
  : [
      InMemoryReportRepository,
      {
        provide: REPORT_REPOSITORY,
        useExisting: InMemoryReportRepository,
      },
    ];

const candidateReportRepositoryProvider = usePrismaRepository
  ? {
      provide: CANDIDATE_REPORT_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaCandidateReportRepository(prisma),
    }
  : {
      provide: CANDIDATE_REPORT_REPOSITORY,
      useClass: InMemoryCandidateReportRepository,
    };

@Module({
  imports: [AuthModule, CandidateModule, InterviewModule],
  controllers: [ReportsController, ReportController],
  providers: [
    DevAuthAdapter,
    AiJobDispatcherService,
    {
      provide: AI_JOB_QUEUE_PUBLISHER,
      useFactory: () => createAiJobQueuePublisher(),
    },
    AiReportPipelineService,
    GuardrailService,
    candidateReportRepositoryProvider,
    MockAiReportProvider,
    ReportService,
    ...repositoryProviders,
  ],
  exports: [
    DevAuthAdapter,
    AiJobDispatcherService,
    GuardrailService,
    CANDIDATE_REPORT_REPOSITORY,
    REPORT_REPOSITORY,
    ReportService,
  ],
})
export class ReportModule {}
