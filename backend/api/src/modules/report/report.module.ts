import { Module } from "@nestjs/common";
import { CandidateModule } from "../candidate";
import { InterviewModule } from "../interview";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";

@Module({
  imports: [CandidateModule, InterviewModule],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
