import type { AllocateResult, AllocationRule, Envelope } from "./types";

export function percentTotal(rules: AllocationRule[]): number {
  return rules.reduce((sum, rule) => sum + rule.percent, 0);
}

export function allocatePaycheck(
  paycheckAmount: number,
  rules: AllocationRule[],
): AllocateResult {
  const totalFixed = rules.reduce((sum, rule) => sum + rule.fixedAmount, 0);
  const leftover = paycheckAmount - totalFixed;
  const allocatable = Math.max(leftover, 0);
  const percentSum = percentTotal(rules);
  const percentPool = Math.round((allocatable * Math.min(percentSum, 100)) / 100);

  const envelopes: Envelope[] = [];
  let distributedPercent = 0;

  const percentRules = rules.filter((rule) => rule.percent > 0);

  for (const rule of rules) {
    let fromPercent = 0;
    if (rule.percent > 0 && percentSum > 0 && allocatable > 0) {
      const isLast =
        percentRules[percentRules.length - 1]?.categoryId === rule.categoryId;
      if (isLast) {
        fromPercent = percentPool - distributedPercent;
      } else {
        fromPercent = Math.round((allocatable * rule.percent) / 100);
        distributedPercent += fromPercent;
      }
    }

    envelopes.push({
      categoryId: rule.categoryId,
      limitAmount: rule.fixedAmount + fromPercent,
    });
  }

  return { leftover, envelopes };
}

export function envelopeRemaining(
  limitAmount: number,
  assignedSpend: number,
): number {
  return limitAmount - assignedSpend;
}
