import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { QuestionType } from "../interview.runtime.types";
import { NcsOpenApiClient } from "./ncs-open-api.client";

export interface OfficialNcsUnit {
  dutyCode: string;
  dutyName: string;
  ncsDegree: number;
  unitCode: string;
  unitName: string;
  definition: string;
  level: number | null;
  elements: Array<{
    elementCode: string;
    name: string;
  }>;
}

interface RoleMapping {
  aliases: string[];
  dutyNames: string[];
  unitNames: Partial<Record<QuestionType, string[]>>;
}

interface Ncs007Row {
  usage: string;
  dutyCode: string;
  dutyName: string;
  ncsDegree: number;
  unitCode: string;
  unitName: string;
  definition: string;
  level: number | null;
  elementCode: string;
  elementName: string;
}

const SEARCH_KEYWORDS = ["응용SW", "인공지능", "빅데이터", "클라우드", "정보보호"] as const;

const ROLE_MAPPINGS: RoleMapping[] = [
  {
    aliases: ["백엔드 개발자", "백엔드", "backend", "backend developer"],
    dutyNames: ["응용SW엔지니어링"],
    unitNames: {
      TECHNICAL: ["애플리케이션 설계", "데이터 입출력 구현"],
      EXPERIENCE: ["서버프로그램 구현", "응용SW 기초 기술 활용"],
      SITUATION: ["애플리케이션 테스트 관리", "애플리케이션 테스트 수행"],
    },
  },
  {
    aliases: ["프론트엔드 개발자", "프론트엔드", "frontend", "frontend developer"],
    dutyNames: ["응용SW엔지니어링"],
    unitNames: {
      TECHNICAL: ["화면 설계"],
      EXPERIENCE: ["화면 구현"],
      SITUATION: ["애플리케이션 테스트 수행"],
    },
  },
  {
    aliases: ["풀스택 개발자", "풀스택", "fullstack", "full stack developer"],
    dutyNames: ["응용SW엔지니어링"],
    unitNames: {
      TECHNICAL: ["통합 구현", "애플리케이션 설계"],
      EXPERIENCE: ["서버프로그램 구현"],
      SITUATION: ["애플리케이션 테스트 관리"],
    },
  },
  {
    aliases: ["AI/ML 엔지니어", "AI 엔지니어", "ML 엔지니어", "ai/ml", "machine learning engineer"],
    dutyNames: ["인공지능모델링"],
    unitNames: {
      TECHNICAL: ["인공지능 모델 문제 정의", "인공지능 모델 준비"],
      EXPERIENCE: ["인공지능 데이터 전처리", "인공지능 모델 학습"],
      SITUATION: ["인공지능 모델 평가"],
    },
  },
  {
    aliases: ["데이터 엔지니어", "data engineer"],
    dutyNames: ["빅데이터플랫폼구축"],
    unitNames: {
      TECHNICAL: ["빅데이터 플랫폼 아키텍처 설계"],
      EXPERIENCE: ["빅데이터 처리시스템 개발", "빅데이터 수집시스템 개발"],
      SITUATION: ["빅데이터 플랫폼 테스트", "빅데이터 품질관리시스템 개발"],
    },
  },
  {
    aliases: ["DevOps/SRE", "DevOps", "SRE", "site reliability engineer"],
    dutyNames: ["클라우드인프라스트럭쳐엔지니어링"],
    unitNames: {
      TECHNICAL: ["클라우드 서비스 아키텍처 수립"],
      EXPERIENCE: ["클라우드 서비스 배포", "클라우드 서버 개발"],
      SITUATION: ["클라우드 서비스 테스트"],
    },
  },
  {
    aliases: ["QA 엔지니어", "QA", "quality assurance engineer"],
    dutyNames: ["응용SW엔지니어링"],
    unitNames: {
      TECHNICAL: ["애플리케이션 테스트 관리"],
      EXPERIENCE: ["애플리케이션 테스트 수행"],
      SITUATION: ["애플리케이션 테스트 수행"],
    },
  },
  {
    aliases: ["보안 엔지니어", "security engineer"],
    dutyNames: ["정보보호관리·운영", "정보보호관리운영"],
    unitNames: {
      TECHNICAL: ["정보보호 보안성 검토", "보안성 검토", "보안 위험관리"],
      EXPERIENCE: ["애플리케이션 보안 운영", "시스템 보안 운영"],
      SITUATION: ["보안 위험관리", "보안 장비 운용"],
    },
  },
];

@Injectable()
export class OfficialNcsReferenceCatalogService implements OnModuleInit {
  private readonly logger = new Logger(OfficialNcsReferenceCatalogService.name);
  private units: OfficialNcsUnit[] = [];
  private synchronizedAt: string | null = null;
  private failedKeywordCount = 0;

  constructor(@Inject(NcsOpenApiClient) private readonly client: NcsOpenApiClient) {}

  async onModuleInit(): Promise<void> {
    if (!isEnabled(process.env.NCS_OPEN_API_SYNC_ON_STARTUP)) return;
    await this.synchronize(process.env);
  }

  async synchronize(env: NodeJS.ProcessEnv = process.env): Promise<void> {
    if (!this.client.isConfigured(env)) {
      this.failedKeywordCount = SEARCH_KEYWORDS.length;
      this.logger.warn("Official NCS startup sync was skipped because the service key is not configured.");
      return;
    }

    const rows: Ncs007Row[] = [];
    this.failedKeywordCount = 0;
    for (const [index, keyword] of SEARCH_KEYWORDS.entries()) {
      try {
        rows.push(...await this.loadKeyword(keyword, env));
      } catch {
        this.failedKeywordCount += 1;
        this.logger.warn(`Official NCS sync failed for configured search ${index + 1}.`);
      }
    }

    const synchronizedUnits = buildUnits(rows);
    if (synchronizedUnits.length > 0) {
      this.units = synchronizedUnits;
      this.synchronizedAt = new Date().toISOString();
      this.logger.log(`Official NCS catalog loaded ${this.units.length} active unit revisions.`);
    } else {
      this.logger.warn("Official NCS sync returned no usable active units; synthetic profiles remain active.");
    }
  }

