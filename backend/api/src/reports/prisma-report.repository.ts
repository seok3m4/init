import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { ReportRepository } from "./report.repository";
import {
  CommunicationAnalysis,
  EvaluationContext,
  EvaluationReportSnapshot,
  FailureReason,
  GuardrailDecision,
  ProcessLogSnapshot,
  ReportPipelineStep,
  ReportScore,
  ReportType,
  StoredCounts
} from "./report.types";

@Injectable()
export class PrismaReportRepository implements ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async startProcess(reportId: number, reportType: ReportType, step: ReportPipelineStep): Promise<ProcessLogSnapshot> {
    await this.ensureReport(reportId, reportType);
    const processLogId = this.nextId();
    await this.prisma.aiProcessLog.create({
      data: {
        processLogId,
        processType: "REPORT_GENERATE",
        status: "PENDING",
        inputRef: JSON.stringify({ reportId, reportType, step }),
        createdAt: new Date()
      }
    });
    return this.processSnapshot(processLogId, step, "PENDING");
  }

  async markProcessRunning(processLogId: number): Promise<ProcessLogSnapshot> {
    const processLog = await this.prisma.aiProcessLog.update({
      where: { processLogId: BigInt(processLogId) },
      data: { status: "RUNNING" }
    });
    return this.toProcessSnapshot(processLog);
  }

  async markProcessCompleted(processLogId: number): Promise<ProcessLogSnapshot> {
    const processLog = await this.prisma.aiProcessLog.update({
      where: { processLogId: BigInt(processLogId) },
      data: { status: "COMPLETED" }
    });
    return this.toProcessSnapshot(processLog);
  }

  async markProcessFailed(processLogId: number, failure: FailureReason): Promise<ProcessLogSnapshot> {
    const processLog = await this.prisma.aiProcessLog.update({
      where: { processLogId: BigInt(processLogId) },
      data: {
        status: "FAILED",
        failureCategory: failure.category,
        failureReason: failure.reason
      }
    });
    return this.toProcessSnapshot(processLog);
  }

  async markReportGenerating(reportId: number, reportType: ReportType): Promise<EvaluationReportSnapshot> {
    const report = await this.prisma.evaluationReport.upsert({
      where: { reportId: BigInt(reportId) },
      create: {
        reportId: BigInt(reportId),
        reportType,
        status: "GENERATING"
      },
      update: {
        reportType,
        status: "GENERATING",
        failureCategory: null,
        failureReason: null
      }
    });
    return this.toReportSnapshot(report);
  }

  async markReportCompleted(reportId: number, summary: string, totalScore: number): Promise<EvaluationReportSnapshot> {
    const report = await this.prisma.evaluationReport.update({
      where: { reportId: BigInt(reportId) },
      data: {
        status: "COMPLETED",
        summary,
        totalScore,
        generatedAt: new Date(),
        failureCategory: null,
        failureReason: null
      }
    });
    return this.toReportSnapshot(report);
  }

  async markReportFailed(reportId: number, failure: FailureReason): Promise<EvaluationReportSnapshot> {
    const report = await this.prisma.evaluationReport.update({
      where: { reportId: BigInt(reportId) },
      data: {
        status: "FAILED",
        failureCategory: failure.category,
        failureReason: failure.reason
      }
    });
    return this.toReportSnapshot(report);
  }

  async saveContext(reportId: number, context: EvaluationContext): Promise<void> {
    await this.appendOutputRef(reportId, { evaluationContext: context });
  }

  async saveCommunicationAnalysis(reportId: number, communicationAnalysis: CommunicationAnalysis): Promise<void> {
    await this.appendOutputRef(reportId, { communicationAnalysis });
  }

  async saveScoresAndEvidences(reportId: number, scores: ReportScore[]): Promise<StoredCounts> {
    await this.prisma.reportScore.deleteMany({
      where: { reportId: BigInt(reportId) }
    });

    for (const score of scores) {
      const scoreId = this.nextId();
      await this.prisma.reportScore.create({
        data: {
          scoreId,
          reportId: BigInt(reportId),
          criterionId: score.criterionId ? BigInt(score.criterionId) : null,
          score: score.score,
          rationale: score.rationale,
          evidences: {
            create: score.evidences.map((evidence) => ({
              evidenceId: this.nextId(),
              sourceType: evidence.sourceType,
              answerId: evidence.answerId ? BigInt(evidence.answerId) : null,
              documentId: evidence.documentId ? BigInt(evidence.documentId) : null,
              documentRef: evidence.documentRef ?? null,
              evidenceText: evidence.text
            }))
          }
        }
      });
    }

    return this.countStored(reportId);
  }

  async saveGuardrailLog(processLogId: number, policyName: string, decision: GuardrailDecision): Promise<number> {
    const guardrailLogId = this.nextId();
    await this.prisma.aiGuardrailLog.create({
      data: {
        guardrailLogId,
        processLogId: BigInt(processLogId),
        policyName,
        result: decision.result,
        reason: decision.reason,
        createdAt: new Date()
      }
    });
    return Number(guardrailLogId);
  }

  async getReport(reportId: number): Promise<EvaluationReportSnapshot> {
    const report = await this.prisma.evaluationReport.findUniqueOrThrow({
      where: { reportId: BigInt(reportId) }
    });
    return this.toReportSnapshot(report);
  }

  async countStored(reportId: number): Promise<StoredCounts> {
    const scores = await this.prisma.reportScore.findMany({
      where: { reportId: BigInt(reportId) },
      include: { evidences: true }
    });
    const guardrailLogCount = await this.prisma.aiGuardrailLog.count({
      where: {
        processLog: {
          inputRef: {
            contains: `"reportId":${reportId}`
          }
        }
      }
    });
    return {
      scoreCount: scores.length,
      evidenceCount: scores.reduce((sum, score) => sum + score.evidences.length, 0),
      guardrailLogCount
    };
  }

  private async ensureReport(reportId: number, reportType: ReportType): Promise<void> {
    await this.prisma.evaluationReport.upsert({
      where: { reportId: BigInt(reportId) },
      create: {
        reportId: BigInt(reportId),
        reportType,
        status: "PENDING"
      },
      update: {}
    });
  }

  private async appendOutputRef(reportId: number, value: unknown): Promise<void> {
    const latestProcess = await this.prisma.aiProcessLog.findFirst({
      where: {
        inputRef: {
          contains: `"reportId":${reportId}`
        }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!latestProcess) {
      return;
    }
    await this.prisma.aiProcessLog.update({
      where: { processLogId: latestProcess.processLogId },
      data: { outputRef: JSON.stringify(value) }
    });
  }

  private processSnapshot(processLogId: bigint, step: ReportPipelineStep, status: ProcessLogSnapshot["status"]): ProcessLogSnapshot {
    return {
      processLogId: Number(processLogId),
      processType: "REPORT_GENERATE",
      step,
      status
    };
  }

  private toProcessSnapshot(processLog: {
    processLogId: bigint;
    processType: string;
    status: string;
    inputRef: string | null;
    failureCategory: string | null;
    failureReason: string | null;
  }): ProcessLogSnapshot {
    const input = processLog.inputRef ? JSON.parse(processLog.inputRef) : {};
    return {
      processLogId: Number(processLog.processLogId),
      processType: "REPORT_GENERATE",
      step: input.step ?? "REPORT_GENERATE",
      status: processLog.status as ProcessLogSnapshot["status"],
      failure:
        processLog.failureCategory && processLog.failureReason
          ? {
              category: processLog.failureCategory as FailureReason["category"],
              reason: processLog.failureReason
            }
          : undefined
    };
  }

  private toReportSnapshot(report: {
    reportId: bigint;
    reportType: string;
    status: string;
    summary: string | null;
    totalScore: number | null;
    failureCategory: string | null;
    failureReason: string | null;
  }): EvaluationReportSnapshot {
    return {
      reportId: Number(report.reportId),
      reportType: report.reportType as ReportType,
      status: report.status as EvaluationReportSnapshot["status"],
      summary: report.summary ?? undefined,
      totalScore: report.totalScore ?? undefined,
      failure:
        report.failureCategory && report.failureReason
          ? {
              category: report.failureCategory as FailureReason["category"],
              reason: report.failureReason
            }
          : undefined
    };
  }

  private nextId(): bigint {
    return BigInt(Date.now()) * BigInt(1000) + BigInt(Math.floor(Math.random() * 1000));
  }
}
