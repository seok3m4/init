import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CandidateModule } from "../candidate";
import { InterviewController } from "./controller/interview.controller";
import { InMemoryInterviewRepository } from "./repository/in-memory-interview.repository";
import { INTERVIEW_REPOSITORY } from "./repository/interview.repository";
import { InterviewService } from "./service/interview.service";

@Module({
  imports: [AuthModule, CandidateModule],
  controllers: [InterviewController],
  providers: [
    {
      provide: INTERVIEW_REPOSITORY,
      useClass: InMemoryInterviewRepository,
    },
    InterviewService,
  ],
  exports: [INTERVIEW_REPOSITORY, InterviewService],
})
export class InterviewModule {}
