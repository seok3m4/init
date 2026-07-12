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

const BUILT_IN_PROFILE_VERSION = "service-ncs-starter-v2";

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

interface JobRoleProfile {
  profileId: string;
  code: string;
  displayName: string;
  aliases: string[];
  domainContext: string;
}

const JOB_ROLE_PROFILES: JobRoleProfile[] = [
  {
    profileId: "backend",
    code: "BACKEND",
    displayName: "백엔드 개발자",
    aliases: ["백엔드 개발자", "백엔드", "backend", "backend developer"],
    domainContext: "API, 데이터와 서버 운영",
  },
  {
    profileId: "frontend",
    code: "FRONTEND",
    displayName: "프론트엔드 개발자",
    aliases: ["프론트엔드 개발자", "프론트엔드", "frontend", "frontend developer"],
    domainContext: "사용자 경험, 접근성과 브라우저 성능",
  },
  {
    profileId: "fullstack",
    code: "FULLSTACK",
    displayName: "풀스택 개발자",
    aliases: ["풀스택 개발자", "풀스택", "fullstack", "full stack developer"],
    domainContext: "클라이언트와 서버 경계, 데이터 흐름과 통합",
  },
  {
    profileId: "ai-ml",
    code: "AI_ML",
    displayName: "AI/ML 엔지니어",
    aliases: ["AI/ML 엔지니어", "AI 엔지니어", "ML 엔지니어", "ai/ml", "machine learning engineer"],
    domainContext: "데이터 품질, 모델 성능과 재현 가능한 실험",
  },
  {
    profileId: "data",
    code: "DATA",
    displayName: "데이터 엔지니어",
    aliases: ["데이터 엔지니어", "data engineer"],
    domainContext: "데이터 파이프라인, 정합성과 처리 신뢰성",
  },
  {
    profileId: "devops-sre",
    code: "DEVOPS_SRE",
    displayName: "DevOps/SRE",
    aliases: ["DevOps/SRE", "DevOps", "SRE", "site reliability engineer"],
    domainContext: "배포 안정성, 관측 가능성과 장애 복구",
  },
  {
    profileId: "qa",
    code: "QA",
    displayName: "QA 엔지니어",
    aliases: ["QA 엔지니어", "QA", "quality assurance engineer"],
    domainContext: "재현 조건, 테스트 전략과 품질 위험",
  },
  {
    profileId: "security",
    code: "SECURITY",
    displayName: "보안 엔지니어",
    aliases: ["보안 엔지니어", "security engineer"],
    domainContext: "위협, 보안 통제와 잔여 위험",
  },
];

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

    const requestedJobRole = normalizeJobRoleLabel(question.jobRole);
    const jobRoleProfile = resolveJobRoleProfile(requestedJobRole);
    const jobRole = jobRoleProfile?.displayName ?? requestedJobRole;
    const unitCode = jobRoleProfile ? roleUnitCode(question.questionType, jobRoleProfile.code) : profile.unitCode;
    const elementCode = unitCode + "-01";
    const profileId = jobRoleProfile ? `${jobRoleProfile.profileId}-${profile.profileId}` : profile.profileId;
    const definition = jobRoleProfile
      ? roleDefinition(question.questionType, jobRoleProfile.domainContext)
      : profile.definition;
    const behaviorDescription = jobRoleProfile
      ? roleBehaviorDescription(question.questionType, jobRoleProfile.domainContext)
      : profile.behaviorDescription;

    const snapshotWithoutVersion = {
      contractVersion: NCS_EVALUATION_PRODUCT_CONTRACT_VERSION,
      locale: "ko-KR" as const,
      jobRole,
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
          code: unitCode,
          name: jobRole ? `${jobRole} - ${profile.unitName}` : profile.unitName,
          level: null,
          definition,
          elements: [
            {
              elementCode,
              name: profile.elementName,
            },
          ],
        },
      },
      behaviorPoints: [
        {
          behaviorPointId: `${profileId}-bp-01`,
          description: behaviorDescription,
          sourceElementCodes: [elementCode],
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

function resolveJobRoleProfile(jobRole: string | null): JobRoleProfile | undefined {
  if (!jobRole) return undefined;
  const normalized = normalizeJobRoleKey(jobRole);
  return JOB_ROLE_PROFILES.find((profile) => profile.aliases.some((alias) => normalizeJobRoleKey(alias) === normalized));
}

function normalizeJobRoleLabel(value?: string): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 80) : null;
}

function normalizeJobRoleKey(value: string): string {
  return value.toLocaleLowerCase("ko-KR").replace(/[\s/_-]+/g, "");
}

function roleUnitCode(questionType: QuestionType, roleCode: string): string {
  const suffix = {
    TECHNICAL: "TECHNICAL-DECISION",
    EXPERIENCE: "LEARNING-APPLICATION",
    SITUATION: "PROBLEM-SOLVING",
    FOLLOW_UP: "EVIDENCE-COMPLETION",
    INTRO: "INTRO",
    CLOSING: "CLOSING",
  }[questionType];
  const category = questionType === "TECHNICAL" ? "JOB" : "BASIC";
  return `SERVICE-${category}-${roleCode.replace(/_/g, "-")}-${suffix}`;
}

function roleDefinition(questionType: QuestionType, domainContext: string): string {
  if (questionType === "TECHNICAL") {
    return `${domainContext}의 제약에서 기술 대안을 비교하고 선택 근거와 검증 결과를 설명하는 능력`;
  }
  if (questionType === "EXPERIENCE") {
    return `${domainContext}에 필요한 지식이나 도구를 학습하고 실제 문제에 적용한 과정을 설명하는 능력`;
  }
  if (questionType === "SITUATION") {
    return `${domainContext}의 문제 상황을 구조화하고 실행 가능한 해결책과 확인 기준을 제시하는 능력`;
  }
  return `${domainContext}에 관한 추가 질문에 맞춰 기존 답변에서 부족했던 행동 근거를 보완하는 능력`;
}

function roleBehaviorDescription(questionType: QuestionType, domainContext: string): string {
  if (questionType === "TECHNICAL") {
    return `${domainContext}의 제약과 대안을 구분하고 선택 근거, 실행 행동과 검증 결과를 연결해 설명한다.`;
  }
  if (questionType === "EXPERIENCE") {
    return `학습이 필요했던 상황과 ${domainContext}에 적용한 행동, 선택 이유, 결과와 회고를 구체적으로 설명한다.`;
  }
  if (questionType === "SITUATION") {
    return `${domainContext}의 문제와 제약을 구분하고 해결 행동, 선택 근거와 확인할 결과를 연결해 설명한다.`;
  }
  return `${domainContext}에 대한 꼬리질문의 초점을 직접 다루며 부족한 행동, 근거와 결과를 보완한다.`;
}
