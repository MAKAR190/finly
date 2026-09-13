import {
  DEFAULT_CATEGORIES,
  DEFAULT_RULES,
  DEFAULT_SALARY_RULE,
  DEMO_INBOX,
  allocatePaycheck,
  type AllocationRule,
  type BankConnection,
  type Category,
  type Envelope,
  type MoneyTransaction,
  type SalaryRule,
  type TransactionStatus,
} from "@finly/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { createId } from "./ids";

export type PeriodRow = {
  id: string;
  startedAt: string;
  paycheckAmount: number;
};

type EnvelopeRow = Envelope & { periodId: string };

type StoreDoc = {
  categories: Category[];
  rules: AllocationRule[];
  periods: PeriodRow[];
  envelopes: EnvelopeRow[];
  transactions: MoneyTransaction[];
  salaryRule: SalaryRule;
  pendingSalaries: MoneyTransaction[];
  connection: BankConnection | null;
  apiUrl: string;
  seeded: boolean;
};

export type AppSnapshot = {
  categories: Category[];
  rules: AllocationRule[];
  period: PeriodRow | null;
  envelopes: Envelope[];
  transactions: MoneyTransaction[];
  salaryRule: SalaryRule;
  pendingSalaries: MoneyTransaction[];
  connection: BankConnection | null;
  apiUrl: string;
  seeded: boolean;
};

const STORAGE_KEY = "finly.store.v1";

const defaultApiUrl =
  Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001";

function emptyDoc(): StoreDoc {
  return {
    categories: [],
    rules: [],
    periods: [],
    envelopes: [],
    transactions: [],
    salaryRule: DEFAULT_SALARY_RULE,
    pendingSalaries: [],
    connection: null,
    apiUrl: defaultApiUrl,
    seeded: false,
  };
}

let memory: StoreDoc | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function readDoc(): Promise<StoreDoc> {
  if (memory) return memory;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  memory = raw ? (JSON.parse(raw) as StoreDoc) : emptyDoc();
  return memory;
}

async function writeDoc(next: StoreDoc): Promise<void> {
  memory = next;
  writeChain = writeChain.then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)));
  await writeChain;
}

async function updateDoc(mutator: (doc: StoreDoc) => void): Promise<StoreDoc> {
  const doc = JSON.parse(JSON.stringify(await readDoc())) as StoreDoc;
  mutator(doc);
  await writeDoc(doc);
  return doc;
}

function latestPeriod(doc: StoreDoc): PeriodRow | null {
  return [...doc.periods].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
}

function toSnapshot(doc: StoreDoc): AppSnapshot {
  const period = latestPeriod(doc);
  return {
    categories: [...doc.categories].sort((a, b) => a.sortOrder - b.sortOrder),
    rules: doc.rules,
    period,
    envelopes: period
      ? doc.envelopes
          .filter((item) => item.periodId === period.id)
          .map(({ categoryId, limitAmount }) => ({ categoryId, limitAmount }))
      : [],
    transactions: [...doc.transactions].sort((a, b) => b.bookedAt.localeCompare(a.bookedAt)),
    salaryRule: doc.salaryRule,
    pendingSalaries: doc.pendingSalaries,
    connection: doc.connection,
    apiUrl: doc.apiUrl,
    seeded: doc.seeded,
  };
}

export async function initDb() {
  await readDoc();
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  return toSnapshot(await readDoc());
}

export async function seedIfNeeded() {
  const current = await readDoc();
  if (current.seeded) return;

  await updateDoc((doc) => {
    doc.categories = DEFAULT_CATEGORIES.map((item) => ({ ...item }));
    doc.rules = DEFAULT_RULES.map((item) => ({ ...item }));
    doc.salaryRule = DEFAULT_SALARY_RULE;
    doc.apiUrl = defaultApiUrl;
    doc.pendingSalaries = [];
  });

  await applySalary(1_000_000, "Демо зарплата");

  const today = new Date();
  for (const item of DEMO_INBOX) {
    const date = new Date(today);
    date.setDate(today.getDate() - item.bookedAtOffsetDays);
    await insertTransaction({
      id: createId("tx"),
      amount: item.amount,
      currency: "PLN",
      bookedAt: date.toISOString().slice(0, 10),
      description: item.description,
      status: "inbox",
    });
  }

  await updateDoc((doc) => {
    doc.seeded = true;
  });
}

