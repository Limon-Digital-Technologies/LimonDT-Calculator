import { all, create } from "mathjs";

const math = create(all, { number: "number", precision: 14 });
const allowedFunctions = new Set([
  "abs", "acos", "acosh", "arg", "asin", "asinh", "atan", "atanh", "degree",
  "cbrt", "ceil", "combinations", "conj", "cos", "cosh", "exp", "factorial", "floor",
  "gamma", "gcd", "lcm", "log", "log10", "log2", "max", "mean", "median",
  "im", "min", "mod", "nthRoot", "permutations", "quantileSeq", "re", "round", "sign",
  "sin", "sinh", "sqrt", "std", "tan", "tanh", "variance",
]);
const allowedOperators = new Set(["+", "-", "*", "/", "^", "%", "!", "and", "or", "xor", "==", "!=", "<", ">", "<=", ">="]);
const forbiddenNames = new Set([
  "config", "createUnit", "evaluate", "help", "import", "parse", "parser",
  "reviver", "simplify", "derivative", "resolve", "unit",
]);

function assertSafeExpression(expression, allowedVariables = new Set(["ans"])) {
  const tree = math.parse(expression);
  tree.traverse((node, _path, parent) => {
    if (node.isAssignmentNode || node.isAccessorNode || node.isBlockNode || node.isConditionalNode || node.isIndexNode || node.isObjectNode || node.isRangeNode || node.isFunctionAssignmentNode) {
      throw new Error("Это выражение нельзя вычислить в калькуляторе.");
    }
    if (node.isOperatorNode && !allowedOperators.has(node.op)) {
      throw new Error(`Оператор «${node.op}» не поддерживается.`);
    }
    if (node.isFunctionNode) {
      if (!allowedFunctions.has(node.name)) {
        throw new Error(`Функция «${node.name}» недоступна в выражениях.`);
      }
    }
    if (node.isSymbolNode) {
      const name = node.name.toLowerCase();
      if (forbiddenNames.has(name)) throw new Error("Эта функция недоступна в калькуляторе.");
      const functionName = parent?.isFunctionNode && parent.name === node.name;
      if (!functionName
        && !["pi", "e", "tau", "i", "true", "false"].includes(name)
        && !allowedVariables.has(name)) {
        throw new Error(`Неизвестный символ «${node.name}».`);
      }
    }
  });
  return tree;
}

function expressionScope({ ans, variables, angleUnit }) {
  const scope = { ans, ...variables };
  const scale = angleUnit === "DEG" ? Math.PI / 180 : angleUnit === "GRAD" ? Math.PI / 200 : 1;
  const angleInRadians = (value) => math.isUnit(value) ? value.toNumber("rad") : value * scale;
  const angleFromRadians = (value) => value / scale;
  const checkedLog = (fn) => (value) => {
    if (value <= 0) throw new Error("Логарифм определён только для положительных чисел.");
    return fn(value);
  };
  scope.sin = (value) => math.sin(angleInRadians(value));
  scope.cos = (value) => math.cos(angleInRadians(value));
  scope.tan = (value) => {
    const radians = angleInRadians(value);
    if (Math.abs(Math.cos(radians)) < 1e-12) {
      throw new Error("Тангенс не определён для этого угла.");
    }
    return Math.tan(radians);
  };
  scope.asin = (value) => angleFromRadians(Math.asin(value));
  scope.acos = (value) => angleFromRadians(Math.acos(value));
  scope.atan = (value) => angleFromRadians(Math.atan(value));
  scope.degree = (value) => math.unit(value, "deg");
  scope.sqrt = (value) => {
    if (value < 0) throw new Error("Нельзя извлечь квадратный корень из отрицательного числа.");
    return Math.sqrt(value);
  };
  scope.log = checkedLog((value) => Math.log(value));
  scope.log10 = checkedLog((value) => Math.log10(value));
  scope.log2 = checkedLog((value) => Math.log2(value));
  scope.factorial = (value) => {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Факториал определён только для целых неотрицательных чисел.");
    }
    if (value > 170) throw new Error("Факториал поддерживает значения не больше 170.");
    return math.factorial(value);
  };
  return scope;
}

function normalizeStandalonePercent(expression) {
  const percentNumber = /(^|[*/,(])\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*%(?=\s*(?:[+\-*/),]|$))/gi;
  return expression.replace(percentNumber, (_match, prefix, value) => `${prefix}(${value}/100)`);
}

