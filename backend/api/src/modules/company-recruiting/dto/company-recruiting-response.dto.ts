import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RecruitmentResponseDto {
  @ApiProperty({ example: 101 })
  recruitmentId!: number;

  @ApiProperty({ example: 101 })
  postingId!: number;

  @ApiProperty({ example: 1 })
  companyId!: number;

  @ApiProperty({ example: "2026 신입 백엔드 채용" })
  title!: string;

  @ApiProperty({ example: "Backend Developer" })
  jobRole!: string;

  @ApiPropertyOptional({ nullable: true, example: "NestJS와 PostgreSQL 기반 API 개발" })
  jobDescription!: string | null;

  @ApiPropertyOptional({ nullable: true, example: "경력 3년 이상" })
  careerRequirement!: string | null;

  @ApiPropertyOptional({ nullable: true, example: "대졸 이상" })
  educationRequirement!: string | null;

  @ApiPropertyOptional({ nullable: true, example: "연봉 4,000만원 이상" })
  salaryInfo!: string | null;

  @ApiPropertyOptional({ nullable: true, example: "판교" })
  workLocation!: string | null;

  @ApiPropertyOptional({ nullable: true, example: "정규직" })
  employmentType!: string | null;

  @ApiPropertyOptional({ nullable: true, example: "2026-06-29" })
  startsOn!: string | null;

  @ApiPropertyOptional({ nullable: true, example: "2026-07-15" })
  endsOn!: string | null;

  @ApiProperty({ enum: ["DRAFT", "OPEN", "CLOSING_SOON", "CLOSED", "ARCHIVED"], example: "OPEN" })
  status!: string;

  @ApiProperty({ example: 3 })
  applicantCount!: number;

  @ApiProperty({ example: "2026-06-29T00:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-06-29T00:00:00.000Z" })
  updatedAt!: string;
}

export class JdImageUploadResponseDto {
  @ApiProperty({ example: 123 })
  fileId!: number;

  @ApiProperty({ example: 1 })
  ownerUserId!: number;

  @ApiProperty({ example: "company/1/jd-images/uuid-culture.webp" })
  storageKey!: string;

  @ApiProperty({ example: "culture.webp" })
  originalName!: string;

  @ApiProperty({ enum: ["image/png", "image/jpeg", "image/webp"], example: "image/webp" })
  mimeType!: string;

  @ApiProperty({ example: 245760 })
  sizeBytes!: number;

  @ApiProperty({ example: "ACTIVE" })
  status!: string;

