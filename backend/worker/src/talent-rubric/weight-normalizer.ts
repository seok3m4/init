export function normalizeTalentWeights(weights: readonly number[]): number[] {
  if (weights.length === 0) {
    throw new RangeError("weights must not be empty");
  }
  if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
    throw new RangeError("weights must contain only finite positive numbers");
  }

  const decimals = weights.map(toDecimalInteger);
  const commonExponent = Math.min(...decimals.map((decimal) => decimal.exponent));
  const integerWeights = decimals.map(
    (decimal) => decimal.significand * (10n ** BigInt(decimal.exponent - commonExponent)),
  );
  const totalWeight = integerWeights.reduce((sum, weight) => sum + weight, 0n);
  const allocations = integerWeights.map((weight, index) => {
    const numerator = weight * 100n;
    return {
      index,
      points: Number(numerator / totalWeight),
      remainder: numerator % totalWeight,
    };
  });

  const unassignedPoints = 100 - allocations.reduce((sum, allocation) => sum + allocation.points, 0);
  const remainderOrder = [...allocations].sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });
  for (let index = 0; index < unassignedPoints; index += 1) {
    const allocation = remainderOrder[index];
    if (!allocation) throw new Error("largest-remainder allocation invariant failed");
    allocation.points += 1;
  }

  ensurePositiveAllocations(allocations);

  return allocations.map((allocation) => allocation.points);
}

function ensurePositiveAllocations(
  allocations: Array<{ index: number; points: number; remainder: bigint }>,
): void {
  for (const allocation of allocations) {
    if (allocation.points > 0) continue;

    const donor = allocations
      .filter((candidate) => candidate.points > 1)
      .sort((left, right) => right.points - left.points || left.index - right.index)[0];
    if (!donor) throw new Error("positive weight allocation invariant failed");

    allocation.points = 1;
    donor.points -= 1;
  }
}

interface DecimalInteger {
  readonly significand: bigint;
  readonly exponent: number;
}

function toDecimalInteger(value: number): DecimalInteger {
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/u.exec(value.toString());
  if (!match) throw new RangeError(`unsupported weight: ${value}`);

  const integerPart = match[1] ?? "";
  const fractionalPart = match[2] ?? "";
  const scientificExponent = Number(match[3] ?? 0);
  return {
    significand: BigInt(integerPart + fractionalPart),
    exponent: scientificExponent - fractionalPart.length,
  };
}