export function evaluateExpression(expression, { ans = 0, variables = {}, angleUnit = "DEG" } = {}) {
  const normalized = normalizeStandalonePercent(expression
    .replace(/[×·]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/π/g, "pi")
    .replace(/τ/g, "tau")
    .replace(/\bmod\b(?!\s*\()/gi, "%")
    .replace(/(\d+(?:\.\d*)?|\.\d+)\s*°/g, "degree($1)")
    .replace(/√\s*\(/g, "sqrt("));
  const names = new Set(["ans", ...Object.keys(variables).map((name) => name.toLowerCase())]);
  const tree = assertSafeExpression(normalized, names);
  const scope = expressionScope({ ans, variables, angleUnit });
  tree.traverse((node) => {
    if (node.isOperatorNode && node.op === "!") {
      const operand = node.args[0].evaluate(scope);
      if (!Number.isInteger(operand) || operand < 0) {
        throw new Error("Факториал определён только для целых неотрицательных чисел.");
      }
      if (operand > 170) throw new Error("Факториал поддерживает значения не больше 170.");
    }
  });
  const value = tree.evaluate(scope);
  if (typeof value === "number" && Math.abs(value) < 1e-14) return 0;
  return value;
}

const workspaceFunctionDescriptions = [
  ["sin", "sin(x) — синус"],
  ["cos", "cos(x) — косинус"],
  ["tan", "tan(x) — тангенс"],
  ["asin", "asin(x) — арксинус"],
  ["acos", "acos(x) — арккосинус"],
  ["atan", "atan(x) — арктангенс"],
  ["ln", "ln(x) — натуральный логарифм"],
  ["log", "log(x) — десятичный логарифм"],
  ["sqrt", "sqrt(x) — квадратный корень"],
  ["abs", "abs(x) — модуль"],
  ["round", "round(x; знаки) — округление"],
  ["floor", "floor(x) — округление вниз"],
  ["ceil", "ceil(x) — округление вверх"],
  ["min", "min(x; ...) — минимум"],
  ["max", "max(x; ...) — максимум"],
  ["sum", "sum(x; ...) — сумма"],
  ["avg", "avg(x; ...) — среднее"],
  ["median", "median(x; ...) — медиана"],
  ["stdev", "stdev(x; ...) — стандартное отклонение"],
  ["nCr", "nCr(n; k) — число сочетаний"],
  ["nPr", "nPr(n; k) — число размещений"],
  ["pmt", "pmt(сумма; годовая ставка; месяцы) — платёж"],
];
const workspaceFunctions = new Map(workspaceFunctionDescriptions.map(([name]) => [name.toLowerCase(), name]));
const workspaceReservedNames = new Set([
  "pi", "e", "ans",
  ...workspaceFunctions.keys(),
]);
const workspaceNumberFormat = new Intl.NumberFormat("ru-RU", {
  maximumSignificantDigits: 10,
  useGrouping: true,
});

function workspaceNumber(value) {
  if (typeof value === "number") return value;
  return value.value;
}

function isWorkspacePercent(value) {
  return value !== null && typeof value === "object" && value.kind === "percent";
}

function checkWorkspaceNumber(value) {
  if (!Number.isFinite(value)) throw new Error("Результат вышел за допустимый диапазон.");
  return Math.abs(value) < 1e-14 ? 0 : value;
}

function autoCloseWorkspaceParentheses(expression) {
  let open = 0;
  for (const character of expression) {
    if (character === "(") open += 1;
    if (character === ")") open -= 1;
  }
  if (open < 0) return expression;
  return expression + ")".repeat(open);
}

function tokenizeWorkspaceExpression(expression) {
  const pattern = /\s+|(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?|[\p{L}_][\p{L}\p{N}_]*|[()+\-*/^%!;]/uy;
  const tokens = [];
  let offset = 0;
  while (offset < expression.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(expression);
    if (!match) throw new Error(`Неожиданный символ «${expression[offset]}».`);
    offset = pattern.lastIndex;
    if (/^\s+$/.test(match[0])) continue;
    const value = match[0];
    if (/^(?:\d|[.,]\d)/.test(value)) {
      const number = Number(value.replace(",", "."));
      if (!Number.isFinite(number)) throw new Error("Некорректное число.");
      tokens.push({ type: "number", value: number });
    } else if (/^[\p{L}_]/u.test(value)) {
      tokens.push({ type: "identifier", value });
    } else {
      tokens.push({ type: "operator", value: value.toLowerCase() });
    }
  }
  tokens.push({ type: "end", value: "" });
  return tokens;
}

function parseWorkspaceExpression(expression) {
  const tokens = tokenizeWorkspaceExpression(expression);
  let position = 0;
  const current = () => tokens[position];
  const accept = (value) => {
    if (current().value !== value) return false;
    position += 1;
    return true;
  };
  const expect = (value, message = `Ожидается «${value}».`) => {
    if (!accept(value)) throw new Error(message);
  };

  function parsePrimary() {
    const token = current();
    if (token.type === "number") {
      position += 1;
      return { type: "number", value: token.value };
    }
    if (token.type === "identifier") {
      position += 1;
      const name = token.value;
      if (accept("(")) {
        const args = [];
        if (!accept(")")) {
          do {
            args.push(parseAdditive());
          } while (accept(";"));
          expect(")", "Не закрыта скобка функции.");
        }
        return { type: "call", name, args };
      }
      return { type: "symbol", name };
    }
    if (accept("(")) {
      const node = parseAdditive();
      expect(")", "Не закрыта скобка.");
      return node;
    }
    throw new Error(token.type === "end" ? "Введите выражение." : `Неожиданный символ «${token.value}».`);
  }

  function parsePostfix() {
    let node = parsePrimary();
    while (current().value === "!" || current().value === "%") {
      const operator = current().value;
      position += 1;
      node = { type: operator === "!" ? "factorial" : "percent", value: node };
    }
    return node;
  }

  function parsePower() {
    const left = parsePostfix();
    if (!accept("^")) return left;
    return { type: "binary", operator: "^", left, right: parseUnary() };
  }

  function parseUnary() {
    if (accept("+")) return { type: "unary", operator: "+", value: parseUnary() };
    if (accept("-")) return { type: "unary", operator: "-", value: parseUnary() };
    return parsePower();
  }

  function parseMultiplicative() {
    let node = parseUnary();
    while (["*", "/", "mod"].includes(current().value)) {
      const operator = current().value;
      position += 1;
      node = { type: "binary", operator, left: node, right: parseUnary() };
    }
    return node;
  }

  function parseAdditive() {
    let node = parseMultiplicative();
    while (current().value === "+" || current().value === "-") {
      const operator = current().value;
      position += 1;
      node = { type: "binary", operator, left: node, right: parseMultiplicative() };
    }
    return node;
  }

  const tree = parseAdditive();
  if (current().type !== "end") throw new Error(`Неожиданный символ «${current().value}».`);
  return tree;
}

function calculateWorkspaceFunction(name, values, angleUnit) {
  const normalized = name.toLowerCase();
  const requireCount = (minimum, maximum = minimum) => {
    if (values.length < minimum || values.length > maximum) {
      throw new Error(`Функция ${name} принимает ${minimum === maximum ? `ровно ${minimum}` : `от ${minimum} до ${maximum}`} аргументов.`);
    }
  };
  const one = () => {
    requireCount(1);
    return values[0];
  };
  const scale = angleUnit === "DEG" ? Math.PI / 180 : angleUnit === "GRAD" ? Math.PI / 200 : 1;
  const angleFromRadians = (value) => value / scale;
  const factorial = (value) => {
    if (!Number.isInteger(value) || value < 0) throw new Error("Факториал определён только для целых неотрицательных чисел.");
    if (value > 170) throw new Error("Факториал поддерживает значения не больше 170.");
    let result = 1;
    for (let factor = 2; factor <= value; factor += 1) result *= factor;
    return result;
  };
  const combination = (n, k, permutation) => {
    if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) {
      throw new Error("n и k должны быть целыми числами, где 0 ≤ k ≤ n.");
    }
    if (n > 170) throw new Error("Поддерживаются значения n не больше 170.");
    const count = permutation ? k : Math.min(k, n - k);
    let result = 1;
    for (let index = 0; index < count; index += 1) {
      result *= permutation ? n - index : (n - index) / (index + 1);
    }
    return result;
  };
  const statistics = (operation) => {
    if (!values.length) throw new Error(`Укажите хотя бы одно число для ${name}.`);
    if (operation === "sum") return values.reduce((total, value) => total + value, 0);
    if (operation === "avg") return values.reduce((total, value) => total + value, 0) / values.length;
    if (operation === "median") {
      const sorted = [...values].sort((left, right) => left - right);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    }
    const mean = values.reduce((total, value) => total + value, 0) / values.length;
    return Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length);
  };

  let result;
  switch (normalized) {
    case "sin": result = Math.sin(one() * scale); break;
    case "cos": result = Math.cos(one() * scale); break;
    case "tan": {
      const radians = one() * scale;
      if (Math.abs(Math.cos(radians)) < 1e-12) throw new Error("Тангенс не определён для этого угла.");
      result = Math.tan(radians);
      break;
    }
    case "asin": {
      const value = one();
      if (Math.abs(value) > 1) throw new Error("Арксинус определён только для чисел от −1 до 1.");
      result = angleFromRadians(Math.asin(value));
      break;
    }
    case "acos": {
      const value = one();
      if (Math.abs(value) > 1) throw new Error("Арккосинус определён только для чисел от −1 до 1.");
      result = angleFromRadians(Math.acos(value));
      break;
    }
    case "atan": result = angleFromRadians(Math.atan(one())); break;
    case "ln": {
      const value = one();
      if (value <= 0) throw new Error("Логарифм определён только для положительных чисел.");
      result = Math.log(value);
      break;
    }
    case "log": {
      const value = one();
      if (value <= 0) throw new Error("Логарифм определён только для положительных чисел.");
      result = Math.log10(value);
      break;
    }
    case "sqrt": {
      const value = one();
      if (value < 0) throw new Error("Нельзя извлечь квадратный корень из отрицательного числа.");
      result = Math.sqrt(value);
      break;
    }
    case "abs": result = Math.abs(one()); break;
    case "factorial": result = factorial(one()); break;
    case "round": {
      requireCount(1, 2);
      const digits = values[1] ?? 0;
      if (!Number.isInteger(digits) || digits < -10 || digits > 10) {
        throw new Error("Количество знаков для round должно быть целым от −10 до 10.");
      }
      const factor = 10 ** digits;
      result = digits >= 0
        ? Number(values[0].toFixed(digits))
        : Math.round(values[0] / (10 ** -digits)) * (10 ** -digits);
      if (!Number.isFinite(result) || !Number.isFinite(factor)) throw new Error("Результат вышел за допустимый диапазон.");
      break;
    }
    case "floor": result = Math.floor(one()); break;
    case "ceil": result = Math.ceil(one()); break;
    case "min": requireCount(1, Number.MAX_SAFE_INTEGER); result = Math.min(...values); break;
    case "max": requireCount(1, Number.MAX_SAFE_INTEGER); result = Math.max(...values); break;
    case "sum": result = statistics("sum"); break;
    case "avg": result = statistics("avg"); break;
    case "median": result = statistics("median"); break;
    case "stdev": result = statistics("stdev"); break;
    case "ncr": requireCount(2); result = combination(values[0], values[1], false); break;
    case "npr": requireCount(2); result = combination(values[0], values[1], true); break;
    case "pmt": {
      requireCount(3);
      const [principal, annualRate, months] = values;
      if (principal < 0 || annualRate < 0 || !Number.isInteger(months) || months <= 0) {
        throw new Error("Для pmt нужны сумма ≥ 0, ставка ≥ 0 и положительный срок в месяцах.");
      }
      const monthlyRate = annualRate / 12;
      result = monthlyRate === 0
        ? principal / months
        : (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months);
      result = Math.round((result + Number.EPSILON) * 100) / 100;
      break;
    }
    default: throw new Error(`Функция «${name}» недоступна в рабочей области.`);
  }
  return checkWorkspaceNumber(result);
}

function evaluateWorkspaceTree(node, variables, ans, angleUnit) {
  if (node.type === "number") return node.value;
  if (node.type === "symbol") {
    const name = node.name.toLowerCase();
    if (name === "pi") return Math.PI;
    if (name === "e") return Math.E;
    if (name === "ans") return ans;
    if (!variables.has(name)) throw new Error(`Неизвестная переменная «${node.name}».`);
    return variables.get(name).value;
  }
  if (node.type === "unary") {
    const value = evaluateWorkspaceTree(node.value, variables, ans, angleUnit);
    return checkWorkspaceNumber(node.operator === "-" ? -workspaceNumber(value) : workspaceNumber(value));
  }
  if (node.type === "percent") {
    const value = evaluateWorkspaceTree(node.value, variables, ans, angleUnit);
    if (isWorkspacePercent(value)) throw new Error("Нельзя применять процент дважды.");
    return { kind: "percent", value: checkWorkspaceNumber(workspaceNumber(value) / 100) };
  }
  if (node.type === "factorial") {
    return calculateWorkspaceFunction("factorial", [workspaceNumber(evaluateWorkspaceTree(node.value, variables, ans, angleUnit))], angleUnit);
  }
  if (node.type === "binary") {
    const left = evaluateWorkspaceTree(node.left, variables, ans, angleUnit);
    const right = evaluateWorkspaceTree(node.right, variables, ans, angleUnit);
    const leftNumber = workspaceNumber(left);
    const rightNumber = workspaceNumber(right);
    let result;
    if ((node.operator === "+" || node.operator === "-") && isWorkspacePercent(right)) {
      result = leftNumber + (node.operator === "+" ? 1 : -1) * leftNumber * rightNumber;
    } else if (node.operator === "+") {
      result = leftNumber + rightNumber;
    } else if (node.operator === "-") {
      result = leftNumber - rightNumber;
    } else if (node.operator === "*") {
      result = leftNumber * rightNumber;
    } else if (node.operator === "/") {
      if (rightNumber === 0) throw new Error("Деление на ноль невозможно.");
      result = leftNumber / rightNumber;
    } else if (node.operator === "mod") {
      if (rightNumber === 0) throw new Error("Остаток от деления на ноль не определён.");
      result = leftNumber % rightNumber;
    } else {
      result = leftNumber ** rightNumber;
    }
    return checkWorkspaceNumber(result);
  }
  if (node.type === "call") {
    const normalized = node.name.toLowerCase();
    if (!workspaceFunctions.has(normalized)) throw new Error(`Функция «${node.name}» недоступна в рабочей области.`);
    const values = node.args.map((argument) => workspaceNumber(evaluateWorkspaceTree(argument, variables, ans, angleUnit)));
    return calculateWorkspaceFunction(node.name, values, angleUnit);
  }
  throw new Error("Не удалось разобрать выражение.");
}

function formatWorkspaceValue(value, { assigned = false } = {}) {
  if (isWorkspacePercent(value) && assigned) {
    return `${workspaceNumberFormat.format(value.value * 100).replace(/[\u00a0\u202f]/g, " ")} %`;
  }
  const number = workspaceNumber(value);
  if (!Number.isFinite(number)) throw new Error("Результат вышел за допустимый диапазон.");
  return workspaceNumberFormat.format(number).replace(/[\u00a0\u202f]/g, " ");
}

export function evaluateWorkspace(text, { ans = 0, angleUnit = "DEG" } = {}) {
  const variables = new Map();
  const rows = [];
  let lastAnswer = Number.isFinite(ans) ? ans : 0;
  for (const source of String(text).split(/\r?\n/)) {
    const expression = source.split("#", 1)[0].trim();
    const row = { source, result: "", error: "", kind: expression ? "expression" : "empty" };
    if (!expression) {
      if (source.trimStart().startsWith("#")) row.kind = "comment";
      rows.push(row);
      continue;
    }
    try {
      let variableName = "";
      let body = expression;
      if (expression.includes("=")) {
        const assignment = expression.match(/^([\p{L}_][\p{L}\p{N}_]*)\s*=\s*(.*)$/u);
        if (!assignment) throw new Error("Используйте присваивание в формате «имя = выражение».");
        variableName = assignment[1];
        body = assignment[2];
        const normalizedName = variableName.toLowerCase();
        if (workspaceReservedNames.has(normalizedName)) throw new Error(`Имя «${variableName}» зарезервировано.`);
        if (!body.trim()) throw new Error("После знака «=» введите выражение.");
      }
      const completedExpression = autoCloseWorkspaceParentheses(body
        .replace(/[−–]/g, "-")
        .replace(/[×·]/g, "*")
        .replace(/[÷:]/g, "/")
        .replace(/π/g, "pi")
        .replace(/√\s*\(/g, "sqrt("));
      const tree = parseWorkspaceExpression(completedExpression);
      const value = evaluateWorkspaceTree(tree, variables, lastAnswer, angleUnit);
      if (variableName) {
        variables.set(variableName.toLowerCase(), {
          name: variableName,
          value,
          result: formatWorkspaceValue(value, { assigned: true }),
        });
        row.kind = "assignment";
        row.variable = variableName;
      }
      row.value = value;
      row.result = formatWorkspaceValue(value, { assigned: Boolean(variableName) });
      lastAnswer = checkWorkspaceNumber(workspaceNumber(value));
    } catch (error) {
      row.error = error instanceof Error ? error.message : "Не удалось вычислить выражение.";
    }
    rows.push(row);
  }
  return {
    rows,
    variables: [...variables.values()],
    ans: lastAnswer,
  };
}

export function getWorkspaceFunctionSuggestions(prefix) {
  const normalized = String(prefix).toLowerCase();
  return workspaceFunctionDescriptions
    .filter(([name]) => name.toLowerCase().startsWith(normalized))
    .map(([name, description]) => ({ name, description }));
}

export function parseProgrammerInteger(text, bits = 32, signed = false) {
  let normalized = String(text).trim().replace(/_/g, "").replace(/^([+-])0x/i, "$10x");
  if (!normalized) throw new Error("Введите число.");
  if (!/^[+-]?(?:0[xbo])?[0-9a-f]+$/i.test(normalized)) {
    throw new Error("Введите целое число в HEX, DEC, OCT или BIN.");
  }
  let value;
  try {
    if (/^[+-]?0b/i.test(normalized)) {
      const sign = normalized.startsWith("-") ? -1n : 1n;
      value = sign * BigInt(normalized.replace(/^[+-]?0b/i, "0b"));
    } else if (/^[+-]?0o/i.test(normalized)) {
      const sign = normalized.startsWith("-") ? -1n : 1n;
      value = sign * BigInt(normalized.replace(/^[+-]?0o/i, "0o"));
    } else if (/^[+-]?0x/i.test(normalized)) {
      const sign = normalized.startsWith("-") ? -1n : 1n;
      value = sign * BigInt(normalized.replace(/^[+-]?0x/i, "0x"));
    } else {
      value = BigInt(normalized);
    }
  } catch {
    throw new Error("Введите целое число в HEX, DEC, OCT или BIN.");
  }
  validateProgrammerRange(value, bits, signed);
  return value;
}

export function validateProgrammerRange(value, bits = 32, signed = false) {
  const integer = typeof value === "bigint" ? value : BigInt(value);
  const mod = 1n << BigInt(bits);
  const signedMin = -(1n << BigInt(bits - 1));
  const signedMax = (1n << BigInt(bits - 1)) - 1n;
  const min = signed ? signedMin : 0n;
  const max = signed ? signedMax : mod - 1n;
  if (integer < min || integer > max) {
    throw new Error(`Переполнение: допустимый диапазон ${min.toString()} … ${max.toString()}.`);
  }
  return integer;
}

export function getProgrammerRange(bits = 32, signed = false) {
  const mod = 1n << BigInt(bits);
  const min = signed ? -(1n << BigInt(bits - 1)) : 0n;
  const max = signed ? (1n << BigInt(bits - 1)) - 1n : mod - 1n;
  return { min, max };
}

function programmerMask(bits) {
  return (1n << BigInt(bits)) - 1n;
}

function programmerToSigned(value, bits) {
  const mask = programmerMask(bits);
  const unsigned = value & mask;
  const signBit = 1n << BigInt(bits - 1);
  return unsigned & signBit ? unsigned - (1n << BigInt(bits)) : unsigned;
}

function programmerWrap(value, bits, signed) {
  const mask = programmerMask(bits);
  const wrapped = value & mask;
  const result = signed ? programmerToSigned(wrapped, bits) : wrapped;
  validateProgrammerRange(result, bits, signed);
  return result;
}

export function calculateProgrammerOperation(aText, bText, operation, bits = 32, signed = false) {
  const a = parseProgrammerInteger(aText, bits, signed);
  const b = parseProgrammerInteger(bText, bits, signed);
  let result;
  switch (operation) {
    case "and":
      result = a & b;
      break;
    case "or":
      result = a | b;
      break;
    case "xor":
      result = a ^ b;
      break;
    case "not":
      result = ~a;
      break;
    case "shl": {
      const shift = b < 0n ? -b : b;
      if (shift > 64n) throw new Error("Сдвиг не может быть больше 64.");
      result = a << shift;
      break;
    }
    case "shr": {
      const shift = b < 0n ? -b : b;
      if (shift > 64n) throw new Error("Сдвиг не может быть больше 64.");
      result = signed ? programmerToSigned(a, bits) >> shift : (a & programmerMask(bits)) >> shift;
      break;
    }
    default:
      throw new Error("Выберите операцию.");
  }
  return programmerWrap(result, bits, signed);
}

export function formatProgrammerInteger(value, base, bits = 32, signed = false) {
  const integer = validateProgrammerRange(
    typeof value === "bigint" ? value : BigInt(value),
    bits,
    signed,
  );
  if (base === "hex") return integer < 0n
    ? `-${Math.abs(Number(integer)).toString(16).toUpperCase()}`
    : integer.toString(16).toUpperCase();
  if (base === "oct") return integer < 0n
    ? `-${Math.abs(Number(integer)).toString(8)}`
    : integer.toString(8);
  if (base === "dec") return integer.toLocaleString("ru-RU").replace(/[\u00a0\u202f]/g, " ");
  let binary = (integer < 0n ? integer + (1n << BigInt(bits)) : integer).toString(2);
  binary = binary.replace(/^0+(?=\d)/, "");
  if (!binary) binary = "0";
  while (binary.length % 4 !== 0) binary = `0${binary}`;
  return binary.match(/.{1,4}/g)?.join(" ") || binary;
}
export function formatResult(value, { fraction = false, precision = 12 } = {}) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "Не определено";
    if (fraction) {
      const rational = approximateFraction(value);
      if (rational) return rational;
    }
  }
  if (typeof value === "string") return value;
  return math.format(value, { precision, lowerExp: -9, upperExp: 12 });
}

