import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FailureReasonDto {
  @ApiProperty({ enum: ["RETRYABLE", "NON_RETRYABLE"], example: "RETRYABLE" })
  category!: string;

  @ApiProperty({ example: "AI queue publish failed: SQS unavailable" })
  reason!: string;

  @ApiProperty({ example: true })
  retryable!: boolean;
}

export class EvaluationReportSnapshotDto {
  @ApiProperty({ example: 1 })
  reportId!: number;

  @ApiProperty({ enum: ["MOCK_INTERVIEW_REPORT", "RECRUITING_REPORT"], example: "RECRUITING_REPORT" })
  reportType!: string;

  @ApiProperty({ enum: ["PENDING", "GENERATING", "COMPLETED", "FAILED"], example: "GENERATING" })
  status!: string;

  @ApiPropertyOptional({ example: "지원 직무와 경험이 잘 맞습니다." })
  summary?: string;

  @ApiPropertyOptional({ example: 82 })
  totalScore?: number;

  @ApiPropertyOptional({ type: FailureReasonDto })
  failure?: FailureReasonDto;
}

export class AiJobResponseDto {
  @ApiProperty({ example: 1 })
  processLogId!: number;

  @ApiProperty({ example: "REPORT_GENERATE" })
  processType!: string;

  @ApiProperty({ enum: ["PENDING", "RUNNING", "COMPLETED", "FAILED"], example: "PENDING" })
  status!: string;

  @ApiProperty({ example: true })
  queued!: boolean;

  @ApiProperty({ example: "{\"kind\":\"REPORT_PIPELINE_STEP\"}" })
  inputRef!: string;

  @ApiPropertyOptional({ example: "{\"items\":[\"Question 1\"]}" })
  outputRef?: string;

  @ApiPropertyOptional({ type: Object })
  output?: unknown;

  @ApiPropertyOptional({ example: 3 })
  applicationId?: number;

  @ApiPropertyOptional({ example: 7 })
  sessionId?: number;

  @ApiPropertyOptional({ type: FailureReasonDto })
  failure?: FailureReasonDto;

  @ApiPropertyOptional({ type: EvaluationReportSnapshotDto })
  report?: EvaluationReportSnapshotDto;
}

export class GenerateReportResponseDto extends AiJobResponseDto {
  @ApiProperty({ type: EvaluationReportSnapshotDto })
  declare report: EvaluationReportSnapshotDto;
}
