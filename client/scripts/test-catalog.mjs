import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
}
const catalog = load("../src/lib/catalog.ts");
const { evaluate, matches } = load("../src/lib/recommendations.ts", {
  "./catalog": catalog,
});
const {
  monthlyValue,
  monthlyCash,
  estimatePayment,
  financingGuidance,
  financialDraft,
} = load("../src/lib/financing-guidance.ts");
const product = (code) => catalog.PRODUCTS.find((p) => p.id === code);
const eligible = (a) =>
  matches(a)
    .filter((r) => !r.excluded.length)
    .map((r) => r.product.id);
assert.equal(catalog.PRODUCTS.length, 13);
const exampleA = {
  purpose: "equipment",
  usage: "stages",
  amount: "3000000",
  term: "36",
  age: "old",
  collateral: "no",
};
assert.equal(eligible(exampleA).join(","), "K1");
assert.ok(
  evaluate(product("K1"), exampleA).alternatives.length > 0,
  "Single disbursement must be explained as a compromise",
);
const exampleB = {
  purpose: "operations",
  usage: "revolving",
  amount: "700000",
  term: "6",
  age: "new",
  collateral: "no",
};
assert.ok(eligible(exampleB).includes("A1"));
assert.ok(
  evaluate(product("L1"), exampleB).pending.length > 0,
  "Unknown age eligibility needs verification, not an automatic rejection",
);
const exampleC = {
  purpose: "refi",
  amount: "4000000",
  term: "36",
  age: "old",
  collateral: "yes",
  refi_type: "od",
};
assert.equal(eligible(exampleC).length, 0);
assert.equal(
  evaluate(product("T1"), {
    purpose: "auto",
    amount: "5000000",
    term: "60",
    collateral: "no",
    asset: "yes",
  }).excluded.length,
  0,
);
assert.ok(
  evaluate(product("T1"), { purpose: "auto", asset: "no" }).excluded.length > 0,
);
assert.equal(
  evaluate(product("K1"), { purpose: "other", inferredPurpose: "property" })
    .excluded.length,
  0,
  "Unconfirmed model output must not silently filter",
);
assert.ok(
  evaluate(product("K1"), { purpose: "other", confirmedPurpose: "property" })
    .excluded.length > 0,
);
assert.equal(
  evaluate(product("L1"), { purpose: "operations", term: "12" }).excluded
    .length,
  0,
);
assert.ok(
  evaluate(product("L1"), { purpose: "operations", term: "12" }).pending.some(
    (x) => x.includes("подписки"),
  ),
);
assert.ok(
  evaluate(product("L2"), { purpose: "operations", term: "12" }).excluded
    .length > 0,
  "Line duration cannot replace tranche duration",
);
assert.equal(
  evaluate(product("C1"), { purpose: "operations", term: "180" }).excluded
    .length,
  0,
  "Unknown card credit term is not an invented hard limit",
);
assert.equal(
  evaluate(product("K1"), { purpose: "operations", repay: "season" }).excluded
    .length,
  0,
);
// A procurement cycle is a real business fact, not the term of an equipment loan.
assert.equal(
  evaluate(product("K1"), { purpose: "operations", cashCycle: "1" }).excluded
    .length,
  0,
);
assert.ok(
  evaluate(product("L2"), { purpose: "operations", cashCycle: "12" }).excluded
    .length > 0,
);
assert.equal(
  evaluate(product("L1"), { purpose: "operations", cashCycle: "12" }).excluded
    .length,
  0,
);
assert.ok(
  evaluate(product("L1"), {
    purpose: "operations",
    cashCycle: "12",
  }).pending.some((x) => x.includes("подписки")),
);
assert.equal(
  evaluate(product("L2"), { purpose: "operations", cashCycle: "unknown" })
    .excluded.length,
  0,
);
assert.ok(
  evaluate(product("L2"), {
    purpose: "operations",
    cashCycle: "unknown",
  }).pending.some((x) => x.includes("каждой")),
);
assert.equal(
  evaluate(product("N1"), {
    purpose: "property",
    amount: "5000000",
    age: "unknown",
    collateral: "no",
    asset: "yes",
  }).excluded.length,
  0,
);
assert.ok(
  evaluate(product("N1"), { purpose: "property", age: "new" }).excluded.length >
    0,
);
assert.ok(
  evaluate(product("K2"), { purpose: "equipment", amount: "499999" }).excluded
    .length > 0,
);
assert.equal(
  evaluate(product("T1"), { purpose: "auto", amount: "100", asset: "yes" })
    .excluded.length,
  0,
  "An unpublished minimum cannot be invented",
);
assert.ok(
  evaluate(product("T1"), { purpose: "auto", amount: "50000001" }).excluded
    .length > 0,
);

