import { Injectable } from "@nestjs/common";
import { GenerateReportRequest, GeneratedReport, ReportScore } from "./report.types";

@Injectable()
export class MockAiReportProvider {
  generate(input: GenerateReportRequest): GeneratedReport {
    const scores = input.criteria.map((criterion, index): ReportScore => {
      const answer = input.answers[index % input.answers.length];
      const evidenceText = this.pickEvidence(answer.transcript, input.documentText);
      const score = this.scoreFor(criterion.weight, evidenceText);

      return {
        criterionId: criterion.criterionId,
        criterionName: criterion.name,
        score,
        rationale: `${criterion.name} was evaluated from the candidate answer and document context.`,
        evidences: [
          {
            answerId: answer.answerId,
            text: evidenceText
          }
        ]
      };
    });

    const totalScore = Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length);

    return {
      summary: this.summary(input, totalScore),
      totalScore,
      scores
    };
  }

  private pickEvidence(transcript: string, documentText?: string): string {
    const source = transcript.trim() || documentText?.trim() || "";
    return source.length > 160 ? `${source.slice(0, 157)}...` : source;
  }

  private scoreFor(weight: number, evidenceText: string): number {
    const weightBonus = Math.min(10, Math.max(0, Math.round(weight / 10)));
    const evidenceBonus = Math.min(10, Math.floor(evidenceText.length / 30));
    return Math.min(95, 70 + weightBonus + evidenceBonus);
  }

  private summary(input: GenerateReportRequest, totalScore: number): string {
    const reportLabel =
      input.reportType === "RECRUITING_REPORT" ? "Recruiting report" : "Mock interview feedback";
    return `${reportLabel} generated from ${input.answers.length} answer(s), ${input.criteria.length} criterion item(s), and document context. Total score: ${totalScore}.`;
  }
}