function approximateFraction(value, maxDenominator = 10000, tolerance = 1e-10) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e9) return null;
  if (Number.isInteger(value)) return String(value);
  const sign = value < 0 ? "-" : "";
  let remainder = Math.abs(value);
  let numerator = 1;
  let denominator = 0;
  let previousNumerator = 0;
  let previousDenominator = 1;

  for (let iteration = 0; iteration < 32; iteration += 1) {
    const whole = Math.floor(remainder);
    const nextNumerator = whole * numerator + previousNumerator;
    const nextDenominator = whole * denominator + previousDenominator;
    if (nextDenominator > maxDenominator) break;
    previousNumerator = numerator;
    previousDenominator = denominator;
    numerator = nextNumerator;
    denominator = nextDenominator;
    if (Math.abs(numerator / denominator - Math.abs(value)) <= tolerance) {
      return denominator === 1 ? `${sign}${numerator}` : `${sign}${numerator}/${denominator}`;
    }
    const fractional = remainder - whole;
    if (fractional < Number.EPSILON) break;
    remainder = 1 / fractional;
  }
  return null;
}

export function fractionFromParts(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    throw new Error("Укажите числитель и ненулевой знаменатель.");
  }
  return formatResult(math.fraction(numerator, denominator), { fraction: true });
}

