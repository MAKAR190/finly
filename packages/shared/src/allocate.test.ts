import { allocatePaycheck } from "./allocate";
import { DEFAULT_RULES } from "./defaults";
import { looksLikeSalary } from "./salary";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const result = allocatePaycheck(1_000_000, DEFAULT_RULES);
const byId = Object.fromEntries(
  result.envelopes.map((envelope) => [envelope.categoryId, envelope.limitAmount]),
);

assert(result.leftover === 660_000, `leftover ${result.leftover}`);
assert(byId.rent === 320_000, `rent ${byId.rent}`);
assert(byId.subs === 20_000, `subs ${byId.subs}`);
assert(byId.food === 264_000, `food ${byId.food}`);
assert(byId.clothes === 66_000, `clothes ${byId.clothes}`);
assert(byId.out === 99_000, `out ${byId.out}`);
assert(byId.gifts === 33_000, `gifts ${byId.gifts}`);
assert(byId.save === 99_000, `save ${byId.save}`);
assert(byId.invest === 99_000, `invest ${byId.invest}`);

assert(
  looksLikeSalary(
    { amount: 1_000_000, description: "WYNAGRODZENIE ACME", isCredit: true },
    { keywords: ["wynagrodzenie"], autoConfirm: false },
  ),
  "salary keyword should match",
);

assert(
  !looksLikeSalary(
    { amount: 1_849, description: "ZAKUP BIEDRONKA", isCredit: false },
    { keywords: ["wynagrodzenie"], autoConfirm: false },
  ),
  "debit should not look like salary",
);

console.log("shared tests passed");