  @ApiProperty({ example: "2026-07-02T00:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "https://cdn.example.com/company/1/jd-images/uuid-culture.webp" })
  url!: string;
}

export class InterviewSessionSummaryDto {
  @ApiProperty({ example: 10 })
  sessionId!: number;

  @ApiProperty({ enum: ["NOT_READY", "READY", "IN_PROGRESS", "COMPLETED", "FAILED"], example: "READY" })
  status!: string;

  @ApiProperty({ enum: ["MOCK", "RECRUITING"], example: "RECRUITING" })
  interviewType!: string;

  @ApiPropertyOptional({ nullable: true, example: "2026-06-30T09:00:00.000Z" })
  startedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  completedAt!: string | null;
}

export class ReportSummaryDto {
  @ApiProperty({ example: 501 })
  reportId!: number;

  @ApiProperty({ enum: ["PENDING", "GENERATING", "COMPLETED", "FAILED"], example: "COMPLETED" })
  status!: string;

  @ApiPropertyOptional({ nullable: true, example: 82 })
  totalScore!: number | null;

  @ApiPropertyOptional({ nullable: true, example: "지원 직무와 경험이 잘 맞습니다." })
  summary!: string | null;

  @ApiPropertyOptional({ nullable: true, example: "2026-06-30T08:00:00.000Z" })
  generatedAt!: string | null;
}

export class ApplicantResponseDto {
  @ApiProperty({ example: 77 })
  applicantId!: number;

  @ApiProperty({ example: 77 })
  applicationId!: number;

  @ApiProperty({ example: 101 })
  recruitmentId!: number;

  @ApiProperty({ example: 44 })
  candidateId!: number;

  @ApiProperty({ example: "김지원" })
  name!: string;

  @ApiProperty({ example: "candidate@example.com" })
  email!: string;

  @ApiPropertyOptional({ nullable: true, example: "010-0000-0000" })
  phone!: string | null;

  @ApiProperty({ example: "Backend Developer" })
  jobRole!: string;

  @ApiProperty({ example: "SUBMITTED" })
  applicationStatus!: string;

  @ApiProperty({ example: "NOT_SUBMITTED" })
  documentStatus!: string;

  @ApiProperty({ example: "NOT_READY" })
  interviewStatus!: string;

  @ApiProperty({ example: "PENDING" })
  reportStatus!: string;

  @ApiProperty({ enum: ["UNDECIDED", "PASS", "HOLD", "FAIL"], example: "UNDECIDED" })
  screeningDecision!: string;

  @ApiPropertyOptional({ nullable: true, example: "추가 확인 필요" })
  screeningMemo!: string | null;

  @ApiPropertyOptional({ type: InterviewSessionSummaryDto, nullable: true })
  interviewSession!: InterviewSessionSummaryDto | null;

  @ApiPropertyOptional({ type: ReportSummaryDto, nullable: true })
  report!: ReportSummaryDto | null;

  @ApiProperty({ example: "2026-06-29T00:00:00.000Z" })
  updatedAt!: string;
}

export class InvitationResponseDto {
  @ApiProperty({ example: "temp-invitation-77" })
  invitationId!: string;

  @ApiProperty({ example: 77 })
  applicantId!: number;

  @ApiProperty({ example: 77 })
  applicationId!: number;

  @ApiProperty({ example: 101 })
  recruitmentId!: number;

  @ApiProperty({ example: "candidate@example.com" })
  email!: string;

  @ApiProperty({ example: "2026-06-30T00:00:00.000Z" })
  availableFrom!: string;

  @ApiProperty({ example: "2026-07-02T00:00:00.000Z" })
  availableUntil!: string;

  @ApiProperty({ example: "REQUESTED" })
  deliveryStatus!: string;

  @ApiProperty({ example: true })
  temporary!: boolean;
}

export class BulkApplicantRegistrationSummaryDto {
  @ApiProperty({ example: 5 })
  totalRows!: number;

  @ApiProperty({ example: 3 })
  successCount!: number;

  @ApiProperty({ example: 2 })
  failedCount!: number;
}

export class BulkApplicantRegistrationSuccessDto {
  @ApiProperty({ example: 2 })
  rowNumber!: number;

  @ApiProperty({ type: ApplicantResponseDto })
  applicant!: ApplicantResponseDto;
}

export class BulkApplicantRegistrationFailureDto {
  @ApiProperty({ example: 4 })
  rowNumber!: number;

  @ApiPropertyOptional({ example: "candidate@example.com" })
  email?: string;

  @ApiPropertyOptional({ example: "email" })
  field?: string;

  @ApiProperty({
    enum: [
      "MISSING_REQUIRED_FIELD",
      "INVALID_NAME",
      "INVALID_EMAIL",
      "DUPLICATED_IN_CSV",
      "DUPLICATED_IN_RECRUITMENT",
      "ROW_CREATE_FAILED",
    ],
    example: "DUPLICATED_IN_RECRUITMENT",
  })
  reason!: string;

  @ApiProperty({ example: "같은 공고에 이미 등록된 이메일입니다." })
  message!: string;
}

export class BulkApplicantRegistrationResponseDto {
  @ApiProperty({ type: BulkApplicantRegistrationSummaryDto })
  summary!: BulkApplicantRegistrationSummaryDto;

  @ApiProperty({ type: [BulkApplicantRegistrationSuccessDto] })
  successes!: BulkApplicantRegistrationSuccessDto[];

  @ApiProperty({ type: [BulkApplicantRegistrationFailureDto] })
  failures!: BulkApplicantRegistrationFailureDto[];
}

export class ApplicantEvaluationResponseDto {
  @ApiProperty({ type: ApplicantResponseDto })
  applicant!: ApplicantResponseDto;

  @ApiProperty({ type: Object })
  recruitment!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  statuses!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  screening!: Record<string, unknown>;

  @ApiProperty({ enum: ["AVAILABLE", "NONE_OR_GENERATING"], example: "AVAILABLE" })
  reportAvailability!: string;

  @ApiPropertyOptional({ type: ReportSummaryDto, nullable: true })
  report!: ReportSummaryDto | null;
}
