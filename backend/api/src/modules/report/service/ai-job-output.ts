import { parseNcsEvaluationJobOutput } from "./ncs-evaluation-job-output";

export function parseAiJobOutput(outputRef?: string | null, inputRef?: string | null): unknown | undefined {
  if (!outputRef) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(outputRef) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Reflect.get(parsed, "contractVersion") === "ncs-evaluation-product.v1"
    ) {
      return parseNcsEvaluationJobOutput(parsed, inputRef);
    }
    return parsed;
  } catch {
    return undefined;
  }
}
