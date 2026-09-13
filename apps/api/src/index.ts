import { serve } from "@hono/node-server";
import { looksLikeSalary, type InstitutionChoice, type SalaryRule } from "@finly/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSession,
  defaultRedirect,
  fetchAccountBalances,
  fetchAccountTransactions,
  startAuthorization,
  verifyCredentials,
} from "./enablebanking";
import { loadEnv } from "./env";
import { clearConnection, loadConnection, saveConnection } from "./store";

loadEnv();

const app = new Hono();
app.use("/*", cors());

const publicDir = path.join(fileURLToPath(new URL(".", import.meta.url)), "../public");

async function legalPage(file: string) {
  return readFile(path.join(publicDir, file), "utf8");
}

app.get("/health", async (c) => {
  try {
    const bank = await verifyCredentials();
    return c.json({ ok: true, service: "finly-api", bank });
  } catch (error) {
    const message = error instanceof Error ? error.message : "bank auth failed";
    return c.json({ ok: true, service: "finly-api", bank: { ok: false, error: message } });
  }
});

app.get("/privacy", async (c) => c.html(await legalPage("privacy.html")));
app.get("/privacy.html", async (c) => c.html(await legalPage("privacy.html")));
app.get("/terms", async (c) => c.html(await legalPage("terms.html")));
app.get("/terms.html", async (c) => c.html(await legalPage("terms.html")));

app.get("/bank/connection", async (c) => {
  return c.json({ connection: await loadConnection(), redirect: defaultRedirect() });
});

app.delete("/bank/connection", async (c) => {
  await clearConnection();
  return c.json({ ok: true });
});

app.post("/bank/connect", async (c) => {
  const body = await c.req
    .json<{ institution?: InstitutionChoice }>()
    .catch(() => ({ institution: undefined }));
  const institution: InstitutionChoice = body.institution === "sandbox" ? "sandbox" : "pko";

  try {
    const connection = await startAuthorization(institution);
    await saveConnection(connection);
    return c.json({ connection });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connect failed";
    return c.json({ error: message }, 400);
  }
});

app.post("/bank/sync", async (c) => {
  const body = await c.req
    .json<{ salaryRule?: SalaryRule; code?: string }>()
    .catch(() => ({ salaryRule: undefined, code: undefined }));

  try {
    let connection = await loadConnection();
    if (body.code) {
      connection = await createSession(body.code, connection);
      await saveConnection(connection);
    }
    if (!connection?.sessionId && !connection?.accountIds.length) {
      return c.json({ error: "Банк ще не підключено. Пройди згоду в IKO." }, 400);
    }

    const accountIds = connection.accountIds;
    const transactions = [];
    for (const accountId of accountIds) {
      transactions.push(...(await fetchAccountTransactions(accountId)));
    }

    const salaryRule = body.salaryRule ?? {
      keywords: ["wynagrodzenie", "salary", "pensja", "зарплата", "зп"],
      autoConfirm: false,
    };

    return c.json({
      connection,
      transactions: transactions.map((tx) => ({
        ...tx,
        looksLikeSalary: looksLikeSalary(tx, salaryRule),
      })),
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
