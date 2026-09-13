import type { BankSyncTransaction, SalaryRule } from "./types";

function normalize(text: string): string {
  return text.toLocaleLowerCase("uk-UA").normalize("NFKD");
}

export function looksLikeSalary(
  tx: Pick<BankSyncTransaction, "amount" | "description" | "isCredit">,
  rule: SalaryRule,
): boolean {
  if (!tx.isCredit || tx.amount <= 0) return false;

  if (rule.minAmount != null && tx.amount < rule.minAmount) return false;
  if (rule.maxAmount != null && tx.amount > rule.maxAmount) return false;

  if (rule.keywords.length === 0) {
    return rule.minAmount != null || rule.maxAmount != null;
  }

  const haystack = normalize(tx.description);
  return rule.keywords.some((keyword) => haystack.includes(normalize(keyword)));
}
