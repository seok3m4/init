import { Module } from "@nestjs/common";
import { CandidateModule } from "./modules/candidate";
import { InterviewModule } from "./modules/interview";
import { ReportModule } from "./modules/report";

@Module({
  imports: [CandidateModule, InterviewModule, ReportModule],
})
export class AppModule {}
