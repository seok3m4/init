import type { TalentProfileItemInput } from "./types";

export const TALENT_PROFILE_MIN_ITEMS = 1;
export const TALENT_PROFILE_MAX_ITEMS = 6;
export const TALENT_PROFILE_NAME_MAX_LENGTH = 80;
export const TALENT_PROFILE_DESCRIPTION_MAX_LENGTH = 1_000;

export type TalentRubricValidationErrorCode =
  | "INVALID_ITEMS"
  | "ITEM_COUNT_OUT_OF_RANGE"
  | "INVALID_ITEM"
  | "NAME_REQUIRED"
  | "NAME_TOO_LONG"
  | "DESCRIPTION_REQUIRED"
  | "DESCRIPTION_TOO_LONG"
  | "DUPLICATE_NAME"
  | "WEIGHT_NOT_POSITIVE"
  | "NO_ASSESSABLE_CONTENT";

export class TalentRubricValidationError extends Error {
  constructor(
    readonly code: TalentRubricValidationErrorCode,
    readonly field: string,
    message: string,
  ) {
    super(`${field}: ${message}`);
    this.name = "TalentRubricValidationError";
  }
}

export interface NormalizedTalentProfileItem {
  readonly name: string;
  readonly description: string;
  readonly sourceWeight: number;
}

export function validateAndNormalizeTalentProfileItems(
  input: readonly TalentProfileItemInput[],
): NormalizedTalentProfileItem[] {
  if (!Array.isArray(input)) {
    throw new TalentRubricValidationError("INVALID_ITEMS", "items", "an array is required");
  }
  if (input.length < TALENT_PROFILE_MIN_ITEMS || input.length > TALENT_PROFILE_MAX_ITEMS) {
    throw new TalentRubricValidationError(
      "ITEM_COUNT_OUT_OF_RANGE",
      "items",
      `must contain ${TALENT_PROFILE_MIN_ITEMS} to ${TALENT_PROFILE_MAX_ITEMS} items`,
    );
  }

  const duplicateKeys = new Set<string>();
  return (input as readonly unknown[]).map((candidate, index) => {
    const field = `items[${index}]`;
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      throw new TalentRubricValidationError("INVALID_ITEM", field, "an object is required");
    }

    const item = candidate as Record<string, unknown>;
    const name = normalizeRequiredText(item.name, `${field}.name`, "NAME_REQUIRED");
    const description = normalizeRequiredText(
      item.description,
      `${field}.description`,
      "DESCRIPTION_REQUIRED",
    );
    assertMaximumLength(name, TALENT_PROFILE_NAME_MAX_LENGTH, `${field}.name`, "NAME_TOO_LONG");
    assertMaximumLength(
      description,
      TALENT_PROFILE_DESCRIPTION_MAX_LENGTH,
      `${field}.description`,
      "DESCRIPTION_TOO_LONG",
    );

    const duplicateKey = name.toLowerCase();
    if (duplicateKeys.has(duplicateKey)) {
      throw new TalentRubricValidationError(
        "DUPLICATE_NAME",
        `${field}.name`,
        "must be unique after Unicode, whitespace, and case normalization",
      );
    }
    duplicateKeys.add(duplicateKey);

    const sourceWeight = item.weight === undefined ? 1 : item.weight;
    if (typeof sourceWeight !== "number" || !Number.isFinite(sourceWeight) || sourceWeight <= 0) {
      throw new TalentRubricValidationError(
        "WEIGHT_NOT_POSITIVE",
        `${field}.weight`,
        "must be a finite positive number when provided",
      );
    }

    return { name, description, sourceWeight };
  });
}

function normalizeRequiredText(
  value: unknown,
  field: string,
  code: "NAME_REQUIRED" | "DESCRIPTION_REQUIRED",
): string {
  if (typeof value !== "string") {
    throw new TalentRubricValidationError(code, field, "a non-empty string is required");
  }
  const normalized = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (normalized.length === 0) {
    throw new TalentRubricValidationError(code, field, "a non-empty string is required");
  }
  return normalized;
}

function assertMaximumLength(
  value: string,
  maximum: number,
  field: string,
  code: "NAME_TOO_LONG" | "DESCRIPTION_TOO_LONG",
): void {
  if ([...value].length > maximum) {
    throw new TalentRubricValidationError(code, field, `must contain at most ${maximum} characters`);
  }
}
