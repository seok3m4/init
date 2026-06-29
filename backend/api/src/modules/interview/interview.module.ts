import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CandidateModule } from "../candidate";
import { InterviewController } from "./interview.controller";
import { InterviewService } from "./interview.service";

@Module({
  imports: [AuthModule, CandidateModule],
  controllers: [InterviewController],
  providers: [InterviewService],
  exports: [InterviewService],
})
export class InterviewModule {}
