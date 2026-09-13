import { createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";
import type { BankConnection, BankSyncTransaction, InstitutionChoice } from "@finly/shared";

const EB_BASE = "https://api.enablebanking.com";
const DEFAULT_REDIRECT = "https://makar190.github.io/finly/bank-callback.html";

type EbAccount = { uid?: string; account_id?: { identification?: string } };
type EbTransaction = {
  entry_reference?: string;
  transaction_id?: string;
  booking_date?: string;
  value_date?: string;
  transaction_date?: string;
  remittance_information?: string[];
  credit_debit_indicator?: "CRDT" | "DBIT";
  transaction_amount?: { amount?: string; currency?: string };
  creditor?: { name?: string };
  debtor?: { name?: string };
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy apps/api/.env.example to .env`);
  return value;
}

function privateKeyPem(): string {
  const fromFile = process.env.EB_PRIVATE_KEY_PATH;
  if (fromFile) return readFileSync(fromFile, "utf8");
  const raw = requiredEnv("EB_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (raw.includes("BEGIN")) return raw;
  return `-----BEGIN PRIVATE KEY-----\n${raw}\n-----END PRIVATE KEY-----\n`;
}

async function appJwt(): Promise<string> {
  const appId = requiredEnv("EB_APP_ID");
  const pem = privateKeyPem();
  createPrivateKey(pem);
  const key = await importPKCS8(pem, "RS256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: appId })
    .setIssuer("enablebanking.com")
    .setAudience("api.enablebanking.com")
    .setIssuedAt()
    .setExpirationTime("50m")
    .sign(key);
}

async function ebFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("authorization", `Bearer ${await appJwt()}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const response = await fetch(`${EB_BASE}${path}`, { ...init, headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Enable Banking ${path} ${response.status}: ${text.slice(0, 400)}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function resolveAspsp(choice: InstitutionChoice) {
  if (choice !== "pko") {
    return { name: "Mock ASPSP", country: "FI" };
  }

  const data = await ebFetch<{ aspsps?: { name: string; country: string }[] }>("/aspsps?country=PL");
  const match = data.aspsps?.find((item) => /pko/i.test(item.name));
  return match ?? { name: "PKO Bank Polski", country: "PL" };
}

export function defaultRedirect(): string {
  return process.env.APP_REDIRECT || DEFAULT_REDIRECT;
}

export async function startAuthorization(choice: InstitutionChoice): Promise<BankConnection> {
  const aspsp = await resolveAspsp(choice);
  const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const started = await ebFetch<{ url: string; authorization_id: string }>("/auth", {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: validUntil },
      aspsp,
      state: crypto.randomUUID(),
      redirect_url: defaultRedirect(),
      psu_type: "personal",
      language: "pl",
    }),
  });

  return {
    requisitionId: started.authorization_id,
    sessionId: undefined,
    institutionId: `${aspsp.country}:${aspsp.name}`,
    status: "pending",
    accountIds: [],
    link: started.url,
    expiresAt: validUntil,
  };
}

export async function createSession(code: string, current: BankConnection | null): Promise<BankConnection> {
  const session = await ebFetch<{
    session_id?: string;
    accounts?: EbAccount[];
    access?: { valid_until?: string };
  }>("/sessions", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

  const accountIds = (session.accounts ?? [])
    .map((account) => account.uid)
    .filter((id): id is string => Boolean(id));

  return {
    requisitionId: session.session_id || current?.requisitionId || "session",
    sessionId: session.session_id,
    institutionId: current?.institutionId ?? "PL:PKO Bank Polski",
    status: "active",
    accountIds,
    expiresAt: session.access?.valid_until ?? current?.expiresAt,
  };
}

function descriptionOf(tx: EbTransaction): string {
  const parts = [
    ...(tx.remittance_information ?? []),
    tx.creditor?.name,
    tx.debtor?.name,
  ].filter(Boolean);
  return [...new Set(parts)].join(" · ") || "Transakcja";
}

export async function fetchAccountTransactions(accountId: string): Promise<BankSyncTransaction[]> {
  const payload = await ebFetch<{ transactions?: EbTransaction[] }>(
    `/accounts/${accountId}/transactions`,
  );
  return (payload.transactions ?? []).map((tx, index) => {
    const raw = Math.round(Number(tx.transaction_amount?.amount ?? 0) * 100);
    const isCredit = tx.credit_debit_indicator === "CRDT";
    const id = tx.entry_reference || tx.transaction_id || `eb-${tx.booking_date}-${index}`;
    return {
      bankTransactionId: `${accountId}:${id}`,
      amount: Math.abs(raw),
      currency: tx.transaction_amount?.currency ?? "PLN",
      bookedAt: tx.booking_date || tx.value_date || tx.transaction_date || new Date().toISOString().slice(0, 10),
      description: descriptionOf(tx),
      isCredit,
    };
  });
}

export async function fetchAccountBalances(accountId: string) {
  return ebFetch<unknown>(`/accounts/${accountId}/balances`);
}

export async function verifyCredentials() {
  const data = await ebFetch<{ aspsps?: unknown[] }>("/aspsps?country=PL");
  return { ok: true, banks: data.aspsps?.length ?? 0 };
}
