import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateMatrix,
  calculateProgrammerOperation,
  calculateLoan,
  calculateCompoundInterest,
  calculateVat,
  calculateMarkupMargin,
  convertUnit,
  convertProfessionalUnit,
  derivativeAt,
  evaluateExpression,
  evaluateWorkspace,
  formatProgrammerInteger,
  formatResult,
  fractionFromParts,
  getProgrammerRange,
  getWorkspaceFunctionSuggestions,
  integrateNumerically,
  solveEquation,
} from "./calculator-engine.js";

test("evaluates normal arithmetic, powers, and constants", () => {
  assert.equal(evaluateExpression("2^3 + sqrt(16)"), 12);
  assert.equal(evaluateExpression("pi * 2"), Math.PI * 2);
  assert.equal(evaluateExpression("log(e)"), 1);
  assert.equal(evaluateExpression("5!"), 120);
  assert.equal(evaluateExpression("combinations(5, 2)"), 10);
  assert.equal(evaluateExpression("mean([1, 2, 3])"), 2);
  assert.equal(formatResult(evaluateExpression("i")), "i");
});

test("supports both degree and radian trigonometry", () => {
  assert.ok(Math.abs(evaluateExpression("sin(30)") - 0.5) < 1e-12);
  assert.ok(Math.abs(evaluateExpression("sin(pi/6)", { angleUnit: "RAD" }) - 0.5) < 1e-12);
  assert.equal(evaluateExpression("sin(180°)"), 0);
  assert.equal(evaluateExpression("sin(100)", { angleUnit: "GRAD" }), 1);
  assert.equal(evaluateExpression("sin(90)"), 1);
  assert.ok(Math.abs(evaluateExpression("sin(90)", { angleUnit: "RAD" }) - 0.8939966636005579) < 1e-12);
  assert.ok(Math.abs(evaluateExpression("asin(1)") - 90) < 1e-12);
  assert.throws(() => evaluateExpression("tan(90)"), /Тангенс не определён/);
});

test("validates scientific function domains and factorial limits", () => {
  assert.throws(() => evaluateExpression("sqrt(-1)"), /квадратный корень из отрицательного/);
  assert.throws(() => evaluateExpression("log(0)"), /Логарифм определён только/);
  assert.throws(() => evaluateExpression("(-1)!"), /Факториал определён только/);
  assert.throws(() => evaluateExpression("1000!"), /не больше 170/);
  assert.equal(evaluateExpression("nthRoot(27,3)"), 3);
  assert.equal(evaluateExpression("10 mod 3"), 1);
});

test("preserves operator precedence, right-associative powers, nesting, and decimal precision", () => {
  assert.equal(evaluateExpression("2 + 3 * 4"), 14);
  assert.equal(evaluateExpression("2^3^2"), 512);
  assert.equal(evaluateExpression("((2 + 3) * (4 - 1))"), 15);
  assert.equal(formatResult(evaluateExpression("0.1 + 0.2")), "0.3");
});

test("calculates percentages relative to the preceding amount", () => {
  assert.equal(evaluateExpression("200 + 10%"), 220);
  assert.equal(evaluateExpression("200 - 10%"), 180);
  assert.equal(evaluateExpression("200 * 10%"), 20);
  assert.equal(evaluateExpression("10%"), 0.1);
  assert.equal(evaluateExpression("32% + 3"), 3.32);
  assert.equal(evaluateExpression("62 + 74%"), 107.88);
  assert.equal(evaluateExpression("74% + 62"), 62.74);
  assert.equal(evaluateExpression("2^2 + 10%"), 4.4);
});

test("keeps safe expressions from accessing assignments or unavailable functions", () => {
  assert.throws(() => evaluateExpression("x=2"), /нельзя вычислить/);
  assert.throws(() => evaluateExpression("import('fs')"), /нельзя вычислить|недоступна/);
});

test("formats rational results and calculates fractions", () => {
  assert.equal(formatResult(1 / 3, { fraction: true }), "1/3");
  assert.equal(fractionFromParts(2, 6), "1/3");
});

test("calculates symbolic derivatives and numeric integrals", () => {
  assert.equal(derivativeAt("x^2", 3).value, 6);
  assert.ok(Math.abs(integrateNumerically("x", 0, 2) - 2) < 1e-10);
});

test("solves a bracketed equation and reports invalid brackets", () => {
  assert.ok(Math.abs(solveEquation("x^2-4", 0, 3) - 2) < 1e-10);
  assert.throws(() => solveEquation("x^2+1", -1, 1), /нет смены знака/);
});

test("calculates matrix operations and converts units", () => {
  assert.equal(calculateMatrix("[[1,2],[3,4]]", "det"), "-2");
  assert.equal(calculateMatrix("[[1,2],[3,4]]", "transpose"), "[[1, 3], [2, 4]]");
  assert.equal(convertUnit(1, "km", "m").toNumber("m"), 1000);
});

test("evaluates workspace variables, percent-valued variables, and Ans sequentially", () => {
  const result = evaluateWorkspace([
    "цена = 1200",
    "налог = 20%",
    "итого = цена + налог",
    "итого / 3",
    "Ans + 1",
  ].join("\n"));

  assert.deepEqual(result.rows.map((row) => row.result), ["1 200", "20 %", "1 440", "480", "481"]);
  assert.deepEqual(result.variables.map(({ name }) => name), ["цена", "налог", "итого"]);
  assert.equal(result.ans, 481);
});

