import { Module } from "@nestjs/common";
import { CandidateModule } from "../candidate";
import { InterviewController } from "./interview.controller";
import { InterviewService } from "./interview.service";

@Module({
  imports: [CandidateModule],
  controllers: [InterviewController],
  providers: [InterviewService],
  exports: [InterviewService],
})
export class InterviewModule {}
