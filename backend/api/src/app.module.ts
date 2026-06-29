import { Module } from "@nestjs/common";
import { CandidateModule } from "./modules/candidate";

@Module({
  imports: [CandidateModule],
})
export class AppModule {}
