import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CandidateController } from "./candidate.controller";
import { CANDIDATE_REPOSITORY, CandidateService, InMemoryCandidateRepository } from "./candidate.service";

@Module({
  imports: [AuthModule],
  controllers: [CandidateController],
  providers: [
    { provide: CANDIDATE_REPOSITORY, useClass: InMemoryCandidateRepository },
    CandidateService,
  ],
  exports: [CANDIDATE_REPOSITORY, CandidateService],
})
export class CandidateModule {}
