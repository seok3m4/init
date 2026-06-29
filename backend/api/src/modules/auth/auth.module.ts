import { Module } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { AuthController } from "./controller/auth.controller";
import { AuthRepository } from "./repository/auth.repository";
import { AuthService } from "./service/auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { MailService } from "./service/mail.service";
import { VerificationCodeStore } from "./verification-code.store";

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtAuthGuard, MailService, PrismaService, VerificationCodeStore],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