export function derivativeAt(expression, x) {
  assertSafeExpression(expression, new Set(["x", "ans"]));
  if (!Number.isFinite(x)) throw new Error("Укажите корректное значение x.");
  const derivative = math.derivative(expression, "x");
  return {
    formula: derivative.toString(),
    value: derivative.evaluate(expressionScope({ ans: 0, variables: { x }, angleUnit: "RAD" })),
  };
}

export function integrateNumerically(expression, lower, upper, intervals = 1000) {
  assertSafeExpression(expression, new Set(["x", "ans"]));
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower === upper) {
    throw new Error("Укажите разные корректные границы интегрирования.");
  }
  const count = Math.max(2, Math.min(10000, Math.round(intervals / 2) * 2));
  const step = (upper - lower) / count;
  let sum = evaluateExpression(expression, { variables: { x: lower } })
    + evaluateExpression(expression, { variables: { x: upper } });
  for (let index = 1; index < count; index += 1) {
    const x = lower + index * step;
    const value = evaluateExpression(expression, { variables: { x } });
    sum += (index % 2 === 0 ? 2 : 4) * value;
  }
  return (sum * step) / 3;
}

export function solveEquation(expression, lower, upper) {
  assertSafeExpression(expression, new Set(["x", "ans"]));
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) {
    throw new Error("Верхняя граница должна быть больше нижней.");
  }
  const evaluateAt = (x) => evaluateExpression(expression, { variables: { x } });
  let left = lower;
  let right = upper;
  let leftValue = evaluateAt(left);
  let rightValue = evaluateAt(right);
  if (leftValue === 0) return left;
  if (rightValue === 0) return right;
  if (Math.sign(leftValue) === Math.sign(rightValue)) {
    throw new Error("На этих границах нет смены знака. Выберите другой интервал.");
  }
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middle = (left + right) / 2;
    const middleValue = evaluateAt(middle);
    if (Math.abs(middleValue) < 1e-12 || Math.abs(right - left) < 1e-12) return middle;
    if (Math.sign(middleValue) === Math.sign(leftValue)) {
      left = middle;
      leftValue = middleValue;
    } else {
      right = middle;
      rightValue = middleValue;
    }
  }
  return (left + right) / 2;
}

