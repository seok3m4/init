import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private readonly transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: (process.env.SMTP_SECURE ?? "false") === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  async sendVerificationCode(email: string, code: string, purpose: string) {
    const subject = purpose === "PASSWORD_RESET" ? "INIT 비밀번호 재설정 인증 코드" : "INIT 이메일 인증 코드";
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? "no-reply@init.local",
      to: email,
      subject,
      text: `인증 코드는 ${code} 입니다. 5분 안에 입력해 주세요.`,
    });
  }
}