test("calculates workspace functions and supports decimal commas, semicolon arguments, and auto-closed parentheses", () => {
  const result = evaluateWorkspace([
    "sin(30) + log(1000)",
    "avg(12; 18; 25; 31)",
    "median(3; 9; 4; 10)",
    "2^10 mod 1000",
    "nCr(10; 3)",
    "0,1 + 0.2",
    "sqrt(81",
  ].join("\n"));

  assert.deepEqual(result.rows.map((row) => row.result), ["3,5", "21,5", "6,5", "24", "120", "0,3", "9"]);
  assert.ok(result.rows.every((row) => !row.error));
  assert.equal(evaluateWorkspace("pmt(500000; 12%; 36)").rows[0].result, "16 607,15");
});

test("supports standalone and relative percentages, right-associative powers, and angle modes", () => {
  assert.equal(evaluateWorkspace("20%").rows[0].result, "0,2");
  assert.equal(evaluateWorkspace("200 + 10%\n200 − 10%").rows[0].result, "220");
  assert.equal(evaluateWorkspace("200 + 10%\n200 − 10%").rows[1].result, "180");
  assert.equal(evaluateWorkspace("2^3^2").rows[0].result, "512");
  assert.equal(evaluateWorkspace("sin(100)", { angleUnit: "GRAD" }).rows[0].result, "1");
  assert.equal(evaluateWorkspace("sin(pi / 6)", { angleUnit: "RAD" }).rows[0].result, "0,5");
});

test("keeps row errors isolated and ignores comments while preserving prior variables", () => {
  const result = evaluateWorkspace([
    "# Смета",
    "price = 15 # цена",
    "5 / 0",
    "price * 2",
    "sqrt(-1)",
    "nCr(10; 3)",
  ].join("\n"));

  assert.equal(result.rows[2].error, "Деление на ноль невозможно.");
  assert.equal(result.rows[3].result, "30");
  assert.match(result.rows[4].error, /квадратный корень/);
  assert.equal(result.rows[5].result, "120");
});

test("enforces workspace domains and offers documented function autocomplete", () => {
  assert.match(evaluateWorkspace("tan(90)").rows[0].error, /Тангенс не определён/);
  assert.match(evaluateWorkspace("log(0)").rows[0].error, /Логарифм определён/);
  assert.match(evaluateWorkspace("1 / 0").rows[0].error, /Деление на ноль/);
  assert.deepEqual(getWorkspaceFunctionSuggestions("nC"), [
    { name: "nCr", description: "nCr(n; k) — число сочетаний" },
  ]);
});

test("formats 32-bit unsigned programmer values and operations", () => {
  assert.equal(formatProgrammerInteger(255n, "hex", 32, false), "FF");
  assert.equal(formatProgrammerInteger(255n, "oct", 32, false), "377");
  assert.equal(formatProgrammerInteger(255n, "bin", 32, false), "1111 1111");
  assert.equal(formatProgrammerInteger(4294967295n, "dec", 32, false), "4 294 967 295");
  assert.equal(calculateProgrammerOperation("255", "15", "and", 32, false), 15n);
  assert.equal(calculateProgrammerOperation("255", "15", "or", 32, false), 255n);
  assert.equal(calculateProgrammerOperation("255", "15", "xor", 32, false), 240n);
  assert.equal(calculateProgrammerOperation("255", "0", "not", 32, false), 4294967040n);
  assert.equal(calculateProgrammerOperation("255", "4", "shl", 32, false), 4080n);
  assert.equal(calculateProgrammerOperation("255", "4", "shr", 32, false), 15n);
});

test("checks programmer ranges and 64-bit BigInt overflow", () => {
  const unsigned = getProgrammerRange(32, false);
  assert.equal(unsigned.min, 0n);
  assert.equal(unsigned.max, 4294967295n);
  const signed64 = getProgrammerRange(64, true);
  assert.equal(signed64.min, -(1n << 63n));
  assert.equal(signed64.max, (1n << 63n) - 1n);
  assert.throws(
    () => calculateProgrammerOperation("4294967296", "1", "and", 32, false),
    /Переполнение/,
  );
  assert.equal(calculateProgrammerOperation("0xffffffffffffffff", "1", "and", 64, false), 1n);
});

test("calculates annuity loan payments and schedule", () => {
  const loan = calculateLoan({ principal: 500000, annualRate: 12, months: 36, type: "annuity" });
  assert.equal(loan.payment, 16607.15);
  assert.equal(loan.totalPayment, 597857.4);
  assert.equal(loan.overpayment, 97857.4);
  assert.equal(loan.overpaymentPercent, 19.57);
  assert.equal(loan.schedule.length, 36);
  assert.equal(loan.schedule.at(-1).balance, 0);
});

test("calculates differential loans, VAT, compound interest, and margin", () => {
  const differential = calculateLoan({ principal: 120000, annualRate: 12, months: 12, type: "differential" });
  assert.equal(differential.schedule[0].payment, 11200);
  assert.equal(differential.schedule.at(-1).balance, 0);
  assert.deepEqual(calculateVat(1440, 20, "extract"), { base: 1200, vat: 240, total: 1440 });
  assert.equal(calculateVat(1200, 20, "add").total, 1440);
  assert.equal(calculateCompoundInterest(100000, 8, 5), 146932.81);
  assert.equal(calculateMarkupMargin(800, 25).margin, 20);
});

test("converts length, mass, and temperature units", () => {
  assert.equal(convertProfessionalUnit(1, "length", "km", "m"), 1000);
  assert.equal(convertProfessionalUnit(1, "mass", "kg", "g"), 1000);
  assert.equal(convertProfessionalUnit(0, "temperature", "c", "f"), 32);
  assert.equal(convertProfessionalUnit(32, "temperature", "f", "c"), 0);
  assert.throws(() => convertProfessionalUnit(NaN, "length", "m", "cm"), /корректное число/);
});
