import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class ListQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: "backend" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: "backend", description: "q의 alias" })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ enum: ["DRAFT", "OPEN", "CLOSING_SOON", "CLOSED", "ARCHIVED"] })
  @IsOptional()
  @IsIn(["DRAFT", "OPEN", "CLOSING_SOON", "CLOSED", "ARCHIVED"])
  status?: string;

  @ApiPropertyOptional({ example: "createdAt" })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";
}
