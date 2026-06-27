import { Injectable } from "@nestjs/common";
import { GeneratedReport, GuardrailDecision, ReportScore, ReportType } from "./report.types";

const MOCK_REPORT_BANNED_TERMS = ["합격", "탈락", "채용 적합", "채용 부적합", "선별"];

@Injectable()
export class GuardrailService {
  validateReport(reportType: ReportType, report: GeneratedReport): GuardrailDecision {
    if (!report.summary.trim()) {
      return this.block("summary is required");
    }

    return this.validateScores(reportType, report.scores, report.summary);
  }

  validateScores(reportType: ReportType, scores: ReportScore[], summary = ""): GuardrailDecision {
    if (scores.length === 0) {
      return this.block("at least one score is required");
    }

    for (const score of scores) {
      if (!score.rationale.trim()) {
        return this.block(`rationale is required for criterion ${score.criterionId}`);
      }

      if (score.evidences.length === 0 || score.evidences.some((evidence) => !evidence.text.trim())) {
        return this.block(`evidence is required for criterion ${score.criterionId}`);
      }

      for (const evidence of score.evidences) {
        if (!["INTERVIEW_ANSWER", "APPLICATION_DOCUMENT"].includes(evidence.sourceType)) {
          return this.block(`evidence source type is required for criterion ${score.criterionId}`);
        }
        if (evidence.sourceType === "INTERVIEW_ANSWER" && !evidence.answerId) {
          return this.block(`answer evidence source is required for criterion ${score.criterionId}`);
        }
        if (
          evidence.sourceType === "APPLICATION_DOCUMENT" &&
          !evidence.documentId &&
          !evidence.documentRef?.trim()
        ) {
          return this.block(`document evidence source is required for criterion ${score.criterionId}`);
        }
      }
    }

    if (reportType === "MOCK_INTERVIEW_REPORT") {
      const combinedText = [
        summary,
        ...scores.map((score) => score.rationale),
        ...scores.flatMap((score) => score.evidences.map((evidence) => evidence.text))
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
