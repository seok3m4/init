import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateApplicantDto {
  @ApiProperty({ example: 101 })
  @IsInt()
  @Min(1)
  recruitmentId!: number;

  @ApiProperty({ example: "김지원" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "candidate@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: "Backend Developer" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  jobRole!: string;

  @ApiPropertyOptional({ example: "010-0000-0000" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
