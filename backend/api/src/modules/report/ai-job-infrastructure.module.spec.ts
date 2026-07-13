import { PrismaService } from "../../shared/prisma.service";
import { AiJobInfrastructureModule, createRuntimeReportRepository } from "./ai-job-infrastructure.module";
import { InMemoryReportRepository } from "./repository/in-memory-report.repository";
import { PrismaReportRepository } from "./repository/prisma-report.repository";

describe("AiJobInfrastructureModule", () => {
  it("exposes a module shared by interview and report flows", () => {
    expect(AiJobInfrastructureModule).toBeDefined();
  });

  it("selects Prisma after runtime environment loading", () => {
    const prisma = {} as PrismaService;
    const inMemory = new InMemoryReportRepository();

    expect(createRuntimeReportRepository(prisma, inMemory, {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://local",
    })).toBeInstanceOf(PrismaReportRepository);
  });

  it("keeps one injected in-memory repository for test and no-database runs", () => {
    const prisma = {} as PrismaService;
    const inMemory = new InMemoryReportRepository();

    expect(createRuntimeReportRepository(prisma, inMemory, { NODE_ENV: "test" })).toBe(inMemory);
    expect(createRuntimeReportRepository(prisma, inMemory, {})).toBe(inMemory);
  });
});
