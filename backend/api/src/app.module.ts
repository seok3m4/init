import { Module } from "@nestjs/common";
import { CandidateModule } from "./modules/candidate";
import { InterviewModule } from "./modules/interview";

@Module({
  imports: [CandidateModule, InterviewModule],
})
export class AppModule {}
