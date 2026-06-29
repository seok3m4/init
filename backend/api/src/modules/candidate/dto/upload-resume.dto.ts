import { IsIn, IsInt, IsString, Min } from "class-validator";

export class UploadResumeDto {
  @IsString()
  storageKey!: string;

  @IsString()
  originalName!: string;

  @IsIn(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"])
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
