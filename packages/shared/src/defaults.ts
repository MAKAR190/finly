import type { AllocationRule, Category, SalaryRule } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "food", name: "Їжа", color: "#E85D4C", hidden: false, sortOrder: 0 },
  { id: "rent", name: "Оренда", color: "#5B8DEF", hidden: false, sortOrder: 1 },
  { id: "subs", name: "Підписки", color: "#8B7CF6", hidden: false, sortOrder: 2 },
  { id: "clothes", name: "Одяг", color: "#F2A65A", hidden: false, sortOrder: 3 },
  { id: "out", name: "Гуляти", color: "#E85D9A", hidden: false, sortOrder: 4 },
  { id: "gifts", name: "Подарунки", color: "#3DCFB6", hidden: false, sortOrder: 5 },
  { id: "save", name: "Сейв", color: "#3D9B6C", hidden: false, sortOrder: 6 },
  { id: "invest", name: "Інвестиції", color: "#2C6EAD", hidden: false, sortOrder: 7 },
];

/** Example from the plan: 10 000 zł paycheck. */
export const DEFAULT_RULES: AllocationRule[] = [
  { categoryId: "food", fixedAmount: 0, percent: 40 },
  { categoryId: "rent", fixedAmount: 320_000, percent: 0 },
  { categoryId: "subs", fixedAmount: 20_000, percent: 0 },
  { categoryId: "clothes", fixedAmount: 0, percent: 10 },
  { categoryId: "out", fixedAmount: 0, percent: 15 },
  { categoryId: "gifts", fixedAmount: 0, percent: 5 },
  { categoryId: "save", fixedAmount: 0, percent: 15 },
  { categoryId: "invest", fixedAmount: 0, percent: 15 },
];

export const DEFAULT_SALARY_RULE: SalaryRule = {
  keywords: ["wynagrodzenie", "salary", "pensja", "зарплата", "зп"],
  autoConfirm: false,
};

export const DEMO_INBOX = [
  {
    description: "ZAKUP BIEDRONKA POZNAN",
    amount: -18_490,
    bookedAtOffsetDays: 0,
  },
  {
    description: "LIDL SP Z O O",
    amount: -6_299,
    bookedAtOffsetDays: 1,
  },
  {
    description: "NETFLIX.COM",
    amount: -4_300,
    bookedAtOffsetDays: 2,
  },
  {
    description: "ZARA POZNAN STARY BROWAR",
    amount: -21_999,
    bookedAtOffsetDays: 3,
  },
  {
    description: "RESTAURACJA NOWA",
    amount: -8_750,
    bookedAtOffsetDays: 3,
  },
];
