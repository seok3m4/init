import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateApplicantDto {
  @IsInt()
  @Min(1)
  recruitmentId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  jobRole!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
