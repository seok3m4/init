import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BulkCreateApplicantRowDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rowNumber?: number;

  @ApiPropertyOptional({ example: "김지원" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: "candidate@example.com" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: "Backend Developer" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobRole?: string;

  @ApiPropertyOptional({ example: "010-0000-0000" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

export class BulkCreateApplicantsDto {
  @ApiProperty({ example: 101 })
  @IsInt()
  @Min(1)
  recruitmentId!: number;

  @ApiProperty({ type: [BulkCreateApplicantRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BulkCreateApplicantRowDto)
  applicants!: BulkCreateApplicantRowDto[];
}
