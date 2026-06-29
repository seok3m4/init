import { Module } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { MailService } from "./mail.service";
import { VerificationCodeStore } from "./verification-code.store";

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, MailService, PrismaService, VerificationCodeStore],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
