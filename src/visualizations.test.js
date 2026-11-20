import test from "node:test";
import assert from "node:assert/strict";
import { parseChartData, sampleFunction } from "./visualizations.js";

test("samples a function across a requested x range", () => {
  const graph = sampleFunction("x^2", -2, 2, { samples: 5 });
  assert.deepEqual(graph.points.map(({ x, y }) => [x, y]), [
    [-2, 4],
    [-1, 1],
    [0, 0],
    [1, 1],
    [2, 4],
  ]);
  assert.equal(graph.minY, 0);
  assert.equal(graph.maxY, 4);
});

test("samples trigonometric functions in the requested angle unit", () => {
  const graph = sampleFunction("sin(x)", 0, 180, { samples: 3, angleUnit: "DEG" });
  assert.ok(Math.abs(graph.points[1].y - 1) < 1e-12);
});

test("rejects invalid graph ranges and unsupported expressions", () => {
  assert.throws(() => sampleFunction("x", 2, 2), /начало меньше конца/);
  assert.throws(() => sampleFunction("missing(x)", -1, 1), /недоступна|Неизвестный символ/);
});

test("parses chart labels and decimal-comma values", () => {
  assert.deepEqual(parseChartData("A\nB\nC", "1,5\n2\n-3", "bar"), {
    type: "bar",
    data: [
      { label: "A", value: 1.5 },
      { label: "B", value: 2 },
      { label: "C", value: -3 },
    ],
  });
});

test("validates pie chart values and matching labels", () => {
  assert.throws(() => parseChartData("A\nB", "1", "line"), /должно совпадать/);
  assert.throws(() => parseChartData("A\nB", "1\n-1", "pie"), /не меньше нуля/);
  assert.throws(() => parseChartData("A\nB", "0\n0", "pie"), /сумма больше нуля/);
});
