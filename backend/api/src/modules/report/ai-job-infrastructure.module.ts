import { Module } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { InMemoryReportRepository } from "./repository/in-memory-report.repository";
import { PrismaReportRepository } from "./repository/prisma-report.repository";
import { REPORT_REPOSITORY, ReportRepository } from "./repository/report.repository";
import { AiJobDispatcherService } from "./service/ai-job-dispatcher.service";
import { AI_JOB_QUEUE_PUBLISHER, createAiJobQueuePublisher } from "./service/ai-job-queue.publisher";

export function createRuntimeReportRepository(
  prisma: PrismaService,
  inMemory: InMemoryReportRepository,
  env: NodeJS.ProcessEnv = process.env,
): ReportRepository {
  return env.NODE_ENV !== "test" && Boolean(env.DATABASE_URL)
    ? new PrismaReportRepository(prisma)
    : inMemory;
}

@Module({
  providers: [
    PrismaService,
    InMemoryReportRepository,
    {
      provide: REPORT_REPOSITORY,
      inject: [PrismaService, InMemoryReportRepository],
      useFactory: createRuntimeReportRepository,
    },
    {
      provide: AI_JOB_QUEUE_PUBLISHER,
      useFactory: () => createAiJobQueuePublisher(),
    },
    AiJobDispatcherService,
  ],
  exports: [REPORT_REPOSITORY, AI_JOB_QUEUE_PUBLISHER, AiJobDispatcherService],
})
export class AiJobInfrastructureModule {}