// Blank / invalid financial data is unknown. An explicit zero remains a zero.
for (const value of [
  undefined,
  "",
  " ",
  "-1",
  "NaN",
  "Infinity",
  "1000000000001",
])
  assert.equal(monthlyValue(value), null);
assert.equal(monthlyValue("0"), 0);
assert.equal(monthlyValue("125000.5"), 125000.5);
const finance = {
  monthlyRevenue: "1000000",
  monthlyExpenses: "600000",
  currentDebtLoad: "100000",
};
assert.equal(
  monthlyCash(finance).freeCashFlow,
  300000,
  "Existing debt is deducted once after operating costs",
);
assert.equal(
  monthlyCash(finance).paymentBudget,
  150000,
  "Half the remaining cash is an explicit illustration reserve",
);
assert.equal(
  monthlyCash({ ...finance, currentDebtLoad: "" }).freeCashFlow,
  null,
  "Unknown existing payments must not silently become zero",
);
assert.equal(
  monthlyCash({
    monthlyRevenue: "0",
    monthlyExpenses: "0",
    currentDebtLoad: "0",
  }).freeCashFlow,
  0,
);
assert.equal(
  monthlyCash({ ...finance, monthlyExpenses: "1000000" }).paymentBudget,
  null,
);
assert.equal(estimatePayment(120000, 12, 0), 10000);
assert.equal(estimatePayment(120000, 0), null);
assert.equal(estimatePayment(NaN, 12), null);
const suggestion = financingGuidance(product("K1"), 3000000, finance);
assert.ok(
  suggestion.suggestedTermMonths >= product("K1").minm &&
    suggestion.suggestedTermMonths <= product("K1").maxm,
);
assert.ok(suggestion.monthlyPayment <= suggestion.paymentBudget);
assert.ok(
  suggestion.note.includes("21,5%") &&
    suggestion.note.includes("не требование"),
  "Show assumptions alongside a suggested term",
);
assert.equal(
  financingGuidance(product("K1"), 3000000, {}).suggestedTermMonths,
  null,
);
assert.equal(
  financingGuidance(product("K1"), 3000000, { ...finance, currentDebtLoad: "" })
    .monthlyPayment,
  null,
);
assert.equal(
  financingGuidance(product("K1"), 3000000, {
    ...finance,
    monthlyRevenue: "100000",
  }).suggestedTermMonths,
  null,
);
assert.equal(
  financingGuidance(product("K1"), 30000000, {
    monthlyRevenue: "10000",
    monthlyExpenses: "0",
    currentDebtLoad: "0",
  }).suggestedTermMonths,
  null,
  "Do not offer an invented longer term when the product maximum is insufficient",
);
assert.equal(
  financingGuidance(product("L3"), 3000000, finance).kind,
  "project-line",
);
assert.equal(
  financingGuidance(product("L3"), 3000000, finance).monthlyPayment,
  null,
  "A staged drawdown is not an annuity loan",
);
assert.equal(
  financingGuidance(product("C1"), 500000, finance).monthlyPayment,
  null,
);
assert.equal(
  financingGuidance(product("L1"), 500000, { ...finance, cashCycle: "6" })
    .suggestedTermMonths,
  6,
);
assert.equal(
  financingGuidance(product("L2"), 500000, { ...finance, cashCycle: "12" })
    .suggestedTermMonths,
  null,
);
assert.equal(
  financingGuidance(product("O1"), 500000, { ...finance, cashCycle: "unknown" })
    .suggestedTermMonths,
  null,
);

// Preliminary routing does not turn low revenue into a credit rejection.
const routing = {
  purpose: "operations",
  amount: "700000",
  age: "old",
  collateral: "no",
  frequency: "repeat",
  cashCycle: "6",
};
const normal = eligible({ ...routing, ...finance }).join(",");
assert.equal(
  eligible({
    ...routing,
    monthlyRevenue: "100",
    monthlyExpenses: "1000",
    currentDebtLoad: "500",
  }).join(","),
  normal,
);
assert.equal(eligible(routing).join(","), normal);
assert.equal(financialDraft({}).monthlyRevenue, "");
assert.equal(financialDraft({}).currentDebtLoad, "");
assert.equal(
  financialDraft({ ...finance, currentDebtLoad: "0" }).currentDebtLoad,
  "0",
);
assert.equal(financialDraft(finance).monthlyRevenue, "1000000");
assert.equal(financialDraft({ monthlyRevenue: "-100" }).monthlyRevenue, "");
console.log(
  "PASS: product routing and financial guidance (PDF examples, unknowns, separate procurement cycle, no finance rejection, bounded payment illustration, draft transfer)",
);
