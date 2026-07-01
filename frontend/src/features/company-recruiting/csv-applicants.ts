import type { BulkCreateApplicantRowInput } from "./types";

export type ApplicantCsvField = "name" | "email" | "jobRole" | "phone";

export type ApplicantCsvColumnMapping = Partial<Record<ApplicantCsvField, string>>;

export type CsvApplicantParseFailure = {
  rowNumber: number;
  field?: string;
  reason: "EMPTY_FILE" | "MISSING_HEADER" | "TOO_MANY_ROWS";
  message: string;
};

export type ApplicantCsvDataRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedApplicantCsvSource = {
  headers: string[];
  dataRows: ApplicantCsvDataRow[];
  failures: CsvApplicantParseFailure[];
};

export type ParsedApplicantCsv = {
  rows: BulkCreateApplicantRowInput[];
  failures: CsvApplicantParseFailure[];
};

type CsvRecord = {
  rowNumber: number;
  cells: string[];
};

const headerAliases: Record<string, ApplicantCsvField> = {
  name: "name",
  fullname: "name",
  candidatename: "name",
  "이름": "name",
  "성명": "name",
  "지원자명": "name",
  "후보자명": "name",
  email: "email",
  mail: "email",
  emailaddress: "email",
  mailaddress: "email",
  email주소: "email",
  e메일: "email",
  "이메일": "email",
  "메일": "email",
  "메일주소": "email",
  "전자메일": "email",
  jobrole: "jobRole",
  role: "jobRole",
  position: "jobRole",
  job: "jobRole",
  "지원직무": "jobRole",
  "직무": "jobRole",
  "지원분야": "jobRole",
  "지원포지션": "jobRole",
  "포지션": "jobRole",
  "채용분야": "jobRole",
  phone: "phone",
  phonenumber: "phone",
  mobile: "phone",
  mobilenumber: "phone",
  "연락처": "phone",
  "전화번호": "phone",
  "휴대폰": "phone",
  "휴대전화": "phone",
  "핸드폰": "phone",
  "휴대폰번호": "phone",
};

const requiredHeaders: ApplicantCsvField[] = ["name", "email", "jobRole"];

export function parseApplicantCsv(text: string): ParsedApplicantCsv {
  const source = parseApplicantCsvSource(text);
  return buildApplicantRowsFromCsvSource(source, inferApplicantCsvMapping(source.headers));
}

export function parseApplicantCsvSource(text: string): ParsedApplicantCsvSource {
  const records = parseCsvRecords(text).filter((record) => !isBlankRecord(record));
  const [headerRecord, ...dataRecords] = records;

  if (!headerRecord) {
    return {
      headers: [],
      dataRows: [],
      failures: [{ rowNumber: 1, reason: "EMPTY_FILE", message: "CSV에 등록할 행이 없습니다." }],
    };
  }

  const rawHeaders = headerRecord.cells.map((cell) => cell.trim());
  const headers = rawHeaders.filter((cell) => cell !== "");
  if (dataRecords.length > 200) {
    return {
      headers,
      dataRows: [],
      failures: [
        {
          rowNumber: dataRecords[200]?.rowNumber ?? headerRecord.rowNumber,
          reason: "TOO_MANY_ROWS",
          message: "CSV 업로드는 최대 200행까지 가능합니다.",
        },
      ],
    };
  }

  return {
    headers,
    dataRows: dataRecords.map((record) => ({
      rowNumber: record.rowNumber,
      values: Object.fromEntries(
        rawHeaders
          .map((header, index) => [header, (record.cells[index] ?? "").trim()] as const)
          .filter(([header]) => header !== ""),
      ),
    })),
    failures: [],
  };
}

export function inferApplicantCsvMapping(headers: string[]): ApplicantCsvColumnMapping {
  return headers.reduce<ApplicantCsvColumnMapping>((mapping, header) => {
    const key = headerAliases[normalizeHeader(header)];
    if (key && mapping[key] === undefined) {
      mapping[key] = header;
    }
    return mapping;
  }, {});
}

export function buildApplicantRowsFromCsvSource(
  source: ParsedApplicantCsvSource,
  mapping: ApplicantCsvColumnMapping,
): ParsedApplicantCsv {
  if (source.failures.length > 0) {
    return { rows: [], failures: source.failures };
  }

  const missingHeader = requiredHeaders.find((header) => mapping[header] === undefined);
  if (missingHeader) {
    return {
      rows: [],
      failures: [
        {
          rowNumber: 1,
          field: missingHeader,
          reason: "MISSING_HEADER",
          message: "CSV 컬럼에서 이름, 이메일, 지원직무를 매핑해주세요.",
        },
      ],
    };
  }

  return {
    rows: source.dataRows.map((row) => ({
      rowNumber: row.rowNumber,
      name: readMappedValue(row.values, mapping.name),
      email: readMappedValue(row.values, mapping.email),
      jobRole: readMappedValue(row.values, mapping.jobRole),
      phone: readMappedValue(row.values, mapping.phone) || undefined,
    })),
    failures: [],
  };
}

function parseCsvRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let rowNumber = 1;
  let current = "";
  let cells: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      cells.push(current);
      records.push({ rowNumber, cells });
      current = "";
      cells = [];
      rowNumber += 1;
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      continue;
    }

    current += char;
  }

  if (current !== "" || cells.length > 0) {
    cells.push(current);
    records.push({ rowNumber, cells });
  }

  return records;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_-]/g, "");
}

function readMappedValue(values: Record<string, string>, header: string | undefined) {
  return header ? (values[header] ?? "").trim() : "";
}

function isBlankRecord(record: CsvRecord) {
  return record.cells.every((cell) => cell.trim() === "");
}
