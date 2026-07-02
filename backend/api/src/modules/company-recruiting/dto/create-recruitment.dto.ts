import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

import type { PostingStatusValue } from "../company-recruiting.types";

export class CreateRecruitmentDto {
  @ApiProperty({ example: "2026 신입 백엔드 채용" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: "Backend Developer" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  jobRole!: string;

  @ApiPropertyOptional({ example: "NestJS와 PostgreSQL 기반 API 개발" })
  @IsOptional()
  @IsString()
  jobDescription?: string;

  @ApiPropertyOptional({ example: "경력 3년 이상" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  careerRequirement?: string;

  @ApiPropertyOptional({ example: "대졸 이상" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  educationRequirement?: string;

  @ApiPropertyOptional({ example: "연봉 4,000만원 이상" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  salaryInfo?: string;

  @ApiPropertyOptional({ example: "판교" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  workLocation?: string;

  @ApiPropertyOptional({ example: "정규직" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  employmentType?: string;

  @ApiPropertyOptional({ example: "2026-06-29" })
  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @ApiPropertyOptional({ example: "2026-07-15" })
  @IsOptional()
  @IsDateString()
  endsOn?: string;

  @ApiPropertyOptional({ enum: ["DRAFT", "OPEN"], example: "OPEN" })
  @IsOptional()
  @IsIn(["DRAFT", "OPEN"])
  status?: PostingStatusValue;
}
