import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { InterviewQuestion, QuestionType } from "../interview.runtime.types";
import { BuiltInNcsEvaluationSnapshotResolver } from "./built-in-ncs-evaluation-snapshot.resolver";
import {
  NCS_EVALUATION_PRODUCT_CONTRACT_VERSION,
  NCS_EVALUATION_SCORE_MAP,
  type NcsEvaluationEvidenceType,
  type NcsEvaluationQuestionType,
  type NcsEvaluationSnapshot,
  type NcsEvaluationSnapshotResolver,
} from "./ncs-evaluation-snapshot";
import { OfficialNcsReferenceCatalogService, type OfficialNcsUnit } from "./official-ncs-reference-catalog.service";

interface OfficialQuestionProfile {
  questionType: NcsEvaluationQuestionType;
  requiredEvidence: NcsEvaluationEvidenceType[];
}

const OFFICIAL_QUESTION_PROFILES: Partial<Record<QuestionType, OfficialQuestionProfile>> = {
  TECHNICAL: {
    questionType: "EXPERIENCE",
    requiredEvidence: ["ACTION", "RATIONALE", "RESULT", "TRADEOFF"],
  },
  EXPERIENCE: {
    questionType: "EXPERIENCE",
    requiredEvidence: ["SITUATION", "ACTION", "RATIONALE", "RESULT", "REFLECTION"],
  },
  SITUATION: {
    questionType: "SITUATION",
    requiredEvidence: ["SITUATION", "ACTION", "RATIONALE", "RESULT"],
  },
};

@Injectable()
export class OfficialNcsEvaluationSnapshotResolver implements NcsEvaluationSnapshotResolver {
  constructor(
    @Inject(OfficialNcsReferenceCatalogService)
    private readonly catalog: OfficialNcsReferenceCatalogService,
    @Inject(BuiltInNcsEvaluationSnapshotResolver)
    private readonly fallback: BuiltInNcsEvaluationSnapshotResolver,
  ) {}

  resolve(question: InterviewQuestion): NcsEvaluationSnapshot | undefined {
    const profile = OFFICIAL_QUESTION_PROFILES[question.questionType];
    const unit = profile ? this.catalog.resolve(question.jobRole, question.questionType) : undefined;
    if (!profile || !unit) return this.fallback.resolve(question);

    const jobRole = normalizeJobRole(question.jobRole);
    const questionContent = officialQuestionContent(question.questionType, unit);
    const sourceVersion = `hrdkapi:NCS007:ncs-degr-${unit.ncsDegree}:${unit.unitCode}`;
    const sourceElementCodes = unit.elements.map((element) => element.elementCode);
    const snapshotWithoutVersion = {
      contractVersion: NCS_EVALUATION_PRODUCT_CONTRACT_VERSION,
      locale: "ko-KR" as const,
      jobRole,
      question: {
        questionId: String(question.questionId),
        questionType: profile.questionType,
        content: questionContent,
      },
      ncsContext: {
        sourceKind: "OFFICIAL_NCS" as const,
        version: sourceVersion,
        categoryType: "JOB_PERFORMANCE" as const,
        unit: {
          code: unit.unitCode,
          name: `${unit.dutyName} - ${unit.unitName}`,
          level: unit.level,
          definition: unit.definition,
          elements: unit.elements.map((element) => ({ ...element })),
        },
      },
      behaviorPoints: [
        {
          behaviorPointId: `${unit.unitCode}-${question.questionType.toLowerCase()}-bp-01`,
          description: behaviorDescription(question.questionType, unit),
          sourceElementCodes,
          observability: "INTERVIEW" as const,
          requiredEvidence: [...profile.requiredEvidence],
        },
      ],
      evaluationPolicy: {
        scoreMap: { ...NCS_EVALUATION_SCORE_MAP },
        minimumSupportingEvidence: 1,
        insufficientEvidenceScore: null,
        allowSensitiveAttributes: false as const,
        allowNonverbalScore: false as const,
      },
    };
    const hash = createHash("sha256").update(JSON.stringify(snapshotWithoutVersion)).digest("hex").slice(0, 16);
    return {
      ...snapshotWithoutVersion,
      snapshotVersion: `${sourceVersion}:${hash}`,
    };
  }
}

function officialQuestionContent(questionType: QuestionType, unit: OfficialNcsUnit): string {
  if (questionType === "TECHNICAL") {
    return `${unit.unitName} 업무에서 기술 대안을 비교하고 선택했던 경험을 판단 기준과 검증 결과까지 포함해 설명해주세요.`;
  }
  if (questionType === "EXPERIENCE") {
    return `${unit.unitName} 업무에 필요한 지식이나 도구를 학습해 실제로 적용한 경험과 그 결과를 설명해주세요.`;
  }
  return `${unit.unitName} 업무 중 예상하지 못한 문제나 장애를 발견했을 때, 원인 분석부터 해결과 결과 확인까지 설명해주세요.`;
}

function behaviorDescription(questionType: QuestionType, unit: OfficialNcsUnit): string {
  const elementNames = unit.elements.slice(0, 3).map((element) => element.name).join(", ");
  if (questionType === "TECHNICAL") {
    return `${unit.unitName}의 능력단위요소(${elementNames})와 관련된 제약과 대안을 구분하고, 본인의 선택 근거와 실행 행동, 검증 결과를 연결해 설명한다.`;
  }
  if (questionType === "EXPERIENCE") {
    return `${unit.unitName}의 능력단위요소(${elementNames})에 필요한 내용을 학습하고 실제 업무에 적용한 행동, 이유, 결과와 회고를 구체적으로 설명한다.`;
  }
  return `${unit.unitName}의 능력단위요소(${elementNames})와 관련된 문제와 제약을 구분하고, 해결 행동과 선택 근거, 확인한 결과를 연결해 설명한다.`;
}

function normalizeJobRole(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 80) : null;
}