export async function applySalary(
  amount: number,
  description = "Зарплата",
  bookedAt = new Date().toISOString().slice(0, 10),
  bankTransactionId?: string,
) {
  const snapshot = await loadSnapshot();
  const periodId = createId("period");
  const { envelopes } = allocatePaycheck(amount, snapshot.rules);

  await updateDoc((doc) => {
    doc.periods.push({ id: periodId, startedAt: bookedAt, paycheckAmount: amount });
    for (const envelope of envelopes) {
      doc.envelopes.push({ periodId, ...envelope });
    }
    const salaryTx: MoneyTransaction = {
      id: createId("salary"),
      bankTransactionId,
      amount,
      currency: "PLN",
      bookedAt,
      description,
      status: "salary",
    };
    if (!salaryTx.bankTransactionId || !doc.transactions.some((tx) => tx.bankTransactionId === salaryTx.bankTransactionId)) {
      doc.transactions.push(salaryTx);
    }
  });
}

export async function reallocateCurrentPeriod() {
  const snapshot = await loadSnapshot();
  if (!snapshot.period) return;
  const { envelopes } = allocatePaycheck(snapshot.period.paycheckAmount, snapshot.rules);
  const periodId = snapshot.period.id;

  await updateDoc((doc) => {
    doc.envelopes = doc.envelopes.filter((item) => item.periodId !== periodId);
    for (const envelope of envelopes) {
      doc.envelopes.push({ periodId, ...envelope });
    }
  });
}

export async function insertTransaction(tx: MoneyTransaction) {
  await updateDoc((doc) => {
    if (doc.transactions.some((item) => item.id === tx.id)) return;
    if (tx.bankTransactionId && doc.transactions.some((item) => item.bankTransactionId === tx.bankTransactionId)) {
      return;
    }
    doc.transactions.push(tx);
  });
}

export async function assignTransaction(id: string, categoryId: string | null, status: TransactionStatus) {
  await updateDoc((doc) => {
    const tx = doc.transactions.find((item) => item.id === id);
    if (!tx) return;
    tx.categoryId = categoryId ?? undefined;
    tx.status = status;
  });
}

export async function addCategory(name: string, color: string) {
  const id = createId("cat");
  await updateDoc((doc) => {
    const sortOrder = doc.categories.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;
    doc.categories.push({ id, name, color, hidden: false, sortOrder });
    doc.rules.push({ categoryId: id, fixedAmount: 0, percent: 0 });
  });
  return id;
}

export async function updateCategory(category: Category) {
  await updateDoc((doc) => {
    const index = doc.categories.findIndex((item) => item.id === category.id);
    if (index >= 0) doc.categories[index] = category;
  });
}

export async function updateRule(rule: AllocationRule) {
  await updateDoc((doc) => {
    const index = doc.rules.findIndex((item) => item.categoryId === rule.categoryId);
    if (index >= 0) doc.rules[index] = rule;
    else doc.rules.push(rule);
  });
}

export async function saveSalaryRule(rule: SalaryRule) {
  await updateDoc((doc) => {
    doc.salaryRule = rule;
  });
}

export async function savePendingSalaries(items: MoneyTransaction[]) {
  await updateDoc((doc) => {
    doc.pendingSalaries = items;
  });
}

export async function saveConnection(connection: BankConnection | null) {
  await updateDoc((doc) => {
    doc.connection = connection;
  });
}

export async function saveApiUrl(url: string) {
  await updateDoc((doc) => {
    doc.apiUrl = url;
  });
}

export async function bankIdExists(bankTransactionId: string) {
  const doc = await readDoc();
  return doc.transactions.some((tx) => tx.bankTransactionId === bankTransactionId);
}
