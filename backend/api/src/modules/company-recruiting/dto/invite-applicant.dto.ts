import { IsDateString, IsInt, IsNotEmpty, IsString, MaxLength, Min } from "class-validator";

export class InviteApplicantDto {
  @IsInt()
  @Min(1)
  applicantId!: number;

  @IsDateString()
  availableFrom!: string;

  @IsDateString()
  availableUntil!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;
}
