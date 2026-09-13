import {
  PKO_INSTITUTION_ID,
  SANDBOX_INSTITUTION_ID,
  type BankSyncTransaction,
  type InstitutionChoice,
} from "@finly/shared";

const GC_BASE = "https://bankaccountdata.gocardless.com/api/v2";

type TokenResponse = {
  access: string;
  access_expires: number;
  refresh: string;
  refresh_expires: number;
};

type Requisition = {
  id: string;
  status: string;
  link: string;
  accounts: string[];
  institution_id: string;
  agreement?: string;
};

type GcTransaction = {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  debtorName?: string;
  creditorName?: string;
  transactionAmount?: { amount?: string; currency?: string };
};

let cachedToken:
  | { access: string; expiresAt: number }
  | undefined;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy apps/api/.env.example to .env`);
  }
  return value;
}

function institutionId(choice: InstitutionChoice): string {
  return choice === "pko" ? PKO_INSTITUTION_ID : SANDBOX_INSTITUTION_ID;
}

async function gcFetch<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${GC_BASE}${path}`, { ...init, headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GoCardless ${path} ${response.status}: ${text.slice(0, 400)}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.access;
  }

  const token = await gcFetch<TokenResponse>("/token/new/", {
    method: "POST",
    body: JSON.stringify({
      secret_id: requiredEnv("GC_SECRET_ID"),
      secret_key: requiredEnv("GC_SECRET_KEY"),
    }),
  });

  cachedToken = {
    access: token.access,
    expiresAt: Date.now() + token.access_expires * 1000,
  };
  return token.access;
}

export async function createRequisition(choice: InstitutionChoice, redirect: string) {
  const token = await getAccessToken();
  const institution_id = institutionId(choice);

  const agreement = await gcFetch<{ id: string }>("/agreements/enduser/", {
    method: "POST",
    token,
    body: JSON.stringify({
      institution_id,
      max_historical_days: 90,
      access_valid_for_days: 90,
      access_scope: ["balances", "details", "transactions"],
    }),
  });

  const requisition = await gcFetch<Requisition>("/requisitions/", {
    method: "POST",
    token,
    body: JSON.stringify({
      redirect,
      institution_id,
      agreement: agreement.id,
      reference: `finly-${choice}-${Date.now()}`,
      user_language: "PL",
    }),
  });

  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  return {
    requisitionId: requisition.id,
    institutionId: institution_id,
    status: requisition.status,
    accountIds: requisition.accounts ?? [],
    link: requisition.link,
    expiresAt,
  };
}

export async function getRequisition(id: string): Promise<Requisition> {
  const token = await getAccessToken();
  return gcFetch<Requisition>(`/requisitions/${id}/`, { token });
}

function txId(tx: GcTransaction, index: number): string {
  return tx.transactionId || tx.internalTransactionId || `gc-${tx.bookingDate}-${index}`;
}

function descriptionOf(tx: GcTransaction): string {
  const parts = [
    tx.remittanceInformationUnstructured,
    ...(tx.remittanceInformationUnstructuredArray ?? []),
    tx.creditorName,
    tx.debtorName,
  ].filter(Boolean);
  return [...new Set(parts)].join(" · ") || "Transakcja";
}

function toGrosze(amount: string | undefined): number {
  if (!amount) return 0;
  return Math.round(Number(amount) * 100);
}

export async function fetchAccountTransactions(
  accountId: string,
): Promise<BankSyncTransaction[]> {
  const token = await getAccessToken();
  const payload = await gcFetch<{
    transactions?: { booked?: GcTransaction[]; pending?: GcTransaction[] };
  }>(`/accounts/${accountId}/transactions/`, { token });

  const booked = payload.transactions?.booked ?? [];
  return booked.map((tx, index) => {
    const raw = toGrosze(tx.transactionAmount?.amount);
    return {
      bankTransactionId: `${accountId}:${txId(tx, index)}`,
      amount: Math.abs(raw),
      currency: tx.transactionAmount?.currency ?? "PLN",
      bookedAt: tx.bookingDate || tx.valueDate || new Date().toISOString().slice(0, 10),
      description: descriptionOf(tx),
      isCredit: raw > 0,
    };
  });
}

export async function fetchAccountBalances(accountId: string) {
  const token = await getAccessToken();
  return gcFetch<unknown>(`/accounts/${accountId}/balances/`, { token });
}