export function calculateMatrix(matrixText, operation, secondMatrixText = "") {
  const first = parseMatrix(matrixText);
  let result;
  switch (operation) {
    case "det":
      result = math.det(first);
      break;
    case "inv":
      result = math.inv(first);
      break;
    case "transpose":
      result = math.transpose(first);
      break;
    case "multiply": {
      const second = parseMatrix(secondMatrixText);
      result = math.multiply(first, second);
      break;
    }
    default:
      throw new Error("Выберите операцию с матрицей.");
  }
  return math.format(result, { precision: 8 });
}

function parseMatrix(text) {
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("Введите матрицу в формате [[1, 2], [3, 4]] с числами.");
  }
  if (!math.isMatrix(result) && !Array.isArray(result)) {
    throw new Error("Ожидается матрица.");
  }
  const matrix = math.matrix(result);
  if (matrix.size().length !== 2 || matrix.size().some((size) => size === 0)) {
    throw new Error("Матрица должна иметь строки и столбцы.");
  }
  if (matrix.toArray().flat(Infinity).some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) {
    throw new Error("Матрица должна содержать только конечные числа.");
  }
  return matrix;
}

export function convertUnit(value, from, to) {
  if (!Number.isFinite(value) || !from || !to) throw new Error("Заполните значение и выберите единицы.");
  try {
    return math.unit(value, from).to(to);
  } catch (error) {
    throw new Error(`Нельзя преобразовать ${from} в ${to}: ${error.message}`);
  }
}

