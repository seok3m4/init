import { Module } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { CandidateModule } from "../candidate";
import { InterviewController } from "./controller/interview.controller";
import { InMemoryInterviewRepository } from "./repository/in-memory-interview.repository";
import { INTERVIEW_REPOSITORY } from "./repository/interview.repository";
import { PrismaInterviewRepository } from "./repository/prisma-interview.repository";
import { InterviewService } from "./service/interview.service";

@Module({
  imports: [AuthModule, CandidateModule],
  controllers: [InterviewController],
  providers: [
    PrismaService,
    {
      provide: INTERVIEW_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => {
        if (process.env.INTERVIEW_REPOSITORY_MODE === "memory" || process.env.DISABLE_PRISMA_CONNECT === "true") {
          return new InMemoryInterviewRepository();
        }
        return new PrismaInterviewRepository(prisma);
      },
    },
    InterviewService,
  ],
  exports: [INTERVIEW_REPOSITORY, InterviewService],
})
export class InterviewModule {}
