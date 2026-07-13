export const TALENT_RUBRIC_CONTRACT_VERSION = "talent-rubric-snapshot.v1" as const;
export const TALENT_RUBRIC_VERSION = "talent-rubric-deterministic.v1" as const;

export type TalentEvidenceType = "ACTION" | "RATIONALE" | "RESULT" | "REFLECTION";
export type TalentRubricAnchorLevel = 1 | 2 | 3 | 4 | 5;
export type TalentProhibitedSignalCategory = "SENSITIVE_ATTRIBUTE" | "NONVERBAL_SIGNAL";

export interface TalentProfileItemInput {
  readonly name: string;
  readonly description: string;
  readonly weight?: number;
}

export interface TalentBehaviorIndicator {
  readonly id: string;
  readonly evidenceType: TalentEvidenceType;
  readonly observability: "ANSWER_TRANSCRIPT";
  readonly description: string;
}

export interface TalentScoringAnchor {
  readonly level: TalentRubricAnchorLevel;
  readonly evidenceStrength: TalentRubricAnchorLevel;
  readonly label: string;
  readonly description: string;
}

export interface TalentRubricCriterion {
  readonly id: string;
  readonly name: string;
  readonly definition: string;
  readonly weight: number;
  readonly behaviorIndicators: readonly TalentBehaviorIndicator[];
  readonly requiredEvidence: readonly TalentEvidenceType[];
  readonly scoringAnchors: readonly TalentScoringAnchor[];
}

export interface TalentEvidencePolicy {
  readonly source: "ANSWER_TRANSCRIPT";
  readonly requiredEvidenceRule: "ALL_REQUIRED";
  readonly missingRequiredEvidenceStatus: "INSUFFICIENT_EVIDENCE";
  readonly insufficientEvidenceScore: null;
}

export interface TalentProhibitedSignal {
  readonly category: TalentProhibitedSignalCategory;
  readonly signals: readonly string[];
  readonly detectedInSource: readonly string[];
  readonly disposition: "EXCLUDE_FROM_SCORING";
}

export interface TalentRubricSnapshot {
  readonly contractVersion: typeof TALENT_RUBRIC_CONTRACT_VERSION;
  readonly rubricVersion: string;
  readonly sourceHash: string;
  readonly criteria: readonly TalentRubricCriterion[];
  readonly evidencePolicy: TalentEvidencePolicy;
  readonly prohibitedSignals: readonly TalentProhibitedSignal[];
}
