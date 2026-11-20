import { evaluateExpression } from "./calculator-engine.js";

export function sampleFunction(expression, min, max, { samples = 201, angleUnit = "RAD" } = {}) {
  const lower = Number(min);
  const upper = Number(max);
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) {
    throw new Error("Укажите конечный диапазон, где начало меньше конца.");
  }
  if (!Number.isInteger(samples) || samples < 2 || samples > 1001) {
    throw new Error("Количество точек графика должно быть от 2 до 1001.");
  }

  const points = [];
  for (let index = 0; index < samples; index += 1) {
    const x = lower + ((upper - lower) * index) / (samples - 1);
    try {
      const value = evaluateExpression(expression, { variables: { x }, angleUnit });
      points.push({ x, y: typeof value === "number" && Number.isFinite(value) ? value : null });
    } catch (error) {
      if (index === 0) throw error;
      points.push({ x, y: null });
    }
  }

  const values = points.filter(({ y }) => y !== null).map(({ y }) => y);
  if (!values.length) throw new Error("На выбранном промежутке нет вещественных значений функции.");
  return {
    expression,
    min: lower,
    max: upper,
    angleUnit,
    points,
    minY: Math.min(...values),
    maxY: Math.max(...values),
  };
}

export function parseChartData(labelsText, valuesText, type) {
  if (!["bar", "line", "pie"].includes(type)) {
    throw new Error("Выберите доступный тип диаграммы.");
  }

  const labels = String(labelsText).trim().split(/\r?\n/).map((label) => label.trim());
  const valueLines = String(valuesText).trim().split(/\r?\n/).map((value) => value.trim());
  if (labels.length < 2 || labels.length > 20 || labels.some((label) => !label)) {
    throw new Error("Добавьте от 2 до 20 подписанных строк данных.");
  }
  if (labels.length !== valueLines.length) {
    throw new Error("Количество подписей и чисел должно совпадать.");
  }

  const data = labels.map((label, index) => {
    const value = Number(valueLines[index].replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(value)) throw new Error(`Проверьте число для «${label}».`);
    if (type === "pie" && value < 0) throw new Error("Для круговой диаграммы нужны значения не меньше нуля.");
    return { label, value };
  });
  if (type === "pie" && data.every(({ value }) => value === 0)) {
    throw new Error("Для круговой диаграммы нужна хотя бы одна сумма больше нуля.");
  }

  return { type, data };
}
