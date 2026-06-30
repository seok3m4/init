import { Module } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { CandidateController } from "./candidate.controller";
import { CANDIDATE_REPOSITORY, CandidateService, InMemoryCandidateRepository } from "./candidate.service";
import { PrismaCandidateRepository } from "./prisma-candidate.repository";

@Module({
  imports: [AuthModule],
  controllers: [CandidateController],
  providers: [
    PrismaService,
    {
      provide: CANDIDATE_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => {
      if (process.env.CANDIDATE_REPOSITORY_MODE === "memory" || process.env.DISABLE_PRISMA_CONNECT === "true") {
        return new InMemoryCandidateRepository({
          seedDemoApplication: process.env.CANDIDATE_DEMO_NO_AUTH === "true",
        });
      }
        return new PrismaCandidateRepository(prisma);
      },
    },
    CandidateService,
  ],
  exports: [CANDIDATE_REPOSITORY, CandidateService],
})
export class CandidateModule {}
