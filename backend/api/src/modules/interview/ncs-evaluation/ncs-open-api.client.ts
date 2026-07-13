import { Injectable } from "@nestjs/common";

export const NCS_OPEN_API_OPERATIONS = [
  "ncsCdInfo",
  "ncsDutyInfo",
  "ncsCompeUnitInfo",
  "ncsCompeUnitFactrInfo",
  "ncsKsaInfo",
  "ncsScopeInfo",
  "ncsEvalInfo",
  "ncsjobInfo",
  "ncsClposInfo",
  "ncsFusInfo",
  "ncsTrainCsdrInfo",
  "ncsCompeTrainInfo",
  "ncsSetqInfo",
] as const;

export type NcsOpenApiOperation = (typeof NCS_OPEN_API_OPERATIONS)[number];

export interface NcsOpenApiConfig {
  serviceKey: string;
  baseUrl: string;
  timeoutMs: number;
}

type NcsOpenApiQuery = Record<string, string | number | boolean | undefined>;

const DEFAULT_BASE_URL = "https://apis.data.go.kr/B490007/ncsInfo";
const DEFAULT_TIMEOUT_MS = 10_000;
const OPERATIONS = new Set<string>(NCS_OPEN_API_OPERATIONS);

@Injectable()
export class NcsOpenApiClient {
  isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return Boolean(env.NCS_OPEN_API_SERVICE_KEY?.trim());
  }

  async requestXml(
    operation: NcsOpenApiOperation,
    query: NcsOpenApiQuery = {},
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<string> {
    if (!OPERATIONS.has(operation)) {
      throw new Error("NCS Open API operation is not supported.");
    }
    if (Object.prototype.hasOwnProperty.call(query, "serviceKey")) {
      throw new Error("NCS Open API serviceKey must come from server configuration.");
    }

    const config = loadNcsOpenApiConfig(env);
    const url = new URL(`${config.baseUrl}/${operation}`);
    url.searchParams.set("serviceKey", config.serviceKey);
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/xml" },
        signal: controller.signal,
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`NCS Open API request failed with status ${response.status}.`);
      }
      if (!body.trim()) {
        throw new Error("NCS Open API returned an empty response.");
      }
      return body;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function loadNcsOpenApiConfig(env: NodeJS.ProcessEnv = process.env): NcsOpenApiConfig {
  const serviceKey = env.NCS_OPEN_API_SERVICE_KEY?.trim();
  if (!serviceKey) {
    throw new Error("NCS_OPEN_API_SERVICE_KEY is required for official NCS data requests.");
  }

  const baseUrl = (env.NCS_OPEN_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const parsedBaseUrl = new URL(baseUrl);
  if (parsedBaseUrl.protocol !== "https:") {
    throw new Error("NCS_OPEN_API_BASE_URL must use HTTPS.");
  }

  const timeoutMs = parsePositiveInteger(env.NCS_OPEN_API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  return { serviceKey, baseUrl, timeoutMs };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("NCS_OPEN_API_TIMEOUT_MS must be a positive integer.");
  }
  return parsed;
}
