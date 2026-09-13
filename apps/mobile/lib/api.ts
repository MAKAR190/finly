import type { BankConnection, BankSyncTransaction, InstitutionChoice, SalaryRule } from "@finly/shared";

export type SyncedTransaction = BankSyncTransaction & { looksLikeSalary: boolean };

async function request<T>(apiUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `API ${response.status}`);
  }
  return data;
}

export function getHealth(apiUrl: string) {
  return request<{ ok: boolean }>(apiUrl, "/health");
}

export function connectBank(
  apiUrl: string,
  institution: InstitutionChoice,
  redirect: string,
) {
  return request<{ connection: BankConnection }>(apiUrl, "/bank/connect", {
    method: "POST",
    body: JSON.stringify({ institution, redirect }),
  });
}

export function syncBank(apiUrl: string, salaryRule: SalaryRule) {
  return request<{ connection: BankConnection; transactions: SyncedTransaction[] }>(
    apiUrl,
    "/bank/sync",
    {
      method: "POST",
      body: JSON.stringify({ salaryRule }),
    },
  );
}

export function disconnectBank(apiUrl: string) {
  return request<{ ok: boolean }>(apiUrl, "/bank/connection", { method: "DELETE" });
}
