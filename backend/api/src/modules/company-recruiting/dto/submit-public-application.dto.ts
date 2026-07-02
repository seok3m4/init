import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class SubmitPublicApplicationDto {
  @ApiProperty({ example: "김지원" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "candidate@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({ example: "010-0000-0000" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: "https://github.com/candidate" })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  portfolioUrl?: string;

  @ApiPropertyOptional({ example: "지원 직무와 관련된 프로젝트 경험을 입력합니다." })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  resumeText?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  consentAgreed!: boolean;
}
