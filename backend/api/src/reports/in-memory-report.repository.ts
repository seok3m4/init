import { Injectable } from "@nestjs/common";
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

interface GuardrailLogRecord {
  guardrailLogId: number;
  processLogId: number;
  policyName: string;
  result: GuardrailDecision["result"];
  reason: string | null;
  createdAt: string;
}

@Injectable()
export class InMemoryReportRepository {
  private nextProcessLogId = 1;
  private nextScoreId = 1;
  private nextEvidenceId = 1;
  private nextGuardrailLogId = 1;

  private readonly reports = new Map<number, EvaluationReportSnapshot>();
  private readonly processLogs = new Map<number, ProcessLogSnapshot>();
  private readonly contexts = new Map<number, EvaluationContext>();
  private readonly communicationAnalyses = new Map<number, CommunicationAnalysis>();
  private readonly scoresByReport = new Map<number, ReportScore[]>();
  private readonly guardrailLogs: GuardrailLogRecord[] = [];

  startProcess(reportId: number, reportType: ReportType, step: ReportPipelineStep): ProcessLogSnapshot {
    this.ensureReport(reportId, reportType);
    const processLog: ProcessLogSnapshot = {
      processLogId: this.nextProcessLogId++,
      processType: "REPORT_GENERATE",
      step,
      status: "PENDING"
    };
    this.processLogs.set(processLog.processLogId, processLog);
    return { ...processLog };
  }

  markProcessRunning(processLogId: number): ProcessLogSnapshot {
    return this.updateProcess(processLogId, { status: "RUNNING" });
  }

  markProcessCompleted(processLogId: number): ProcessLogSnapshot {
    return this.updateProcess(processLogId, { status: "COMPLETED" });
  }

  markProcessFailed(processLogId: number, failure: FailureReason): ProcessLogSnapshot {
    return this.updateProcess(processLogId, { status: "FAILED", failure });
  }

  markReportGenerating(reportId: number, reportType: ReportType): EvaluationReportSnapshot {
    const report = this.ensureReport(reportId, reportType);
    const updated: EvaluationReportSnapshot = {
      ...report,
      reportType,
      status: "GENERATING",
      failure: undefined
    };
    this.reports.set(reportId, updated);
    return { ...updated };
  }

  markReportCompleted(reportId: number, summary: string, totalScore: number): EvaluationReportSnapshot {
    const report = this.requireReport(reportId);
    const updated: EvaluationReportSnapshot = {
      ...report,
      status: "COMPLETED",
      summary,
      totalScore,
      failure: undefined
    };
    this.reports.set(reportId, updated);
    return { ...updated };
  }

  markReportFailed(reportId: number, failure: FailureReason): EvaluationReportSnapshot {
    const report = this.requireReport(reportId);
    const updated: EvaluationReportSnapshot = {
      ...report,
      status: "FAILED",
      failure
    };
    this.reports.set(reportId, updated);
    return { ...updated };
  }

  saveContext(reportId: number, context: EvaluationContext): void {
    this.contexts.set(reportId, context);
  }

  saveCommunicationAnalysis(reportId: number, communicationAnalysis: CommunicationAnalysis): void {
    this.communicationAnalyses.set(reportId, communicationAnalysis);
  }

  saveScoresAndEvidences(reportId: number, scores: ReportScore[]): StoredCounts {
    const storedScores = scores.map((score) => ({
      ...score,
      scoreId: this.nextScoreId++,
      evidences: score.evidences.map((evidence) => ({
        ...evidence,
        evidenceId: this.nextEvidenceId++
      }))
    }));
    this.scoresByReport.set(reportId, storedScores);

    return {
      scoreCount: storedScores.length,
      evidenceCount: storedScores.reduce((sum, score) => sum + score.evidences.length, 0),
      guardrailLogCount: this.guardrailLogs.length
    };
  }

  saveGuardrailLog(processLogId: number, policyName: string, decision: GuardrailDecision): number {
    const guardrailLogId = this.nextGuardrailLogId++;
    this.guardrailLogs.push({
      guardrailLogId,
      processLogId,
      policyName,
      result: decision.result,
      reason: decision.reason,
      createdAt: new Date().toISOString()
    });
    return guardrailLogId;
  }

  getReport(reportId: number): EvaluationReportSnapshot {
    return { ...this.requireReport(reportId) };
  }

  countStored(reportId: number): StoredCounts {
    const scores = this.scoresByReport.get(reportId) ?? [];
    return {
      scoreCount: scores.length,
      evidenceCount: scores.reduce((sum, score) => sum + score.evidences.length, 0),
      guardrailLogCount: this.guardrailLogs.length
    };
  }

  private ensureReport(reportId: number, reportType: ReportType): EvaluationReportSnapshot {
    const existing = this.reports.get(reportId);
    if (existing) {
      return existing;
    }

    const created: EvaluationReportSnapshot = {
      reportId,
      reportType,
      status: "PENDING"
    };
    this.reports.set(reportId, created);
    return created;
  }

  private requireReport(reportId: number): EvaluationReportSnapshot {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} was not initialized.`);
    }
    return report;
  }

  private updateProcess(processLogId: number, patch: Partial<ProcessLogSnapshot>): ProcessLogSnapshot {
    const processLog = this.processLogs.get(processLogId);
    if (!processLog) {
      throw new Error(`Process log ${processLogId} was not initialized.`);
    }

    const updated = { ...processLog, ...patch };
    this.processLogs.set(processLogId, updated);
    return { ...updated };
  }
}
