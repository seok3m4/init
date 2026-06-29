import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { HttpErrorEnvelopeFilter } from "./common/response/http-error-envelope.filter";
import { AiModule } from "./modules/ai/ai.module";
import { ReportModule } from "./modules/report/report.module";

@Module({
  imports: [ReportModule, AiModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpErrorEnvelopeFilter
    }
  ]
})
export class AppModule {}
