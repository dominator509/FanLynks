export interface VariantAllocation {
  experimentId: string;
  variantId: string;
}

export function pickWeightedVariant(weights: Array<{ variantId: string; weight: number }>): string | null {
  const total = weights.reduce((sum, row) => sum + row.weight, 0);
  if (total <= 0) return null;
  const roll = Math.random() * total;
  let cursor = 0;
  for (const row of weights) {
    cursor += row.weight;
    if (roll <= cursor) return row.variantId;
  }
  return weights[weights.length - 1]?.variantId ?? null;
}
