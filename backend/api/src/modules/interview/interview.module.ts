import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CandidateModule } from "../candidate";
import { InterviewController } from "./controller/interview.controller";
import { InterviewService } from "./service/interview.service";

@Module({
  imports: [AuthModule, CandidateModule],
  controllers: [InterviewController],
  providers: [InterviewService],
  exports: [InterviewService],
})
export class InterviewModule {}
