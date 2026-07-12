import { readFile } from "node:fs/promises";
import {
  NCS_EVALUATION_CONTRACT_VERSION,
  NcsEvaluationInput,
  NcsGoldenCase,
  NcsGoldenContext,
  NcsGoldenDataset,
} from "./contract";

export async function readNcsGoldenDataset(filePath: string): Promise<NcsGoldenDataset> {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as NcsGoldenDataset;
  if (parsed.contractVersion !== NCS_EVALUATION_CONTRACT_VERSION) {
    throw new Error(`Unsupported NCS evaluation contract: ${parsed.contractVersion}`);
  }
  if (!Array.isArray(parsed.contexts) || !Array.isArray(parsed.cases)) {
    throw new Error("NCS golden dataset must contain contexts and cases");
  }
  return parsed;
}

export function contextMapFor(dataset: NcsGoldenDataset): Map<string, NcsGoldenContext> {
  return new Map(dataset.contexts.map((context) => [context.contextId, context]));
}

export function assembleNcsEvaluationInput(
  dataset: NcsGoldenDataset,
  goldenCase: NcsGoldenCase,
  contexts = contextMapFor(dataset),
): NcsEvaluationInput {
  const context = contexts.get(goldenCase.contextId);
  if (!context) {
    throw new Error(`Unknown NCS golden context: ${goldenCase.contextId}`);
  }
  return {
    contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
    caseId: goldenCase.caseId,
    locale: context.locale,
    question: context.question,
    answer: goldenCase.answer,
    ncsContext: context.ncsContext,
    behaviorPoints: context.behaviorPoints,
    interviewContext: goldenCase.interviewContext,
    evaluationPolicy: dataset.defaultEvaluationPolicy,
  };
}