  resolve(jobRole: string | null | undefined, questionType: QuestionType): OfficialNcsUnit | undefined {
    if (!jobRole) return undefined;
    const roleKey = normalizeKey(jobRole);
    const mapping = ROLE_MAPPINGS.find((candidate) =>
      candidate.aliases.some((alias) => normalizeKey(alias) === roleKey),
    );
    const preferredUnitNames = mapping?.unitNames[questionType];
    if (!mapping || !preferredUnitNames?.length) return undefined;

    const dutyKeys = new Set(mapping.dutyNames.map(normalizeKey));
    const candidates = this.units
      .filter((unit) => dutyKeys.has(normalizeKey(unit.dutyName)))
      .sort((left, right) => right.ncsDegree - left.ncsDegree || left.unitCode.localeCompare(right.unitCode));

    for (const preferredName of preferredUnitNames) {
      const preferredKey = normalizeKey(preferredName);
      const exact = candidates.find((unit) => normalizeKey(unit.unitName) === preferredKey);
      if (exact) return cloneUnit(exact);
      const partial = candidates.find((unit) => {
        const unitKey = normalizeKey(unit.unitName);
        return unitKey.includes(preferredKey) || preferredKey.includes(unitKey);
      });
      if (partial) return cloneUnit(partial);
    }
    return undefined;
  }

  status(): {
    synchronized: boolean;
    synchronizedAt: string | null;
    unitCount: number;
    failedKeywordCount: number;
  } {
    return {
      synchronized: this.units.length > 0,
      synchronizedAt: this.synchronizedAt,
      unitCount: this.units.length,
      failedKeywordCount: this.failedKeywordCount,
    };
  }

  private async loadKeyword(keyword: string, env: NodeJS.ProcessEnv): Promise<Ncs007Row[]> {
    const response = await this.client.requestJson("NCS007", {
      pageNo: 1,
      numOfRows: 1000,
      LVL: 1,
      SWRD: keyword,
      SNUM: 1,
      ENUM: 1000,
    }, env);
    return readItems(response)
      .map(parseNcs007Row)
      .filter((row): row is Ncs007Row => row !== undefined && row.usage === "Y");
  }
}

function buildUnits(rows: Ncs007Row[]): OfficialNcsUnit[] {
  const units = new Map<string, OfficialNcsUnit>();
  for (const row of rows) {
    const key = `${row.unitCode}:${row.ncsDegree}`;
    const existing = units.get(key) ?? {
      dutyCode: row.dutyCode,
      dutyName: row.dutyName,
      ncsDegree: row.ncsDegree,
      unitCode: row.unitCode,
      unitName: row.unitName,
      definition: row.definition,
      level: row.level,
      elements: [],
    };
    if (!existing.elements.some((element) => element.elementCode === row.elementCode)) {
      existing.elements.push({ elementCode: row.elementCode, name: row.elementName });
    }
    units.set(key, existing);
  }
  return [...units.values()]
    .filter((unit) => unit.elements.length > 0)
    .map((unit) => ({
      ...unit,
      elements: unit.elements.sort((left, right) => left.elementCode.localeCompare(right.elementCode)),
    }))
    .sort((left, right) => left.dutyCode.localeCompare(right.dutyCode) || left.unitCode.localeCompare(right.unitCode));
}

function readItems(value: unknown): unknown[] {
  if (!isRecord(value) || !isRecord(value.response) || !isRecord(value.response.body)) return [];
  const items = value.response.body.items;
  if (!isRecord(items)) return [];
  const item = items.item;
  if (Array.isArray(item)) return item;
  return isRecord(item) ? [item] : [];
}

function parseNcs007Row(value: unknown): Ncs007Row | undefined {
  if (!isRecord(value)) return undefined;
  const dutyCode = textValue(value.NCS_SUBD_CD);
  const dutyName = textValue(value.NCS_SUBD_CDNM);
  const unitCode = textValue(value.NCS_CL_CD);
  const unitName = textValue(value.COMPE_UNIT_NAME);
  const definition = textValue(value.COMPE_UNIT_DEF);
  const factorNumber = textValue(value.COMPE_UNIT_FACTR_NO);
  const elementCode = textValue(value.COMPE_UNIT_FACTR_NO_CD)
    ?? (unitCode && factorNumber ? `${unitCode}-${factorNumber}` : undefined);
  const elementName = textValue(value.COMPE_UNIT_FACTR_NAME);
  const ncsDegree = integerValue(value.NCS_DEGR);
  if (!dutyCode || !dutyName || !unitCode || !unitName || !definition || !elementCode || !elementName || ncsDegree === undefined) {
    return undefined;
  }
  return {
    usage: textValue(value.USG_YN) ?? "",
    dutyCode,
    dutyName,
    ncsDegree,
    unitCode,
    unitName,
    definition,
    level: integerValue(value.COMPE_UNIT_LEVEL) ?? null,
    elementCode,
    elementName,
  };
}

function textValue(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function integerValue(value: unknown): number | undefined {
  const text = textValue(value);
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function normalizeKey(value: string): string {
  return value.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]+/g, "");
}

function cloneUnit(unit: OfficialNcsUnit): OfficialNcsUnit {
  return { ...unit, elements: unit.elements.map((element) => ({ ...element })) };
}

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
