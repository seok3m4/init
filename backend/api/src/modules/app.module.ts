import { Module } from "@nestjs/common";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health.controller";
import { ReportModule } from "./report/report.module";
import { PrismaService } from "../shared/prisma.service";

@Module({
  imports: [AuthModule, ReportModule, AiModule],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
