import { Injectable } from "@nestjs/common";
import {
  AnswerEvaluationRequest,
  CommunicationAnalysis,
  CommunicationAnalysisRequest,
  EvaluationContext,
  EvaluationContextRequest,
  GenerateReportRequest,
  GeneratedReport,
  ReportScore
} from "../report.types";

@Injectable()
export class MockAiReportProvider {
  buildEvaluationContext(input: EvaluationContextRequest): EvaluationContext {
    return {
      reportType: input.reportType,
      companyId: input.company.companyId,
      postingId: input.posting.postingId,
      applicationId: input.application.applicationId,
      candidateId: input.application.candidateId,
      jobDescription: input.posting.jobDescription,
      criteria: input.criteria,
      answers: input.answers,
      documentText: input.application.documentText,
      manualEvaluations: input.manualEvaluations ?? []
    };
  }

  evaluateAnswers(input: AnswerEvaluationRequest): ReportScore[] {
    return this.scoreAnswers(input.criteria, input.answers, input.documentText);
  }

  analyzeCommunication(input: CommunicationAnalysisRequest): CommunicationAnalysis {
    return {
      usage: "AUXILIARY_ONLY",
      mediaQuality: input.mediaQuality,
      metrics: input.metrics ?? {},
      notes: [
        "Communication metrics are auxiliary only and must not be used as a decisive hiring signal.",
        ...(input.notes ?? [])
      ],
      decisionWeight: 0
    };
  }

  generate(input: GenerateReportRequest): GeneratedReport {
    const scores = this.scoreAnswers(input.criteria, input.answers, input.documentText);
    const totalScore = Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length);

    return {
      summary: this.summary(input, totalScore),
      totalScore,
      scores
    };
  }

  private scoreAnswers(
    criteria: AnswerEvaluationRequest["criteria"],
    answers: AnswerEvaluationRequest["answers"],
    documentText?: string
  ): ReportScore[] {
    return criteria.map((criterion, index): ReportScore => {
      const answer = answers[index % answers.length];
      const evidenceText = this.pickEvidence(answer.transcript, documentText);
      const score = this.scoreFor(criterion.weight, evidenceText);

      return {
        criterionId: criterion.criterionId,
        criterionName: criterion.name,
        score,
        rationale: `${criterion.name} was evaluated from the candidate answer and document context.`,
        evidences: this.buildEvidences(answer.answerId, answer.transcript, documentText)
      };
    });
  }

  private buildEvidences(answerId: number, transcript: string, documentText?: string): ReportScore["evidences"] {
    const evidences: ReportScore["evidences"] = [
      {
        sourceType: "INTERVIEW_ANSWER",
        answerId,
        text: this.pickEvidence(transcript)
      }
    ];

    if (documentText?.trim()) {
      evidences.push({
        sourceType: "APPLICATION_DOCUMENT",
        documentRef: "application.documentText",
        text: this.pickEvidence(documentText)
      });
    }

    return evidences;
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
