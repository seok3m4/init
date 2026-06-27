import { createRequire } from "node:module";
import path from "node:path";
import { AiResultRepository, InMemoryAiResultRepository } from "./ai-result.repository";
import { MockAiTaskHandler } from "./mock-ai-task.handler";
import { AiProcessLogRepository, InMemoryAiProcessLogRepository } from "./process-log.repository";
import { PrismaAiResultRepository } from "./prisma-ai-result.repository";
import { PrismaAiProcessLogRepository } from "./prisma-process-log.repository";
import { AiJobQueue } from "./queue";
import { createReportFailureHandler } from "./report-failure.handler";
import { WorkerEnv } from "./worker-env";
import { AiWorkerRunner } from "./worker-runner";

interface PrismaClientLike {
  $connect?: () => Promise<void>;
  $disconnect?: () => Promise<void>;
}

interface WorkerRepositories {
  processLogs: AiProcessLogRepository;
  results: AiResultRepository;
  disconnect?: () => Promise<void>;
}

export interface WorkerRuntime {
  runner: AiWorkerRunner;
  disconnect?: () => Promise<void>;
}

export async function createWorkerRuntime(queue: AiJobQueue, env: WorkerEnv): Promise<WorkerRuntime> {
  const repositories = await createRepositories(env);
  const handler = new MockAiTaskHandler(repositories.results);

  return {
    runner: new AiWorkerRunner(queue, repositories.processLogs, handler, {
      maxMessages: env.workerBatchSize,
      onFailure: createReportFailureHandler(repositories.results)
    }),
    disconnect: repositories.disconnect
  };
}

async function createRepositories(env: WorkerEnv): Promise<WorkerRepositories> {
  if (env.workerRepositoryMode === "memory") {
    const results = new InMemoryAiResultRepository();
    return {
      processLogs: new InMemoryAiProcessLogRepository(),
      results
    };
  }

  const prisma = await createPrismaClient(env.prismaClientModule);
  return {
    processLogs: new PrismaAiProcessLogRepository(prisma as ConstructorParameters<typeof PrismaAiProcessLogRepository>[0]),
    results: new PrismaAiResultRepository(prisma as ConstructorParameters<typeof PrismaAiResultRepository>[0]),
    disconnect: prisma.$disconnect ? () => prisma.$disconnect!() : undefined
  };
}

async function createPrismaClient(modulePath?: string): Promise<PrismaClientLike> {
  const requireFromWorker = createRequire(__filename);
  const resolvedModulePath =
    modulePath ?? path.resolve(__dirname, "..", "..", "api", "node_modules", "@prisma", "client");
  const prismaModule = requireFromWorker(resolvedModulePath) as {
    PrismaClient?: new () => PrismaClientLike;
  };

  if (!prismaModule.PrismaClient) {
    throw new Error(`PrismaClient was not found in ${resolvedModulePath}.`);
  }

  const prisma = new prismaModule.PrismaClient();
  await prisma.$connect?.();
  return prisma;
}
