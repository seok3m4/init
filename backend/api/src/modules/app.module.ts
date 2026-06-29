import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { CompanyRecruitingModule } from "./company-recruiting/company-recruiting.module";
import { HealthController } from "./health.controller";
import { PrismaService } from "../shared/prisma.service";

@Module({
  imports: [AuthModule, CompanyRecruitingModule],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
