import { Injectable } from "@nestjs/common";
import { GeneratedReport, GuardrailDecision, ReportType } from "./report.types";

const MOCK_REPORT_BANNED_TERMS = ["합격", "탈락", "채용 적합", "채용 부적합", "선별"];

@Injectable()
export class GuardrailService {
  validate(reportType: ReportType, report: GeneratedReport): GuardrailDecision {
    if (!report.summary.trim()) {
      return this.block("summary is required");
    }

    if (report.scores.length === 0) {
      return this.block("at least one score is required");
    }

    for (const score of report.scores) {
      if (!score.rationale.trim()) {
        return this.block(`rationale is required for criterion ${score.criterionId}`);
      }

      if (score.evidences.length === 0 || score.evidences.some((evidence) => !evidence.text.trim())) {
        return this.block(`evidence is required for criterion ${score.criterionId}`);
      }
    }

    if (reportType === "MOCK_INTERVIEW_REPORT") {
      const combinedText = [
        report.summary,
        ...report.scores.map((score) => score.rationale),
        ...report.scores.flatMap((score) => score.evidences.map((evidence) => evidence.text))
      ].join("\n");

      const bannedTerm = MOCK_REPORT_BANNED_TERMS.find((term) => combinedText.includes(term));
      if (bannedTerm) {
        return this.block(`mock interview feedback cannot include hiring decision expression: ${bannedTerm}`);
      }
    }

    return {
      result: "PASS",
      reason: null
    };
  }

  private block(reason: string): GuardrailDecision {
    return {
      result: "BLOCKED",
      reason
    };
  }
}
