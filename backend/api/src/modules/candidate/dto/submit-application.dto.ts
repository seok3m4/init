import { IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUrl, Min } from "class-validator";
import type { ConsentType } from "../candidate.types";

export class SubmitApplicationDto {
  @IsString()
  candidateName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  phone!: string;

  @IsInt()
  @Min(1)
  resumeFileId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  portfolioFileId?: number;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  portfolioUrl?: string;

  @IsOptional()
  @IsString()
  coverLetter?: string;

  @IsArray()
  @IsIn(["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS", "AI_INTERVIEW_RECORDING"], { each: true })
  consentTypes!: ConsentType[];
}
