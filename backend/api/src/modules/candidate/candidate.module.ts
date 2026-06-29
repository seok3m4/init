import { Module } from "@nestjs/common";
import { CandidateController } from "./candidate.controller";
import { CANDIDATE_REPOSITORY, CandidateService, InMemoryCandidateRepository } from "./candidate.service";

@Module({
  controllers: [CandidateController],
  providers: [
    { provide: CANDIDATE_REPOSITORY, useClass: InMemoryCandidateRepository },
    CandidateService,
  ],
  exports: [CANDIDATE_REPOSITORY, CandidateService],
})
export class CandidateModule {}
