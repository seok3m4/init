import { Injectable } from "@nestjs/common";

export const NCS_OPEN_API_REFERENCE_OPERATIONS = [
  "NCS001",
  "NCS002",
  "NCS003",
  "NCS004",
  "NCS005",
  "NCS006",
  "NCS007",
] as const;

export const NCS_OPEN_API_DETAIL_OPERATIONS = [
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

export type NcsOpenApiReferenceOperation = (typeof NCS_OPEN_API_REFERENCE_OPERATIONS)[number];
export type NcsOpenApiDetailOperation = (typeof NCS_OPEN_API_DETAIL_OPERATIONS)[number];

export interface NcsOpenApiConfig {
  serviceKey: string;
  baseUrl: string;
  detailBaseUrl: string;
  timeoutMs: number;
}

type NcsOpenApiQuery = Record<string, string | number | boolean | undefined>;

const DEFAULT_BASE_URL = "https://apis.data.go.kr/B490007/hrdkapi";
const DEFAULT_DETAIL_BASE_URL = "https://apis.data.go.kr/B490007/ncsInfo";
const DEFAULT_TIMEOUT_MS = 30_000;
const REFERENCE_OPERATIONS = new Set<string>(NCS_OPEN_API_REFERENCE_OPERATIONS);
const DETAIL_OPERATIONS = new Set<string>(NCS_OPEN_API_DETAIL_OPERATIONS);

@Injectable()
export class NcsOpenApiClient {
  isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return Boolean(env.NCS_OPEN_API_SERVICE_KEY?.trim());
  }

  async requestJson<T = unknown>(
    operation: NcsOpenApiReferenceOperation,
    query: NcsOpenApiQuery = {},
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<T> {
    if (!REFERENCE_OPERATIONS.has(operation)) {
      throw new Error("NCS Open API reference operation is not supported.");
    }

    const config = loadNcsOpenApiConfig(env);
    const response = await this.request(
      `${config.baseUrl}/${operation}`,
      query,
      config,
      "application/json",
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new Error("NCS Open API returned invalid JSON.");
    }

    const resultCode = readResultCode(parsed);
    if (resultCode !== undefined && resultCode !== "00") {
      throw new Error(`NCS Open API returned provider error ${resultCode}.`);
    }
    return parsed as T;
  }

  async requestXml(
    operation: NcsOpenApiDetailOperation,
    query: NcsOpenApiQuery = {},
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<string> {
    if (!DETAIL_OPERATIONS.has(operation)) {
      throw new Error("NCS Open API detail operation is not supported.");
    }

    const config = loadNcsOpenApiConfig(env);
    return this.request(
      `${config.detailBaseUrl}/${operation}`,
      query,
      config,
      "application/xml",
    );
  }

  private async request(
    endpoint: string,
    query: NcsOpenApiQuery,
    config: NcsOpenApiConfig,
    accept: string,
  ): Promise<string> {
    if (Object.prototype.hasOwnProperty.call(query, "serviceKey")) {
      throw new Error("NCS Open API serviceKey must come from server configuration.");
    }

    const url = new URL(endpoint);
    url.searchParams.set("serviceKey", config.serviceKey);
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: accept },
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

  const baseUrl = validateHttpsUrl(
    env.NCS_OPEN_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
    "NCS_OPEN_API_BASE_URL",
  );
  const detailBaseUrl = validateHttpsUrl(
    env.NCS_OPEN_API_DETAIL_BASE_URL?.trim() || DEFAULT_DETAIL_BASE_URL,
    "NCS_OPEN_API_DETAIL_BASE_URL",
  );
  const timeoutMs = parsePositiveInteger(env.NCS_OPEN_API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  return { serviceKey, baseUrl, detailBaseUrl, timeoutMs };
}

function validateHttpsUrl(value: string, name: string): string {
  const normalized = value.replace(/\/+$/, "");
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS.`);
  }
  return normalized;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("NCS_OPEN_API_TIMEOUT_MS must be a positive integer.");
  }
  return parsed;
}

function readResultCode(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.response) || !isRecord(value.response.header)) return undefined;
  const resultCode = value.response.header.resultCode;
  return typeof resultCode === "string" || typeof resultCode === "number" ? String(resultCode) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
