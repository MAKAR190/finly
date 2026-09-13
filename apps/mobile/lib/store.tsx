import {
  envelopeRemaining,
  looksLikeSalary,
  type AllocationRule,
  type BankConnection,
  type Category,
  type Envelope,
  type MoneyTransaction,
  type SalaryRule,
} from "@finly/shared";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as bankApi from "./api";
import * as db from "./db";
import { createId } from "./ids";

type BasketView = {
  category: Category;
  rule: AllocationRule;
  limitAmount: number;
  spent: number;
  remaining: number;
};

type Store = {
  ready: boolean;
  error: string | null;
  categories: Category[];
  rules: AllocationRule[];
  period: db.PeriodRow | null;
  envelopes: Envelope[];
  transactions: MoneyTransaction[];
  salaryRule: SalaryRule;
  pendingSalaries: MoneyTransaction[];
  connection: BankConnection | null;
  apiUrl: string;
  inbox: MoneyTransaction[];
  baskets: BasketView[];
  inboxCount: number;
  refresh: () => Promise<void>;
  applyManualSalary: (amount: number) => Promise<void>;
  confirmPendingSalary: (id: string) => Promise<void>;
  rejectPendingSalary: (id: string) => Promise<void>;
  assignToBasket: (txId: string, categoryId: string) => Promise<void>;
  returnToInbox: (txId: string) => Promise<void>;
  ignoreTx: (txId: string) => Promise<void>;
  addCategory: (name: string, color: string) => Promise<void>;
  toggleCategoryHidden: (id: string) => Promise<void>;
  updateRule: (rule: AllocationRule) => Promise<void>;
  saveSalaryRule: (rule: SalaryRule) => Promise<void>;
  saveApiUrl: (url: string) => Promise<void>;
  connectBank: (institution: "sandbox" | "pko") => Promise<BankConnection>;
  syncBank: () => Promise<{ added: number; pendingSalary: number }>;
  disconnectBank: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<db.AppSnapshot | null>(null);

  const refresh = async () => {
    const next = await db.loadSnapshot();
    setSnapshot(next);
  };

  useEffect(() => {
    (async () => {
      try {
        await db.initDb();
        await db.seedIfNeeded();
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не вдалося відкрити базу");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo<Store>(() => {
    const categories = snapshot?.categories ?? [];
    const rules = snapshot?.rules ?? [];
    const period = snapshot?.period ?? null;
    const envelopes = snapshot?.envelopes ?? [];
    const transactions = snapshot?.transactions ?? [];
    const salaryRule = snapshot?.salaryRule ?? { keywords: [], autoConfirm: false };
    const pendingSalaries = snapshot?.pendingSalaries ?? [];
    const connection = snapshot?.connection ?? null;
    const apiUrl = snapshot?.apiUrl ?? "";

    const inbox = transactions.filter((tx) => tx.status === "inbox");
    const ruleById = Object.fromEntries(rules.map((rule) => [rule.categoryId, rule]));
    const limitById = Object.fromEntries(
      envelopes.map((envelope) => [envelope.categoryId, envelope.limitAmount]),
    );

    const spentById: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.status !== "assigned" || !tx.categoryId) continue;
      if (period && tx.bookedAt < period.startedAt) continue;
      spentById[tx.categoryId] = (spentById[tx.categoryId] ?? 0) + Math.abs(tx.amount);
    }

    const baskets: BasketView[] = categories
      .filter((category) => !category.hidden)
      .map((category) => {
        const limitAmount = limitById[category.id] ?? 0;
        const spent = spentById[category.id] ?? 0;
        return {
          category,
          rule: ruleById[category.id] ?? { categoryId: category.id, fixedAmount: 0, percent: 0 },
          limitAmount,
          spent,
          remaining: envelopeRemaining(limitAmount, spent),
        };
      });

    return {
      ready,
      error,
      categories,
      rules,
      period,
      envelopes,
      transactions,
      salaryRule,
      pendingSalaries,
      connection,
      apiUrl,
      inbox,
      baskets,
      inboxCount: inbox.length,
      refresh,
      applyManualSalary: async (amount) => {
        await db.applySalary(amount, "Ручна зарплата");
        await refresh();
      },
      confirmPendingSalary: async (id) => {
        const item = pendingSalaries.find((tx) => tx.id === id);
        if (!item) return;
        await db.applySalary(item.amount, item.description, item.bookedAt, item.bankTransactionId);
        await db.savePendingSalaries(pendingSalaries.filter((tx) => tx.id !== id));
        await refresh();
      },
      rejectPendingSalary: async (id) => {
        await db.savePendingSalaries(pendingSalaries.filter((tx) => tx.id !== id));
        await refresh();
      },
      assignToBasket: async (txId, categoryId) => {
        await db.assignTransaction(txId, categoryId, "assigned");
        await refresh();
      },
      returnToInbox: async (txId) => {
        await db.assignTransaction(txId, null, "inbox");
        await refresh();
      },
      ignoreTx: async (txId) => {
        await db.assignTransaction(txId, null, "ignored");
        await refresh();
      },
      addCategory: async (name, color) => {
        await db.addCategory(name, color);
        await db.reallocateCurrentPeriod();
        await refresh();
      },
      toggleCategoryHidden: async (id) => {
        const category = categories.find((item) => item.id === id);
        if (!category) return;
        await db.updateCategory({ ...category, hidden: !category.hidden });
        await refresh();
      },
      updateRule: async (rule) => {
        await db.updateRule(rule);
        await db.reallocateCurrentPeriod();
        await refresh();
      },
      saveSalaryRule: async (rule) => {
        await db.saveSalaryRule(rule);
        await refresh();
      },
      saveApiUrl: async (url) => {
        await db.saveApiUrl(url);
        await refresh();
      },
      connectBank: async (institution) => {
        const Linking = await import("expo-linking");
        const redirect = Linking.createURL("bank/callback");
        const result = await bankApi.connectBank(apiUrl, institution, redirect);
        await db.saveConnection(result.connection);
        await refresh();
        return result.connection;
      },
      syncBank: async () => {
        const result = await bankApi.syncBank(apiUrl, salaryRule);
        await db.saveConnection(result.connection);

        let added = 0;
        const pending = [...pendingSalaries];

        for (const tx of result.transactions) {
          if (await db.bankIdExists(tx.bankTransactionId)) continue;

          if (tx.isCredit) {
            const candidate: MoneyTransaction = {
              id: createId("sal"),
              bankTransactionId: tx.bankTransactionId,
              amount: tx.amount,
              currency: tx.currency,
              bookedAt: tx.bookedAt,
              description: tx.description,
              status: "salary",
            };
            const match = tx.looksLikeSalary || looksLikeSalary(tx, salaryRule);
            if (!match) continue;
            if (salaryRule.autoConfirm) {
              await db.applySalary(
                candidate.amount,
                candidate.description,
                candidate.bookedAt,
                candidate.bankTransactionId,
              );
            } else if (!pending.some((item) => item.bankTransactionId === tx.bankTransactionId)) {
              pending.push(candidate);
            }
            continue;
          }

          await db.insertTransaction({
            id: createId("tx"),
            bankTransactionId: tx.bankTransactionId,
            amount: -Math.abs(tx.amount),
            currency: tx.currency,
            bookedAt: tx.bookedAt,
            description: tx.description,
            status: "inbox",
          });
          added += 1;
        }

        await db.savePendingSalaries(pending);
        await refresh();
        return { added, pendingSalary: pending.length };
      },
      disconnectBank: async () => {
        try {
          await bankApi.disconnectBank(apiUrl);
        } catch {
          // local disconnect still useful without API
        }
        await db.saveConnection(null);
        await refresh();
      },
    };
  }, [error, ready, snapshot]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore outside provider");
  return store;
}
