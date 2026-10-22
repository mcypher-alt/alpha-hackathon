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
console.log(
  "PASS: 15 product-routing assertions (PDF examples, collateral, uncertainty, tranche periods, confirmation)",
);