function roundMoney(value) {
  if (!Number.isFinite(value)) throw new Error("Результат вышел за допустимый диапазон.");
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateLoan({ principal, annualRate, months, type = "annuity" }) {
  if (!Number.isFinite(principal) || principal <= 0) throw new Error("Укажите сумму кредита больше нуля.");
  if (!Number.isFinite(annualRate) || annualRate < 0) throw new Error("Укажите неотрицательную ставку.");
  if (!Number.isInteger(months) || months <= 0) throw new Error("Срок должен быть целым числом месяцев.");
  const monthlyRate = annualRate / 100 / 12;
  const schedule = [];
  let balance = principal;
  let totalPayment = 0;
  let totalInterest = 0;
  const annuityPayment = monthlyRate === 0
    ? principal / months
    : principal * monthlyRate / (1 - (1 + monthlyRate) ** -months);

  for (let month = 1; month <= months; month += 1) {
    const interest = roundMoney(balance * monthlyRate);
    const principalPart = type === "differential"
      ? (month === months ? balance : principal / months)
      : roundMoney(month === months ? balance : annuityPayment - interest);
    const payment = type === "differential"
      ? roundMoney(principalPart + interest)
      : roundMoney(month === months ? balance + interest : annuityPayment);
    balance = roundMoney(Math.max(0, balance - principalPart));
    totalPayment += payment;
    totalInterest += interest;
    schedule.push({
      month,
      payment: roundMoney(payment),
      interest,
      principal: roundMoney(principalPart),
      balance,
    });
  }

  totalPayment = type === "annuity"
    ? roundMoney(roundMoney(annuityPayment) * months)
    : roundMoney(totalPayment);
  totalInterest = roundMoney(totalInterest);
  const payment = type === "differential" ? schedule[0].payment : roundMoney(annuityPayment);
  return {
    payment,
    totalPayment,
    overpayment: roundMoney(totalPayment - principal),
    overpaymentPercent: roundMoney(((totalPayment - principal) / principal) * 100),
    schedule,
  };
}

export function calculateCompoundInterest(principal, annualRate, years) {
  if (!Number.isFinite(principal) || principal < 0) throw new Error("Укажите неотрицательную сумму.");
  if (!Number.isFinite(annualRate) || annualRate < 0) throw new Error("Укажите неотрицательную ставку.");
  if (!Number.isFinite(years) || years < 0) throw new Error("Укажите неотрицательный срок.");
  return roundMoney(principal * (1 + annualRate / 100) ** years);
}

export function calculateVat(amount, rate, mode = "add") {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Укажите неотрицательную сумму.");
  if (!Number.isFinite(rate) || rate < 0) throw new Error("Укажите неотрицательную ставку НДС.");
  if (mode === "extract") {
    const base = amount / (1 + rate / 100);
    const vat = amount - base;
    return { base: roundMoney(base), vat: roundMoney(vat), total: roundMoney(amount) };
  }
  const vat = amount * rate / 100;
  return { base: roundMoney(amount), vat: roundMoney(vat), total: roundMoney(amount + vat) };
}

export function calculateMarkupMargin(cost, markupPercent) {
  if (!Number.isFinite(cost) || cost < 0) throw new Error("Укажите неотрицательную себестоимость.");
  if (!Number.isFinite(markupPercent) || markupPercent < -100) throw new Error("Наценка должна быть больше или равна -100 %.");
  const selling = cost * (1 + markupPercent / 100);
  if (selling <= 0) throw new Error("Цена продажи должна быть больше нуля.");
  return {
    selling: roundMoney(selling),
    margin: roundMoney(((selling - cost) / selling) * 100),
  };
}

const lengthUnits = {
  m: 1,
  km: 1000,
  cm: 0.01,
  mm: 0.001,
  mi: 1609.344,
  ft: 0.3048,
  in: 0.0254,
};

const massUnits = {
  kg: 1,
  g: 0.001,
  mg: 0.000001,
  t: 1000,
  lb: 0.45359237,
  oz: 0.028349523125,
};

export function convertProfessionalUnit(value, category, from, to) {
  if (!Number.isFinite(value)) throw new Error("Введите корректное число.");
  if (category === "temperature") {
    let celsius;
    if (from === "c") celsius = value;
    if (from === "f") celsius = (value - 32) * 5 / 9;
    if (from === "k") celsius = value - 273.15;
    let result;
    if (to === "c") result = celsius;
    if (to === "f") result = celsius * 9 / 5 + 32;
    if (to === "k") result = celsius + 273.15;
    if (!Number.isFinite(result)) throw new Error("Выберите единицы температуры.");
    return roundMoney(result);
  }
  const units = category === "length" ? lengthUnits : category === "mass" ? massUnits : null;
  if (!units?.[from] || !units[to]) throw new Error("Выберите единицы измерения.");
  return roundMoney(value * units[from] / units[to]);
}
