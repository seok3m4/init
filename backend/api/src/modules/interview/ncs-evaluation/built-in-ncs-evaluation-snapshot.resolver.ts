import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { InterviewQuestion, QuestionType } from "../interview.runtime.types";
import {
  NCS_EVALUATION_PRODUCT_CONTRACT_VERSION,
  NCS_EVALUATION_SCORE_MAP,
  type NcsEvaluationEvidenceType,
  type NcsEvaluationQuestionType,
  type NcsEvaluationSnapshot,
  type NcsEvaluationSnapshotResolver,
} from "./ncs-evaluation-snapshot";

const BUILT_IN_PROFILE_VERSION = "service-ncs-starter-v1";

interface BuiltInProfile {
  profileId: string;
  questionType: NcsEvaluationQuestionType;
  categoryType: "OCCUPATIONAL_BASIC" | "JOB_PERFORMANCE";
  unitCode: string;
  unitName: string;
  definition: string;
  elementCode: string;
  elementName: string;
  behaviorDescription: string;
  requiredEvidence: NcsEvaluationEvidenceType[];
}

const PROFILES: Partial<Record<QuestionType, BuiltInProfile>> = {
  TECHNICAL: {
    profileId: "technical-decision",
    questionType: "EXPERIENCE",
    categoryType: "JOB_PERFORMANCE",
    unitCode: "SERVICE-JOB-TECHNICAL-DECISION",
    unitName: "기술 의사결정",
    definition: "주어진 제약에서 기술 대안을 비교하고 근거와 검증 결과를 설명하는 능력",
    elementCode: "SERVICE-JOB-TECHNICAL-DECISION-01",
    elementName: "대안 비교와 결과 검증",
    behaviorDescription: "기술적 제약과 대안을 구분하고 선택 근거, 실행 행동, 검증 결과를 연결해 설명한다.",
    requiredEvidence: ["ACTION", "RATIONALE", "RESULT", "TRADEOFF"],
  },
  EXPERIENCE: {
    profileId: "experience-application",
    questionType: "EXPERIENCE",
    categoryType: "OCCUPATIONAL_BASIC",
    unitCode: "SERVICE-BASIC-SELF-DEVELOPMENT",
    unitName: "학습과 업무 적용",
    definition: "새로운 지식이나 도구를 학습하고 실제 업무 문제에 적용한 과정을 설명하는 능력",
    elementCode: "SERVICE-BASIC-SELF-DEVELOPMENT-01",
    elementName: "학습 결과의 업무 적용",
    behaviorDescription: "학습이 필요했던 상황, 실제 적용 행동, 선택 이유, 결과와 회고를 구체적으로 설명한다.",
    requiredEvidence: ["SITUATION", "ACTION", "RATIONALE", "RESULT", "REFLECTION"],
  },
  SITUATION: {
    profileId: "situational-problem-solving",
    questionType: "SITUATION",
    categoryType: "OCCUPATIONAL_BASIC",
    unitCode: "SERVICE-BASIC-PROBLEM-SOLVING",
    unitName: "문제 해결",
    definition: "문제 상황을 구조화하고 실행 가능한 해결책과 기대 결과를 논리적으로 제시하는 능력",
    elementCode: "SERVICE-BASIC-PROBLEM-SOLVING-01",
    elementName: "문제 분석과 해결안 실행",
    behaviorDescription: "문제와 제약을 구분하고 선택한 해결 행동, 선택 근거와 확인할 결과를 연결해 설명한다.",
    requiredEvidence: ["SITUATION", "ACTION", "RATIONALE", "RESULT"],
  },
  FOLLOW_UP: {
    profileId: "follow-up-evidence-completion",
    questionType: "FOLLOW_UP",
    categoryType: "OCCUPATIONAL_BASIC",
    unitCode: "SERVICE-BASIC-EVIDENCE-COMPLETION",
    unitName: "근거 보완",
    definition: "추가 질문의 초점에 맞춰 기존 답변에서 부족했던 행동 근거를 보완하는 능력",
    elementCode: "SERVICE-BASIC-EVIDENCE-COMPLETION-01",
    elementName: "추가 근거의 구체화",
    behaviorDescription: "꼬리질문의 요구를 직접 다루며 구체적인 행동, 근거와 결과 중 부족한 내용을 보완한다.",
    requiredEvidence: ["ACTION", "RATIONALE", "RESULT"],
  },
};

@Injectable()
export class BuiltInNcsEvaluationSnapshotResolver implements NcsEvaluationSnapshotResolver {
  resolve(question: InterviewQuestion): NcsEvaluationSnapshot | undefined {
    const profile = PROFILES[question.questionType];
    if (!profile) {
      return undefined;
    }

    const snapshotWithoutVersion = {
      contractVersion: NCS_EVALUATION_PRODUCT_CONTRACT_VERSION,
      locale: "ko-KR" as const,
      question: {
        questionId: String(question.questionId),
        questionType: profile.questionType,
        content: question.content,
      },
      ncsContext: {
        sourceKind: "SYNTHETIC_NCS_LIKE" as const,
        version: BUILT_IN_PROFILE_VERSION,
        categoryType: profile.categoryType,
        unit: {
          code: profile.unitCode,
          name: question.jobRole ? `${question.jobRole} - ${profile.unitName}` : profile.unitName,
          level: null,
          definition: profile.definition,
          elements: [
            {
              elementCode: profile.elementCode,
              name: profile.elementName,
            },
          ],
        },
      },
      behaviorPoints: [
        {
          behaviorPointId: `${profile.profileId}-bp-01`,
          description: profile.behaviorDescription,
          sourceElementCodes: [profile.elementCode],
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

    const snapshotHash = createHash("sha256").update(JSON.stringify(snapshotWithoutVersion)).digest("hex").slice(0, 16);

    return {
      ...snapshotWithoutVersion,
      snapshotVersion: `${BUILT_IN_PROFILE_VERSION}:${snapshotHash}`,
    };
  }
}
