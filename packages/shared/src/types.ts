export type TransactionStatus = "inbox" | "assigned" | "salary" | "ignored";

export type InstitutionChoice = "sandbox" | "pko";

export type Category = {
  id: string;
  name: string;
  color: string;
  hidden: boolean;
  sortOrder: number;
};

export type AllocationRule = {
  categoryId: string;
  /** Fixed reserve in grosze (1 PLN = 100). */
  fixedAmount: number;
  /** Share of leftover after all fixed amounts, 0–100. */
  percent: number;
};

export type Envelope = {
  categoryId: string;
  limitAmount: number;
};

export type BudgetPeriod = {
  id: string;
  startedAt: string;
  paycheckAmount: number;
  envelopes: Envelope[];
};

export type MoneyTransaction = {
  id: string;
  bankTransactionId?: string;
  amount: number;
  currency: string;
  bookedAt: string;
  description: string;
  status: TransactionStatus;
  categoryId?: string;
};

export type SalaryRule = {
  keywords: string[];
  minAmount?: number;
  maxAmount?: number;
  autoConfirm: boolean;
};

export type BankConnection = {
  requisitionId: string;
  institutionId: string;
  status: string;
  accountIds: string[];
  expiresAt?: string;
  link?: string;
};

export type BankSyncTransaction = {
  bankTransactionId: string;
  amount: number;
  currency: string;
  bookedAt: string;
  description: string;
  isCredit: boolean;
};

export type AllocateResult = {
  leftover: number;
  envelopes: Envelope[];
};

export const DEFAULT_CURRENCY = "PLN";

export const PKO_INSTITUTION_ID = "PKO_BPKOPLPW";
export const SANDBOX_INSTITUTION_ID = "SANDBOXFINANCE_SFIN0000";
