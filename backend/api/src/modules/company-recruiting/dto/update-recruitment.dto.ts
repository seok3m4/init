import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

import type { PostingStatusValue } from "../company-recruiting.types";

export class UpdateRecruitmentDto {
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

  @ApiPropertyOptional({ example: "경력무관" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  careerRequirement?: string;

  @ApiPropertyOptional({ example: "학력무관" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  educationRequirement?: string;

  @ApiPropertyOptional({ example: "회사 내규에 따름" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  salaryInfo?: string;

  @ApiPropertyOptional({ example: "서울" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  workLocation?: string;

  @ApiPropertyOptional({ example: "계약직" })
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
