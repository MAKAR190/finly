import { serve } from "@hono/node-server";
import {
  looksLikeSalary,
  type InstitutionChoice,
  type SalaryRule,
} from "@finly/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env";
import {
  createRequisition,
  fetchAccountBalances,
  fetchAccountTransactions,
  getRequisition,
} from "./gocardless";
import { clearConnection, loadConnection, saveConnection } from "./store";

loadEnv();

const app = new Hono();
app.use("/*", cors());

const publicDir = path.join(fileURLToPath(new URL(".", import.meta.url)), "../public");

async function legalPage(file: string) {
  return readFile(path.join(publicDir, file), "utf8");
}

app.get("/health", (c) => c.json({ ok: true, service: "finly-api" }));

app.get("/privacy", async (c) => c.html(await legalPage("privacy.html")));
app.get("/privacy.html", async (c) => c.html(await legalPage("privacy.html")));
app.get("/terms", async (c) => c.html(await legalPage("terms.html")));
app.get("/terms.html", async (c) => c.html(await legalPage("terms.html")));

app.get("/bank/connection", async (c) => {
  return c.json({ connection: await loadConnection() });
});

app.delete("/bank/connection", async (c) => {
  await clearConnection();
  return c.json({ ok: true });
});

app.post("/bank/connect", async (c) => {
  const body = await c.req
    .json<{ institution?: InstitutionChoice; redirect?: string }>()
    .catch(() => ({ institution: undefined, redirect: undefined }));
  const institution: InstitutionChoice = body.institution === "pko" ? "pko" : "sandbox";
  const redirect = body.redirect || process.env.APP_REDIRECT || "finly://bank/callback";

  try {
    const connection = await createRequisition(institution, redirect);
    await saveConnection(connection);
    return c.json({ connection });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connect failed";
    return c.json({ error: message }, 400);
  }
});

app.post("/bank/sync", async (c) => {
  const existing = await loadConnection();
  if (!existing) {
    return c.json({ error: "Банк ще не підключено" }, 400);
  }

  const body = await c.req
    .json<{ salaryRule?: SalaryRule }>()
    .catch(() => ({ salaryRule: undefined }));

  try {
    const requisition = await getRequisition(existing.requisitionId);
    const accountIds = requisition.accounts ?? [];
    const updated = {
      ...existing,
      status: requisition.status,
      accountIds,
    };
    await saveConnection(updated);

    const transactions = [];
    for (const accountId of accountIds) {
      transactions.push(...(await fetchAccountTransactions(accountId)));
    }

    const salaryRule = body.salaryRule ?? {
      keywords: ["wynagrodzenie", "salary", "pensja", "зарплата", "зп"],
      autoConfirm: false,
    };

    const mapped = transactions.map((tx) => ({
      ...tx,
      looksLikeSalary: looksLikeSalary(tx, salaryRule),
    }));

    return c.json({
      connection: updated,
      transactions: mapped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return c.json({ error: message }, 400);
  }
});

app.get("/bank/accounts/:id/balances", async (c) => {
  try {
    return c.json(await fetchAccountBalances(c.req.param("id")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Balances failed";
    return c.json({ error: message }, 400);
  }
});

const port = Number(process.env.PORT || 3001);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`finly api http://localhost:${info.port}`);
});
