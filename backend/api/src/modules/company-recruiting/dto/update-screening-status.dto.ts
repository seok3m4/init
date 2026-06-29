import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateScreeningStatusDto {
  @IsIn(["UNDECIDED", "PASS", "HOLD", "FAIL"])
  screeningDecision!: "UNDECIDED" | "PASS" | "HOLD" | "FAIL";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  screeningMemo?: string;
}
