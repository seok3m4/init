import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ApiMetaDto {
  @ApiProperty({ example: "4df0d9de-86d1-4d16-a89b-56db6abf4af5" })
  traceId!: string;

  @ApiProperty({ example: "2026-06-29T00:00:00.000Z" })
  timestamp!: string;
}

export class PageMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 37 })
  totalItems!: number;

  @ApiProperty({ example: 2 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNext!: boolean;
}

export class ApiListMetaDto extends ApiMetaDto {
  @ApiProperty({ type: PageMetaDto })
  page!: PageMetaDto;
}

export class ApiSuccessEnvelopeDto<TData = unknown> {
  @ApiProperty({ description: "API별 실제 응답 데이터" })
  data!: TData;

  @ApiProperty({ type: ApiMetaDto })
  meta!: ApiMetaDto;
}

export class ApiListDataDto<TItem = unknown> {
  @ApiProperty({ description: "목록 아이템" })
  items!: TItem[];
}

export class ApiListEnvelopeDto<TItem = unknown> {
  @ApiProperty({ type: ApiListDataDto })
  data!: ApiListDataDto<TItem>;

  @ApiProperty({ type: ApiListMetaDto })
  meta!: ApiListMetaDto;
}

export class ApiErrorBodyDto {
  @ApiProperty({ example: "COMMON_VALIDATION_FAILED" })
  code!: string;

  @ApiProperty({ example: "입력값을 확인해주세요." })
  message!: string;

  @ApiProperty({ type: [Object], example: [{ field: "email", reason: "INVALID_FORMAT" }] })
  details!: Array<Record<string, unknown>>;
}

export class ApiErrorEnvelopeDto {
  @ApiProperty({ type: ApiErrorBodyDto })
  error!: ApiErrorBodyDto;

  @ApiProperty({ type: ApiMetaDto })
  meta!: ApiMetaDto;
}

export class CurrentUserResponseDto {
  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ enum: ["ADMIN", "COMPANY", "CANDIDATE"], example: "COMPANY" })
  userType!: "ADMIN" | "COMPANY" | "CANDIDATE";

  @ApiPropertyOptional({ nullable: true, example: 1 })
  companyId?: number | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  candidateId?: number | null;

  @ApiPropertyOptional({ example: "dev-company@example.com" })
  email?: string;

  @ApiPropertyOptional({ example: "DEV_COMPANY_USER" })
  name?: string;
}
