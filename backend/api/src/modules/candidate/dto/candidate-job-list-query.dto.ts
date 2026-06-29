import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { PostingStatus, SortOrder } from "../candidate.types";

export class CandidateJobListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  jobRole?: string;

  @IsOptional()
  @IsString()
  jobGroup?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  careerLevel?: string;

  @IsOptional()
  @IsIn(["OPEN", "CLOSING_SOON"])
  postingStatus?: PostingStatus;

  @IsOptional()
  @IsIn(["createdAt", "endsOn", "title"])
  sort: "createdAt" | "endsOn" | "title" = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  order: SortOrder = "desc";
}
