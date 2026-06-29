import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { isUserType, type CurrentUser } from "@init/common";
import { ApiException } from "../../shared/api-exception";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any, @Res({ passthrough: true }) response: Response) {
    const userType = this.parseUserType(body.userType);
    const result = await this.auth.login({ email: body.email, password: body.password, userType });
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Get("google")
  google(@Query("userType") userType: string) {
    return this.auth.googleLoginStart(this.parseUserType(userType));
  }

  @Get("google/callback")
  async googleCallback(@Query("code") code: string, @Query("state") state: string, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.googleCallback(code, state);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post("signup/candidate")
  signupCandidate(@Body() body: any) {
    return this.auth.signupCandidate(body);
  }

  @Post("signup/company")
  signupCompany(@Body() body: any) {
    return this.auth.signupCompany(body);
  }

  @Post("email/send-code")
  @HttpCode(HttpStatus.OK)
  sendEmailCode(@Body() body: any) {
    return this.auth.sendEmailCode(body.email);
  }

  @Post("email/verify-code")
  @HttpCode(HttpStatus.OK)
  verifyEmailCode(@Body() body: any) {
    return this.auth.verifyEmailCode(body.email, body.code);
  }

  @Post("password/send-code")
  @HttpCode(HttpStatus.OK)
  sendPasswordCode(@Body() body: any) {
    return this.auth.sendPasswordCode(body.email);
  }

  @Post("password/verify-code")
  @HttpCode(HttpStatus.OK)
  verifyPasswordCode(@Body() body: any) {
    return this.auth.verifyPasswordCode(body.email, body.code);
  }

  @Post("password/reset")
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() body: any) {
    return this.auth.resetPassword({
      email: body.email,
      code: body.code,
      password: body.password ?? body.newPassword,
      passwordConfirm: body.passwordConfirm ?? body.newPasswordConfirm,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() request: Request & { currentUser: CurrentUser }) {
    return this.auth.me(request.currentUser);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const cookieName = process.env.AUTH_REFRESH_COOKIE_NAME ?? "refreshToken";
    const result = await this.auth.refresh(request.cookies?.[cookieName]);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(process.env.AUTH_REFRESH_COOKIE_NAME ?? "refreshToken", { path: "/" });
    return { loggedOut: true };
  }

  private parseUserType(input: unknown) {
    if (!isUserType(input)) {
      throw new ApiException("COMMON_VALIDATION_FAILED", "사용자 유형을 확인해 주세요.", 400);
    }
    return input;
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(process.env.AUTH_REFRESH_COOKIE_NAME ?? "refreshToken", refreshToken, {
      httpOnly: true,
      secure: (process.env.AUTH_COOKIE_SECURE ?? "false") === "true",
      sameSite: (process.env.AUTH_COOKIE_SAME_SITE ?? "lax") as "lax" | "strict" | "none",
      path: "/",
    });
  }
}
