import { buildApplicantRowsFromCsvSource, chunkApplicantRows, inferApplicantCsvMapping, parseApplicantCsv, parseApplicantCsvSource } from "./csv-applicants";

const parsed = parseApplicantCsv(`이름,이메일,지원직무,연락처
"김,지원",KIM@example.com,Backend,"010-1111-1111"
박지원,park@example.com,Backend,
`);

if (parsed.rows.length !== 2 || parsed.failures.length !== 0) {
  throw new Error("Valid CSV rows should be parsed without failures.");
}

if (parsed.rows[0]?.rowNumber !== 2 || parsed.rows[0]?.name !== "김,지원" || parsed.rows[0]?.email !== "KIM@example.com") {
  throw new Error("CSV parser should support quoted comma and preserve source row numbers.");
}

const invalidHeader = parseApplicantCsv(`name,email
김지원,kim@example.com
`);

if (invalidHeader.rows.length !== 0 || invalidHeader.failures[0]?.reason !== "MISSING_HEADER") {
  throw new Error("CSV parser should fail when required headers are missing.");
}

const blankRows = parseApplicantCsv(`name,email,jobRole,phone

김지원,kim@example.com,Backend,
`);

if (blankRows.rows.length !== 1 || blankRows.rows[0]?.rowNumber !== 3) {
  throw new Error("CSV parser should skip blank lines and keep physical row numbers.");
}

const customSource = parseApplicantCsvSource(`성명,메일주소,지원분야,핸드폰
김지원,kim@example.com,Backend,010-1111-1111
`);
const customRows = buildApplicantRowsFromCsvSource(customSource, {
  name: "성명",
  email: "메일주소",
  jobRole: "지원분야",
  phone: "핸드폰",
});

if (customRows.rows[0]?.name !== "김지원" || customRows.rows[0]?.email !== "kim@example.com") {
  throw new Error("CSV parser should build applicant rows from manually mapped custom headers.");
}

const inferred = inferApplicantCsvMapping(["성명", "메일주소", "지원분야", "핸드폰"]);

if (inferred.name !== "성명" || inferred.email !== "메일주소" || inferred.jobRole !== "지원분야" || inferred.phone !== "핸드폰") {
  throw new Error("CSV parser should infer common enterprise header aliases.");
}

const sourceWithBlankHeader = parseApplicantCsvSource(`성명,,메일주소,지원분야
김지원,무시,kim@example.com,Backend
`);
const rowsWithBlankHeader = buildApplicantRowsFromCsvSource(sourceWithBlankHeader, {
  name: "성명",
  email: "메일주소",
  jobRole: "지원분야",
});

if (rowsWithBlankHeader.rows[0]?.email !== "kim@example.com") {
  throw new Error("CSV parser should preserve column indexes when a blank header exists.");
}

const largeCsv = `이름,이메일,지원직무
${Array.from({ length: 201 }, (_, index) => `지원자${index + 1},candidate${index + 1}@example.com,백엔드`).join("\n")}`;
const largeParsed = parseApplicantCsv(largeCsv);
const largeChunks = chunkApplicantRows(largeParsed.rows, 200);

if (largeParsed.failures.length !== 0 || largeParsed.rows.length !== 201) {
  throw new Error("CSV parser should parse more than 200 rows so the UI can process large uploads in chunks.");
}

if (largeChunks.length !== 2 || largeChunks[0]?.length !== 200 || largeChunks[1]?.length !== 1) {
  throw new Error("CSV rows should be chunked by the requested batch size.");
}
