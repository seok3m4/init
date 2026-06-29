import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsInt, IsNotEmpty, IsString, MaxLength, Min } from "class-validator";

export class InviteApplicantDto {
  @ApiProperty({ example: 77 })
  @IsInt()
  @Min(1)
  applicantId!: number;

  @ApiProperty({ example: "2026-06-30T00:00:00.000Z" })
  @IsDateString()
  availableFrom!: string;

  @ApiProperty({ example: "2026-07-02T00:00:00.000Z" })
  @IsDateString()
  availableUntil!: string;

  @ApiProperty({ example: "안내된 기간 안에 AI 면접을 완료해 주세요." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;
}
