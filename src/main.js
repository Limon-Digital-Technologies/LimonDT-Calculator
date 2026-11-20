import "./style.css";
import { createClient } from "@supabase/supabase-js";
import { isTauri } from "@tauri-apps/api/core";
import { Effect, getCurrentWindow } from "@tauri-apps/api/window";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import logoUrl from "../128x128.png";
import {
  calculateProgrammerOperation,
  calculateLoan,
  calculateCompoundInterest,
  calculateVat,
  calculateMarkupMargin,
  convertProfessionalUnit,
  evaluateExpression,
  evaluateWorkspace,
  formatResult,
  formatProgrammerInteger,
  getWorkspaceFunctionSuggestions,
  getProgrammerRange,
  parseProgrammerInteger,
} from "./calculator-engine.js";
import {
  parseChartData,
  sampleFunction,
} from "./visualizations.js";

const historyKey = "limon-calculator-history-v1";
const workspaceKey = "limon-calculator-workspace-v1";
const financeCurrencyKey = "limon-calculator-finance-currency-v1";
const appSettingsKey = "limon-calculator-settings-v1";
const root = document.querySelector("#app");
const nativeWindow = isTauri() ? getCurrentWindow() : null;
let nativeAppearanceRequest = "";
let nativeAppearanceRevision = 0;
let nativeAppearanceTask = Promise.resolve();
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://bohmllowuxdzhrxalewn.supabase.co";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || "sb_publishable_UbVxmJIgPJ3k_NJj5zTLhA_xKkp_kaF";
const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
const financeCurrencies = [
  ["RUB", "Российский рубль"],
  ["USD", "Доллар США"],
  ["EUR", "Евро"],
  ["GBP", "Фунт стерлингов"],
  ["CNY", "Китайский юань"],
  ["KZT", "Казахстанский тенге"],
  ["JPY", "Японская иена"],
];
let lastRenderedScreen = null;
const modes = ["normal", "advanced", "professional"];
const modeLabels = {
  normal: "Обычный",
  advanced: "Продвинутый",
  professional: "Профессиональный",
};
function readAppSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(appSettingsKey) || "{}");
    return {
      language: saved.language === "en" ? "en" : "ru",
      theme: saved.theme === "dark" ? "dark" : "light",
      appearance: ["standard", "translucent", "liquid-glass"].includes(saved.appearance)
        ? saved.appearance
        : "standard",
    };
  } catch {
    return { language: "ru", theme: "light", appearance: "standard" };
  }
}

const savedAppSettings = readAppSettings();
const state = {
  mode: "normal",
  expression: "",
  result: "0",
  error: "",
  history: readHistory(),
  lastAnswer: 0,
  justEvaluated: false,
  angle: "DEG",
  secondFunction: false,
  memory: 0,
  hasMemory: false,
  professionalTab: "function",
  functionDraft: { expression: "x^2", min: "-10", max: "10", angleUnit: "RAD" },
  functionGraph: null,
  functionError: "",
  chartDraft: { type: "bar", labels: "", values: "" },
  chartData: null,
  chartError: "",
  professionalExpression: "",
  professionalAngle: "RAD",
  professionalResult: "",
  professionalError: "",
  workspaceText: readWorkspaceText(),
  workspaceAngle: "DEG",
  workspaceCursor: { start: 0, end: 0, line: 1 },
  workspaceAutocomplete: null,
  professionalTool: "workspace",
  programmerBits: 32,
  programmerSigned: false,
  programmerA: "255",
  programmerB: "15",
  programmerError: "",
  professionalFinanceTab: "loan",
  financeDraft: {
    principal: "500000",
    annualRate: "12",
    months: "36",
    loanType: "annuity",
  },
  financeCurrency: readFinanceCurrency(),
  financeVatRate: "20",
  accountOpen: false,
  accountReady: false,
  accountUser: null,
  accountAuthMode: "sign-in",
  accountAuthBusy: false,
  accountAuthMessage: null,
  accountAuthDraft: { name: "", email: "" },
  accountSettingsOpen: false,
  language: savedAppSettings.language,
  theme: savedAppSettings.theme,
  appearance: savedAppSettings.appearance,
  converterCategory: "length",
  converterValue: "1",
  converterFrom: "m",
  converterTo: "km",
};

function readFinanceCurrency() {
  try {
    const savedCurrency = localStorage.getItem(financeCurrencyKey);
    return financeCurrencies.some(([code]) => code === savedCurrency) ? savedCurrency : "RUB";
  } catch {
    return "RUB";
  }
}

function readHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey) || "[]");
    return Array.isArray(saved) ? saved.slice(0, 30) : [];
  } catch {
    return [];
  }
}

function defaultWorkspaceText() {
  return [
    "# Пример расчёта",
    "цена = 1200",
    "налог = 20%",
    "итого = цена + налог",
    "итого / 3",
    "",
    "sin(30) + log(1000)",
    "avg(12; 18; 25; 31)",
    "median(3; 9; 4; 10)",
    "2^10 mod 1000",
    "nCr(10; 3)",
  ].join("\n");
}

function readWorkspaceText() {
  try {
    return localStorage.getItem(workspaceKey) ?? defaultWorkspaceText();
  } catch {
    return defaultWorkspaceText();
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

const englishTranslations = {
  "Точность в каждом вычислении": "Precision in every calculation",
  "Обычный": "Basic",
  "Продвинутый": "Advanced",
  "Профессиональный": "Professional",
  "Введите выражение": "Enter an expression",
  "Скопировать результат": "Copy result",
  "Клавиатура калькулятора": "Calculator keypad",
  "ВАШИ ДАННЫЕ": "YOUR DATA",
  "История": "History",
  "Очистить": "Clear",
  "История хранится только на этом устройстве": "History is stored on this device only",
  "История пока пуста": "No history yet",
  "Ваши вычисления будут здесь": "Your calculations will appear here",
  "Режим калькулятора": "Calculator mode",
  "Режим аккаунта": "Account mode",
  "Аккаунт Limon": "Limon account",
  "Язык интерфейса": "Interface language",
  "Тема приложения": "App theme",
  "Стиль оформления": "Visual style",
  "Валюта финансовых расчётов": "Financial calculation currency",
  "Инструменты финансового режима": "Finance tools",
  "Категория конвертера": "Converter category",
  "Разрядность": "Bit width",
  "Подпись числа": "Number sign",
  "Калькулятор памяти": "Calculator memory",
  "НАУЧНЫЕ ФУНКЦИИ": "SCIENTIFIC FUNCTIONS",
  "График функции": "Function graph",
  "Диаграмма по данным": "Data chart",
  "Расчёты": "Calculations",
  "Здесь появится график": "Your graph will appear here",
  "Введите функцию и диапазон значений x.": "Enter a function and an x range.",
  "ФУНКЦИОНАЛЬНЫЙ ГРАФИК": "FUNCTION GRAPH",
  "Исследуйте любую функцию": "Explore any function",
  "Используйте x, скобки и функции: sin, cos, log, sqrt.": "Use x, parentheses, and functions: sin, cos, log, sqrt.",
  "ПАРАМЕТРЫ": "PARAMETERS",
  "Построить график": "Plot graph",
  "Функция f(x)": "Function f(x)",
  "Например: sin(x) * x": "For example: sin(x) * x",
  "От x": "From x",
  "До x": "To x",
  "Углы в тригонометрии": "Trigonometric angle unit",
  "Радианы": "Radians",
  "Градусы": "Degrees",
  "Примеры": "Examples",
  "ВАША ДИАГРАММА": "YOUR CHART",
  "Круговая диаграмма": "Pie chart",
  "Линейный график": "Line graph",
  "Столбчатая диаграмма": "Bar chart",
  "Постройте диаграмму по своим данным": "Build a chart from your data",
  "значений": "values",
  "ИСТОЧНИК ДАННЫХ": "DATA SOURCE",
  "Настройка диаграммы": "Chart settings",
  "Тип": "Type",
  "Столбчатая": "Bar",
  "Линейная": "Line",
  "Круговая": "Pie",
  "Подписи — по одной в строке": "Labels — one per line",
  "Значения — в том же порядке": "Values — in the same order",
  "Например:": "For example:",
  "Визуализируйте свои данные": "Visualize your data",
  "Добавьте подписи и значения — выберите столбчатую, линейную или круговую диаграмму.": "Add labels and values, then choose a bar, line, or pie chart.",
  "СВОБОДНОЕ ВЫРАЖЕНИЕ": "FREE-FORM EXPRESSION",
  "Математический расчёт": "Math calculation",
  "Выражение": "Expression",
  "Например: 2^8 + sqrt(81)": "For example: 2^8 + sqrt(81)",
  "Единицы углов": "Angle unit",
  "Вычислить": "Calculate",
  "РЕЗУЛЬТАТ": "RESULT",
  "Копировать": "Copy",
  "Можно использовать арифметику, степени, скобки, проценты и функции sqrt, sin, cos, log.": "Use arithmetic, powers, parentheses, percentages, and functions such as sqrt, sin, cos, and log.",
  "НА ЭТОМ УСТРОЙСТВЕ": "ON THIS DEVICE",
  "История расчётов": "Calculation history",
  "Вычисления появятся здесь.": "Calculations will appear here.",
  "Программист": "Programmer",
  "Битовые операции, разрядность и точные границы значений.": "Bitwise operations, bit width, and exact value ranges.",
  "Разрядность": "Bit width",
  "Подпись числа": "Number sign",
  "бит": "bits",
  "Без знака": "Unsigned",
  "Со знаком": "Signed",
  "Значение A": "Value A",
  "Значение B": "Value B",
  "Сетка битов A": "A bit grid",
  "Клик переключает бит": "Click to toggle a bit",
  "Вставить в рабочую область": "Insert into workspace",
  "ДИАПАЗОН": "RANGE",
  "Минимум": "Minimum",
  "Максимум": "Maximum",
  "A И B": "A AND B",
  "Операции": "Operations",
  "Финансы": "Finance",
  "Кредиты, проценты, НДС, наценка и маржа.": "Loans, interest, VAT, markup, and margin.",
  "Валюта расчётов": "Calculation currency",
  "Суммы в выбранной валюте; обмена нет": "Amounts use this currency; no exchange",
  "Кредит": "Loan",
  "Проценты и НДС": "Interest and VAT",
  "Сумма кредита": "Loan amount",
  "Годовая ставка, %": "Annual rate, %",
  "Срок, месяцев": "Term, months",
  "Тип платежа": "Payment type",
  "Аннуитетный": "Annuity",
  "Дифференцированный": "Differentiated",
  "Платёж": "Payment",
  "Общая выплата": "Total paid",
  "Переплата": "Overpayment",
  "Формула для рабочей области": "Workspace formula",
  "Вставить строку": "Insert formula",
  "Месяц": "Month",
  "Проценты": "Interest",
  "Основной долг": "Principal",
  "Остаток": "Balance",
  "Экспорт графика в CSV": "Export schedule to CSV",
  "СЛОЖНЫЙ ПРОЦЕНТ": "COMPOUND INTEREST",
  "Рост вложений": "Investment growth",
  "Вставить в рабочую область": "Insert into workspace",
  "НДС": "VAT",
  "Начислить или выделить": "Add or extract",
  "Ставка НДС, %": "VAT rate, %",
  "НАЦЕНКА И МАРЖА": "MARKUP AND MARGIN",
  "Пример расчёта": "Calculation example",
  "Конвертер": "Converter",
  "Длина, масса и температура.": "Length, mass, and temperature.",
  "Длина": "Length",
  "Масса": "Mass",
  "Температура": "Temperature",
  "Значение": "Value",
  "Из": "From",
  "В": "To",
  "Результат": "Result",
  "Рабочая область": "Workspace",
  "Вводите выражения и переменные построчно — результаты обновляются сразу.": "Enter expressions and variables line by line; results update instantly.",
  "Переключить единицы углов": "Toggle angle units",
  "Единицы углов": "Angle units",
  "Действия с рабочей областью": "Workspace actions",
  "Скопировать значения": "Copy values",
  "Скопировать текст строк": "Copy line text",
  "Скопировать строки": "Copy lines",
  "Сохранить результаты в CSV": "Save results as CSV",
  "Экспорт CSV": "Export CSV",
  "Enter — новая строка": "Enter — new line",
  "# — комментарий": "# — comment",
  "Точность: 10 значащих цифр": "Precision: 10 significant digits",
  "ТЕКУЩАЯ СЕССИЯ": "CURRENT SESSION",
  "Переменные": "Variables",
  "Вставить последний результат": "Insert the last result",
  "Присваивайте значения, например цена = 1200": "Assign values, e.g. price = 1200",
  "Текст сохраняется на этом устройстве.": "Text is saved on this device.",
  "ИНСТРУМЕНТЫ": "TOOLS",
  "Профессиональные": "Professional tools",
  "Системы счисления и биты": "Number bases and bits",
  "Кредит, проценты, НДС": "Loans, interest, VAT",
  "Открыть": "Open",
  "БЫСТРАЯ СПРАВКА": "QUICK REFERENCE",
  "Функции": "Functions",
  "Проверяем аккаунт…": "Checking account…",
  "АККАУНТ LIMON": "LIMON ACCOUNT",
  "Ваш аккаунт": "Your account",
  "Добро пожаловать": "Welcome",
  "Вы вошли в аккаунт Limon. Подключение общих данных между приложениями появится позже.": "You are signed in to Limon. Cross-app data sharing will be available later.",
  "Войти": "Sign in",
  "Регистрация": "Sign up",
  "Почта": "Email",
  "Имя": "Name",
  "Как к вам обращаться": "Your name",
  "Пароль": "Password",
  "Не менее 6 символов": "At least 6 characters",
  "Введите пароль": "Enter your password",
  "Создать аккаунт": "Create account",
  "Подождите…": "Please wait…",
  "Один аккаунт для экосистемы Limon. Синхронизация данных появится позже.": "One account for the Limon ecosystem. Data sync will be added later.",
  "Выйти из аккаунта": "Sign out",
  "Выходим…": "Signing out…",
  "Закрыть меню аккаунта": "Close account menu",
  "Открыть аккаунт или войти": "Open account or sign in",
  "Настройки": "Settings",
  "Язык": "Language",
  "Тема": "Theme",
  "Внешний вид": "Appearance",
  "Стандартный": "Standard",
  "Полупрозрачный": "Translucent",
  "Жидкое стекло": "Liquid glass",
  "Не удалось применить системный эффект окна.": "The system window effect could not be applied.",
  "Светлая": "Light",
  "Тёмная": "Dark",
  "Сохранить": "Save",
  "Российский рубль": "Russian ruble",
  "Доллар США": "US dollar",
  "Евро": "Euro",
  "Фунт стерлингов": "Pound sterling",
  "Китайский юань": "Chinese yuan",
  "Казахстанский тенге": "Kazakhstani tenge",
  "Японская иена": "Japanese yen",
  "Метр": "Meter",
  "Километр": "Kilometer",
  "Сантиметр": "Centimeter",
  "Миллиметр": "Millimeter",
  "Миля": "Mile",
  "Фут": "Foot",
  "Дюйм": "Inch",
  "Килограмм": "Kilogram",
  "Грамм": "Gram",
  "Миллиграмм": "Milligram",
  "Тонна": "Tonne",
  "Фунт": "Pound",
  "Унция": "Ounce",
  "Цельсий": "Celsius",
  "Фаренгейт": "Fahrenheit",
  "Кельвин": "Kelvin",
  "Подтвердите email по ссылке из письма, затем войдите.": "Confirm your email using the link we sent, then sign in.",
  "Неверный email или пароль.": "Incorrect email or password.",
  "Аккаунт с таким email уже существует. Попробуйте войти.": "An account with this email already exists. Try signing in.",
  "Пароль должен содержать не менее 6 символов.": "Password must be at least 6 characters.",
  "Проверьте правильность email.": "Check that the email address is valid.",
  "Не удалось связаться с аккаунтом Limon. Проверьте подключение к интернету.": "Could not reach Limon account services. Check your internet connection.",
  "Не удалось выполнить запрос. Попробуйте ещё раз.": "The request failed. Please try again.",
  "Укажите имя, которое будет отображаться в профиле.": "Enter the name to show on your profile.",
  "Аккаунт создан. Проверьте почту и подтвердите email, затем войдите.": "Account created. Check your inbox to confirm your email, then sign in.",
  "Результат скопирован": "Result copied",
  "Не удалось скопировать результат": "Could not copy result",
  "CSV сохранён": "CSV saved",
  "Не удалось сохранить CSV": "Could not save CSV",
  "Не удалось сохранить настройки на этом устройстве.": "Could not save settings on this device.",
  "Русский": "Russian",
  "English": "English",
  "Результат будет вставлен в рабочую область.": "The result will be inserted into the workspace.",
  "Отправить в рабочую область": "Send to workspace",
  "Наценка должна быть больше или равна -100 %.": "Markup must be greater than or equal to -100%.",
  "Имя «имя» зарезервировано.": "The name is reserved.",
  "Используйте присваивание в формате «имя = выражение»": "Use an assignment in the form 'name = expression'.",
  "Не удалось рассчитать кредит.": "Could not calculate the loan.",
  "Укажите сумму и ненулевую ставку.": "Enter an amount and a non-zero rate.",
  "Укажите ставку НДС.": "Enter a VAT rate.",
  "Не удалось сохранить выбранную валюту на этом устройстве": "Could not save the selected currency on this device.",
  "Название аккаунта": "Account",
  "sin(x) — синус": "sin(x) — sine",
  "cos(x) — косинус": "cos(x) — cosine",
  "tan(x) — тангенс": "tan(x) — tangent",
  "asin(x) — арксинус": "asin(x) — arcsine",
  "acos(x) — арккосинус": "acos(x) — arccosine",
  "atan(x) — арктангенс": "atan(x) — arctangent",
  "ln(x) — натуральный логарифм": "ln(x) — natural logarithm",
  "log(x) — десятичный логарифм": "log(x) — base-10 logarithm",
  "sqrt(x) — квадратный корень": "sqrt(x) — square root",
  "abs(x) — модуль": "abs(x) — absolute value",
  "round(x; знаки) — округление": "round(x; digits) — round",
  "floor(x) — округление вниз": "floor(x) — round down",
  "ceil(x) — округление вверх": "ceil(x) — round up",
  "min(x; ...) — минимум": "min(x; ...) — minimum",
  "max(x; ...) — максимум": "max(x; ...) — maximum",
  "sum(x; ...) — сумма": "sum(x; ...) — sum",
  "avg(x; ...) — среднее": "avg(x; ...) — average",
  "median(x; ...) — медиана": "median(x; ...) — median",
  "stdev(x; ...) — стандартное отклонение": "stdev(x; ...) — standard deviation",
  "nCr(n; k) — число сочетаний": "nCr(n; k) — combinations",
  "nPr(n; k) — число размещений": "nPr(n; k) — permutations",
  "pmt(сумма; годовая ставка; месяцы) — платёж": "pmt(principal; annual rate; months) — payment",
  "Проверьте выражение и попробуйте ещё раз": "Check the expression and try again",
  "Продолжайте вычисление с этим результатом": "Continue calculating with this result",
  "Выражение остаётся на экране — продолжайте редактировать": "The expression stays on screen — keep editing",
  "В памяти есть значение": "A value is stored in memory",
  "Переключить режим углов": "Toggle angle mode",
  "Режим углов": "Angle mode",
  "В памяти": "In memory",
  "Очистить память": "Clear memory",
  "Вставить значение из памяти": "Recall memory",
  "Прибавить результат к памяти": "Add result to memory",
  "Вычесть результат из памяти": "Subtract result from memory",
  "Вставить предыдущий результат": "Insert previous result",
  "↵ вычислить": "↵ calculate",
  "Esc очистить": "Esc clear",
  "⌫ удалить символ": "⌫ delete character",
  "Профессиональные вычисления": "Professional calculations",
  "Доступно": "Available",
  "Знаковость": "Signedness",
  "НЕ": "NOT",
  "Арифметика": "Arithmetic",
  "← Рабочая область": "← Workspace",
  "Длина, масса, температура": "Length, mass, and temperature",
  "Степени и корни": "Powers and roots",
  "Двоичные операции": "Bitwise operations",
  "Укажите хотя бы одно число для": "Enter at least one value for",
  "Некорректное целое число.": "Invalid integer.",
  "Неверная ширина разрядности.": "Invalid bit width.",
  "Не удалось преобразовать единицы.": "Could not convert units.",
  "Укажите конечный диапазон, где начало меньше конца.": "Enter a finite range with the start below the end.",
  "Количество точек графика должно быть от 2 до 1001.": "The graph must contain between 2 and 1001 points.",
  "На выбранном промежутке нет вещественных значений функции.": "The function has no real values in the selected range.",
  "Выберите доступный тип диаграммы.": "Choose an available chart type.",
  "Добавьте от 2 до 20 подписанных строк данных.": "Add 2 to 20 labeled data rows.",
  "Количество подписей и чисел должно совпадать.": "The number of labels must match the number of values.",
  "Для круговой диаграммы нужны значения не меньше нуля.": "Pie chart values must be zero or greater.",
  "Для круговой диаграммы нужна хотя бы одна сумма больше нуля.": "A pie chart needs at least one value greater than zero.",
  "Это выражение нельзя вычислить в калькуляторе.": "This expression cannot be evaluated in the calculator.",
  "Эта функция недоступна в калькуляторе.": "This function is not available in the calculator.",
  "Логарифм определён только для положительных чисел.": "Logarithms are defined only for positive numbers.",
  "Тангенс не определён для этого угла.": "Tangent is undefined for this angle.",
  "Нельзя извлечь квадратный корень из отрицательного числа.": "Cannot take the square root of a negative number.",
  "Факториал определён только для целых неотрицательных чисел.": "Factorial is defined only for non-negative integers.",
  "Факториал поддерживает значения не больше 170.": "Factorial supports values up to 170.",
  "Результат вышел за допустимый диапазон.": "The result is outside the supported range.",
  "Некорректное число.": "Invalid number.",
  "Введите выражение.": "Enter an expression.",
  "Нельзя применять процент дважды.": "A percentage cannot be applied twice.",
  "Деление на ноль невозможно.": "Division by zero is not allowed.",
  "Остаток от деления на ноль не определён.": "Remainder by zero is undefined.",
  "Не удалось разобрать выражение.": "Could not parse the expression.",
  "После знака «=» введите выражение.": "Enter an expression after '='.",
  "Введите число.": "Enter a number.",
  "Введите целое число в HEX, DEC, OCT или BIN.": "Enter an integer in HEX, DEC, OCT, or BIN.",
  "Сдвиг не может быть больше 64.": "Shift amount cannot exceed 64.",
  "Выберите операцию.": "Choose an operation.",
  "Укажите сумму кредита больше нуля.": "Enter a loan amount greater than zero.",
  "Укажите неотрицательную ставку.": "Enter a non-negative rate.",
  "Срок должен быть целым числом месяцев.": "The term must be a whole number of months.",
  "Укажите неотрицательную сумму.": "Enter a non-negative amount.",
  "Укажите неотрицательный срок.": "Enter a non-negative term.",
  "Укажите неотрицательную ставку НДС.": "Enter a non-negative VAT rate.",
  "Укажите неотрицательную себестоимость.": "Enter a non-negative cost.",
  "Цена продажи должна быть больше нуля.": "The sale price must be greater than zero.",
  "Введите корректное число.": "Enter a valid number.",
  "Выберите единицы температуры.": "Choose temperature units.",
  "Выберите единицы измерения.": "Choose measurement units.",
  "Укажите значение и выберите единицы.": "Enter a value and choose units.",
  "Для памяти нужен конечный числовой результат.": "Memory requires a finite numeric result.",
  "Значение памяти вышло за допустимый диапазон.": "Memory value is outside the supported range.",
};

const originalTextValues = new WeakMap();
const originalAttributeValues = new WeakMap();

function translateUiText(text) {
  if (state.language !== "en") return text;
  if (englishTranslations[text]) return englishTranslations[text];
  const insertionHint = text.match(/^Вставить (.+) в редактор$/);
  if (insertionHint) return `Insert ${insertionHint[1]} into the editor`;
  const bitLabel = text.match(/^Бит (\d+): (включён|выключен)$/);
  if (bitLabel) return `Bit ${bitLabel[1]}: ${bitLabel[2] === "включён" ? "on" : "off"}`;
  const lineError = text.match(/^Ошибка: (.+)$/);
  if (lineError) return `Error: ${translateUiText(lineError[1])}`;
  const bitRange = text.match(/^(\d+) бит · (со знаком|без знака)$/);
  if (bitRange) return `${bitRange[1]} bits · ${bitRange[2] === "со знаком" ? "signed" : "unsigned"}`;
  const bitWidth = text.match(/^(\d+) бит$/);
  if (bitWidth) return `${bitWidth[1]} bits`;
  const hiddenRows = text.match(/^(\d+) значений$/);
  if (hiddenRows) return `${hiddenRows[1]} values`;
  const accountName = text.match(/^Открыть аккаунт (.+)$/);
  if (accountName) return `Open account ${accountName[1]}`;
  const chartCount = text.match(/^(\d+) значений$/);
  if (chartCount) return `${chartCount[1]} values`;
  const resultLine = text.match(/^Результат строки (\d+): (.+)$/);
  if (resultLine) return `Line ${resultLine[1]} result: ${resultLine[2]}`;
  const currency = text.match(/^(RUB|USD|EUR|GBP|CNY|KZT|JPY)\s+—\s+(.+)$/);
  if (currency) return `${currency[1]} — ${translateUiText(currency[2])}`;
  const addVat = text.match(/^Добавить к (.+)$/);
  if (addVat) return `Add VAT to ${addVat[1]}`;
  const extractVat = text.match(/^Выделить из (.+)$/);
  if (extractVat) return `Extract VAT from ${extractVat[1]}`;
  const marginExample = text.match(/^Себестоимость (.+) · наценка (.+)$/);
  if (marginExample) return `Cost ${marginExample[1]} · ${marginExample[2]} markup`;
  const marginResult = text.match(/^Маржа: (.+)$/);
  if (marginResult) return `Margin: ${marginResult[1]}`;
  const vatAmount = text.match(/^НДС (.+)$/);
  if (vatAmount) return `VAT ${vatAmount[1]}`;
  const fixedInvestment = text.match(/^(.+) · 8 % годовых · 5 лет$/);
  if (fixedInvestment) return `${fixedInvestment[1]} · 8% annual · 5 years`;
  const invalidLabel = text.match(/^Проверьте число для «(.+)»\.$/);
  if (invalidLabel) return `Check the value for "${invalidLabel[1]}".`;
  const unexpected = text.match(/^Неожиданный символ «(.+)»\.?$/);
  if (unexpected) return `Unexpected character "${unexpected[1]}".`;
  const unknown = text.match(/^Неизвестный (символ|переменная) «(.+)»\.?$/);
  if (unknown) return `Unknown ${unknown[1] === "символ" ? "symbol" : "variable"} "${unknown[2]}".`;
  const unavailableFunction = text.match(/^Функция «(.+)» недоступна в (.+)\.$/);
  if (unavailableFunction) {
    const area = unavailableFunction[2] === "рабочей области" ? "the workspace" : "the calculator";
    return `Function "${unavailableFunction[1]}" is not available in ${area}.`;
  }
  const unsupportedOperator = text.match(/^Оператор «(.+)» не поддерживается\.$/);
  if (unsupportedOperator) return `Operator "${unsupportedOperator[1]}" is not supported.`;
  const reservedName = text.match(/^Имя «(.+)» зарезервировано\.$/);
  if (reservedName) return `"${reservedName[1]}" is a reserved name.`;
  const overflow = text.match(/^Переполнение: допустимый диапазон (.+) … (.+)\.$/);
  if (overflow) return `Overflow: allowed range is ${overflow[1]} to ${overflow[2]}.`;
  const conversionFailure = text.match(/^Нельзя преобразовать (.+) в (.+): (.+)$/);
  if (conversionFailure) return `Cannot convert ${conversionFailure[1]} to ${conversionFailure[2]}: ${translateUiText(conversionFailure[3])}`;
  const copiedProgrammerValue = text.match(/^Скопировать (HEX|DEC|OCT|BIN)$/);
  if (copiedProgrammerValue) return `Copy ${copiedProgrammerValue[1]}`;
  const yearsRate = text.match(/^(.+) · ([\d.,]+) % годовых · (\d+) лет$/);
  if (yearsRate) return `${yearsRate[1]} · ${yearsRate[2]}% annual · ${yearsRate[3]} years`;
  return text;
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  const ignoredTextSelectors = ".workspace-editor, .history-item, .professional-history-item, .workspace-variable, .chart-legend, .programmer-base-card, .account-profile, code, svg";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (!node.parentElement?.closest(ignoredTextSelectors)) {
      if (!originalTextValues.has(node)) originalTextValues.set(node, node.nodeValue);
      const original = originalTextValues.get(node);
      const trimmed = original.trim();
      if (trimmed) {
        const leading = original.slice(0, original.indexOf(trimmed));
        const trailing = original.slice(original.indexOf(trimmed) + trimmed.length);
        node.nodeValue = `${leading}${translateUiText(trimmed)}${trailing}`;
      }
    }
    node = walker.nextNode();
  }

  root.querySelectorAll("[aria-label], [title], [placeholder]").forEach((element) => {
    let originals = originalAttributeValues.get(element);
    if (!originals) {
      originals = new Map();
      originalAttributeValues.set(element, originals);
    }
    for (const attribute of ["aria-label", "title", "placeholder"]) {
      if (!element.hasAttribute(attribute)) continue;
      if (!originals.has(attribute)) originals.set(attribute, element.getAttribute(attribute));
      element.setAttribute(attribute, translateUiText(originals.get(attribute)));
    }
  });
}

function uiLocale() {
  return state.language === "en" ? "en-US" : "ru-RU";
}

function saveAppSettings() {
  try {
    localStorage.setItem(appSettingsKey, JSON.stringify({
      language: state.language,
      theme: state.theme,
      appearance: state.appearance,
    }));
  } catch {
    showToast("Не удалось сохранить настройки на этом устройстве.");
  }
}

function syncNativeWindowAppearance() {
  if (!nativeWindow) return;
  const signature = state.appearance;
  if (signature === nativeAppearanceRequest) return;
  nativeAppearanceRequest = signature;
  const revision = ++nativeAppearanceRevision;
  const userAgent = navigator.userAgent.toLowerCase();
  let effects = null;

  if (state.appearance !== "standard") {
    if (userAgent.includes("windows")) {
      effects = { effects: [Effect.Acrylic] };
    } else if (userAgent.includes("macintosh")) {
      effects = state.appearance === "liquid-glass"
        ? { effects: [Effect.LiquidGlassRegular, Effect.Popover] }
        : { effects: [Effect.Popover] };
    }
  }

  nativeAppearanceTask = nativeAppearanceTask.then(async () => {
    if (revision !== nativeAppearanceRevision) return;
    try {
      if (effects) {
        await nativeWindow.setEffects(effects);
      } else {
        await nativeWindow.clearEffects();
      }
      if (revision !== nativeAppearanceRevision) return;
      const hasNativeEffects = Boolean(effects);
      document.documentElement.classList.toggle("native-window-effects", hasNativeEffects);
      document.body.classList.toggle("native-window-effects", hasNativeEffects);
    } catch (error) {
      if (revision !== nativeAppearanceRevision) return;
      nativeAppearanceRequest = "";
      document.documentElement.classList.remove("native-window-effects");
      document.body.classList.remove("native-window-effects");
      console.error("Could not apply native window material", error);
      showToast("Не удалось применить системный эффект окна.");
    }
  });
}

function accountProfile(user) {
  const email = user.email || "";
  const name = user.user_metadata?.full_name?.trim()
    || user.user_metadata?.name?.trim()
    || email.split("@")[0]
    || "Аккаунт Limon";
  const initials = name.split(/\s+/).slice(0, 2).map((part) => [...part][0]).join("").toLocaleUpperCase("ru-RU");
  return { id: user.id, name, email, initials };
}

function accountAuthNotice() {
  if (!state.accountAuthMessage) return "";
  const type = state.accountAuthMessage.type === "error" ? "error" : "success";
  return `<div class="account-auth-notice account-auth-notice--${type}" role="${type === "error" ? "alert" : "status"}">${escapeHtml(state.accountAuthMessage.text)}</div>`;
}

function renderAccountDrawer() {
  const signedIn = Boolean(state.accountUser);
  const signUp = state.accountAuthMode === "sign-up";
  const disabled = state.accountAuthBusy;
  const avatar = signedIn
    ? `<span class="account-avatar">${escapeHtml(state.accountUser.initials)}</span>`
    : `<span class="account-avatar account-avatar--guest" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20a6.5 6.5 0 0 1 13 0"></path></svg></span>`;
  const accountContent = !state.accountReady
    ? `<div class="account-loading"><span class="account-loading__spinner"></span><p>Проверяем аккаунт…</p></div>`
    : signedIn
      ? `<div class="account-profile">${avatar}<div><strong>${escapeHtml(state.accountUser.name)}</strong><span>${escapeHtml(state.accountUser.email)}</span></div></div>
        <p class="account-description">Вы вошли в аккаунт Limon. Подключение общих данных между приложениями появится позже.</p>
        ${accountAuthNotice()}
        <button class="button button--secondary account-sign-out" type="button" data-auth-action="sign-out" ${disabled ? "disabled" : ""}>${disabled ? "Выходим…" : "Выйти из аккаунта"}</button>`
      : `<div class="account-mode-switch" role="tablist" aria-label="Режим аккаунта">
          <button type="button" role="tab" aria-selected="${!signUp}" class="${!signUp ? "is-selected" : ""}" data-account-auth-mode="sign-in">Войти</button>
          <button type="button" role="tab" aria-selected="${signUp}" class="${signUp ? "is-selected" : ""}" data-account-auth-mode="sign-up">Регистрация</button>
        </div>
        ${accountAuthNotice()}
        <form class="account-auth-form" id="account-auth-form">
          ${signUp ? `<label>Имя<input data-account-auth-field name="name" type="text" autocomplete="name" maxlength="80" placeholder="Как к вам обращаться" value="${escapeHtml(state.accountAuthDraft.name)}" required ${disabled ? "disabled" : ""} /></label>` : ""}
          <label>Email<input data-account-auth-field name="email" type="email" autocomplete="email" maxlength="254" placeholder="name@example.com" value="${escapeHtml(state.accountAuthDraft.email)}" required ${disabled ? "disabled" : ""} /></label>
          <label>Пароль<input name="password" type="password" autocomplete="${signUp ? "new-password" : "current-password"}" minlength="6" placeholder="${signUp ? "Не менее 6 символов" : "Введите пароль"}" required ${disabled ? "disabled" : ""} /></label>
          <button class="button button--primary account-auth-submit" type="submit" ${disabled ? "disabled" : ""}>${disabled ? "Подождите…" : signUp ? "Создать аккаунт" : "Войти"}</button>
        </form>
        <p class="account-description">Один аккаунт для экосистемы Limon. Синхронизация данных появится позже.</p>`;

  return `<div class="account-overlay" data-account-overlay aria-hidden="${!state.accountOpen}">
    <button class="account-scrim" type="button" data-account-close aria-label="Закрыть меню аккаунта"></button>
    <aside class="account-drawer" id="account-drawer" role="dialog" aria-modal="${state.accountOpen}" aria-labelledby="account-drawer-title" tabindex="-1">
      <header class="account-drawer__heading">
        <div>${avatar}<div><span class="professional-eyebrow">АККАУНТ LIMON</span><h2 id="account-drawer-title">${signedIn ? "Ваш аккаунт" : "Добро пожаловать"}</h2></div></div>
        <button class="account-drawer__close" type="button" data-account-close aria-label="Закрыть меню аккаунта"><span aria-hidden="true"></span></button>
      </header>
      ${accountContent}
      <section class="account-settings">
        <button class="account-settings__toggle" type="button" data-account-settings-toggle aria-expanded="${state.accountSettingsOpen}">
          <span><span class="account-settings__icon" aria-hidden="true">⚙</span><span>Настройки</span></span><span class="account-settings__chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="account-settings__fields ${state.accountSettingsOpen ? "is-expanded" : ""}" aria-hidden="${!state.accountSettingsOpen}">
          <label>Язык<select data-app-setting="language" aria-label="Язык интерфейса">
            <option value="ru" ${state.language === "ru" ? "selected" : ""}>Русский</option>
            <option value="en" ${state.language === "en" ? "selected" : ""}>English</option>
          </select></label>
          <label>Тема<select data-app-setting="theme" aria-label="Тема приложения">
            <option value="light" ${state.theme === "light" ? "selected" : ""}>Светлая</option>
            <option value="dark" ${state.theme === "dark" ? "selected" : ""}>Тёмная</option>
          </select></label>
          <label>Внешний вид<select data-app-setting="appearance" aria-label="Стиль оформления">
            <option value="standard" ${state.appearance === "standard" ? "selected" : ""}>Стандартный</option>
            <option value="translucent" ${state.appearance === "translucent" ? "selected" : ""}>Полупрозрачный</option>
            <option value="liquid-glass" ${state.appearance === "liquid-glass" ? "selected" : ""}>Жидкое стекло</option>
          </select></label>
        </div>
      </section>
    </aside>
  </div>`;
}

function renderAccountControls() {
  const brand = root.querySelector(".topbar .brand");
  if (!brand) return;
  const trigger = document.createElement("button");
  trigger.className = "account-trigger";
  trigger.type = "button";
  trigger.dataset.accountOpen = "";
  trigger.setAttribute("aria-label", state.accountUser
    ? `Открыть аккаунт ${state.accountUser.name}`
    : "Открыть аккаунт или войти");
  trigger.setAttribute("aria-expanded", String(state.accountOpen));
  trigger.setAttribute("aria-controls", "account-drawer");
  trigger.title = "Аккаунт Limon";
  trigger.innerHTML = state.accountUser
    ? `<span class="account-trigger__initials">${escapeHtml(state.accountUser.initials)}</span>`
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20a6.5 6.5 0 0 1 13 0"></path></svg>';
  brand.prepend(trigger);
  root.insertAdjacentHTML("beforeend", renderAccountDrawer());
  if (state.accountOpen) {
    const overlay = root.querySelector("[data-account-overlay]");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (state.accountOpen && overlay?.isConnected) overlay.classList.add("is-open");
    }));
  }
}

function accountErrorMessage(error) {
  const message = error?.message || "";
  if (/invalid login credentials/i.test(message)) return "Неверный email или пароль.";
  if (/email not confirmed/i.test(message)) return "Подтвердите email по ссылке из письма, затем войдите.";
  if (/user already registered/i.test(message)) return "Аккаунт с таким email уже существует. Попробуйте войти.";
  if (/password should be at least/i.test(message)) return "Пароль должен содержать не менее 6 символов.";
  if (/invalid email/i.test(message)) return "Проверьте правильность email.";
  if (/failed to fetch|networkerror|network request failed/i.test(message)) {
    return "Не удалось связаться с аккаунтом Limon. Проверьте подключение к интернету.";
  }
  return message || "Не удалось выполнить запрос. Попробуйте ещё раз.";
}

function updateAccountAuthNotice() {
  const form = root.querySelector("#account-auth-form");
  if (!form) return;
  let notice = root.querySelector(".account-auth-notice");
  if (!state.accountAuthMessage) {
    notice?.remove();
    return;
  }
  if (!notice) {
    notice = document.createElement("div");
    form.before(notice);
  }
  const type = state.accountAuthMessage.type === "error" ? "error" : "success";
  notice.className = `account-auth-notice account-auth-notice--${type}`;
  notice.setAttribute("role", type === "error" ? "alert" : "status");
  notice.textContent = state.accountAuthMessage.text;
}

function openAccountDrawer() {
  state.accountOpen = true;
  const overlay = root.querySelector("[data-account-overlay]");
  overlay?.classList.add("is-open");
  overlay?.setAttribute("aria-hidden", "false");
  const drawer = root.querySelector(".account-drawer");
  drawer?.setAttribute("aria-modal", "true");
  root.querySelector("[data-account-open]")?.setAttribute("aria-expanded", "true");
  root.querySelector(".account-drawer")?.focus();
}

function closeAccountDrawer() {
  state.accountOpen = false;
  const overlay = root.querySelector("[data-account-overlay]");
  overlay?.classList.remove("is-open");
  overlay?.setAttribute("aria-hidden", "true");
  root.querySelector(".account-drawer")?.setAttribute("aria-modal", "false");
  root.querySelector("[data-account-open]")?.setAttribute("aria-expanded", "false");
  requestAnimationFrame(() => root.querySelector("[data-account-open]")?.focus());
}

async function submitAccountAuthForm(form) {
  if (state.accountAuthBusy) return;
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();
  state.accountAuthDraft.email = email;
  state.accountAuthDraft.name = name;
  if (state.accountAuthMode === "sign-up" && !name) {
    state.accountAuthMessage = { type: "error", text: "Укажите имя, которое будет отображаться в профиле." };
    updateAccountAuthNotice();
    return;
  }

  state.accountAuthBusy = true;
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Подождите…";
  let redrawDrawer = false;
  try {
    const result = state.accountAuthMode === "sign-up"
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      state.accountAuthMessage = { type: "error", text: accountErrorMessage(result.error) };
      updateAccountAuthNotice();
    } else if (state.accountAuthMode === "sign-up" && !result.data.session) {
      state.accountAuthMode = "sign-in";
      state.accountAuthMessage = {
        type: "success",
        text: "Аккаунт создан. Проверьте почту и подтвердите email, затем войдите.",
      };
      redrawDrawer = true;
    } else if (result.data.user) {
      state.accountUser = accountProfile(result.data.user);
      state.accountAuthMessage = null;
      redrawDrawer = true;
    }
  } catch (error) {
    state.accountAuthMessage = { type: "error", text: accountErrorMessage(error) };
    updateAccountAuthNotice();
  } finally {
    state.accountAuthBusy = false;
    if (redrawDrawer) render();
    else {
      const currentButton = root.querySelector(".account-auth-submit");
      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = state.accountAuthMode === "sign-up" ? "Создать аккаунт" : "Войти";
      }
    }
  }
}

function displayExpression(expression) {
  let formatted = "";
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (["+", "-", "−", "*", "/", "×", "÷"].includes(character)) {
      const prefix = expression.slice(0, index).trimEnd();
      const previous = prefix.slice(-1);
      const exponentSign = (character === "+" || character === "-")
        && /\d(?:\.\d*)?[eE]$/.test(prefix);
      const unary = !previous || /[([,+\-−*/×÷^]/.test(previous) || exponentSign;
      const symbol = { "-": "−", "*": "×", "/": "÷" }[character] || character;
      formatted = unary ? `${formatted}${symbol}` : `${formatted.trimEnd()} ${symbol} `;
    } else if (character === "." && /\d/.test(expression[index - 1] || "") && /\d/.test(expression[index + 1] || "")) {
      formatted += decimalSeparator();
    } else if (character === ",") {
      formatted += ", ";
    } else {
      formatted += escapeHtml(character);
    }
  }
  return formatted
    .replace(/\bsqrt\(/gi, "√(")
    .replace(/\bcbrt\(/gi, "∛(")
    .replace(/\blog10\(/gi, "log₁₀(")
    .replace(/\blog2\(/gi, "log₂(")
    .replace(/\blog\(/gi, "ln(")
    .replace(/\basin\(/gi, "sin⁻¹(")
    .replace(/\bacos\(/gi, "cos⁻¹(")
    .replace(/\batan\(/gi, "tan⁻¹(")
    .replace(/\bnthRoot\(/gi, "ʸ√(")
    .replace(/\bdegree\(([^()]*)\)/gi, "$1°")
    .replace(/\bexp\(/gi, "e^(")
    .replace(/\bpi\b/gi, "π")
    .replace(/\btau\b/gi, "τ")
    .replace(/\^(-?\d+)/g, (_match, exponent) => [...exponent]
      .map((digit) => digit === "-" ? "⁻" : "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)])
      .join(""));
}

function localizeDecimal(value) {
  if (decimalSeparator() !== ",") return String(value);
  return String(value).replace(/(\d)\.(?=\d)/g, "$1,");
}

function decimalSeparator() {
  return state.language === "ru" ? "," : ".";
}

function button(key, label, style = "") {
  return `<button class="key ${style}" data-key="${escapeHtml(key)}">${label}</button>`;
}

function renderKeys() {
  const common = [
    button("clear", "AC", "key--utility"),
    button("backspace", "⌫", "key--utility"),
    button("percent", "%", "key--utility"),
    button("/", "÷", "key--operator"),
    button("7", "7"),
    button("8", "8"),
    button("9", "9"),
    button("*", "×", "key--operator"),
    button("4", "4"),
    button("5", "5"),
    button("6", "6"),
    button("-", "−", "key--operator"),
    button("1", "1"),
    button("2", "2"),
    button("3", "3"),
    button("+", "+", "key--operator"),
    button("sign", "±", "key--utility"),
    button("0", "0"),
    button(".", decimalSeparator()),
    button("equals", "=", "key--equals"),
  ];
  return common.join("");
}

function renderFunctionPanel() {
  if (state.mode !== "advanced") return "";
  return `<section class="function-panel"><span class="function-panel__label">НАУЧНЫЕ ФУНКЦИИ</span><div class="function-grid">${[
    button("second", "2nd", `key--function key--toggle ${state.secondFunction ? "is-active" : ""}`),
    button("pi", "π", "key--function"),
    button("e", "e", "key--function"),
    button("mod", "mod", "key--function"),
    button("^2", "x²", "key--function"),
    button("^", "xʸ", "key--function"),
    button(state.secondFunction ? "root" : "sqrt(", state.secondFunction ? "ʸ√" : "√", "key--function"),
    button("1/(", "1/x", "key--function"),
    button(state.secondFunction ? "asin(" : "sin(", state.secondFunction ? "sin⁻¹" : "sin", "key--function"),
    button(state.secondFunction ? "acos(" : "cos(", state.secondFunction ? "cos⁻¹" : "cos", "key--function"),
    button(state.secondFunction ? "atan(" : "tan(", state.secondFunction ? "tan⁻¹" : "tan", "key--function"),
    button("!", "n!", "key--function"),
    button(state.secondFunction ? "exp(" : "log(", state.secondFunction ? "eˣ" : "ln", "key--function"),
    button(state.secondFunction ? "10^(" : "log10(", state.secondFunction ? "10ˣ" : "log", "key--function"),
    button("(", "(", "key--function"),
    button(")", ")", "key--function"),
  ].join("")}</div></section>`;
}

const professionalTabs = [
  { id: "function", label: "График функции", icon: "ƒx" },
  { id: "data", label: "Диаграмма по данным", icon: "▥" },
  { id: "calculate", label: "Расчёты", icon: "∑" },
];
const chartColors = ["#5d72eb", "#43b48a", "#f2aa57", "#9a72df", "#e36c7a", "#47a9bb", "#a3b656"];
function formatPlotNumber(value) {
  return new Intl.NumberFormat(uiLocale(), { maximumSignificantDigits: 4 }).format(value);
}

function renderFunctionPlot() {
  const graph = state.functionGraph;
  if (!graph) {
    return `<div class="visual-empty"><span>ƒ(x)</span><strong>Здесь появится график</strong><p>Введите функцию и диапазон значений x.</p></div>`;
  }

  const width = 760;
  const height = 430;
  const left = 64;
  const right = 18;
  const top = 20;
  const bottom = 45;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const yRange = graph.maxY - graph.minY || Math.max(1, Math.abs(graph.minY) * 0.2);
  const minY = graph.minY - yRange * 0.08;
  const maxY = graph.maxY + yRange * 0.08;
  const x = (value) => left + ((value - graph.min) / (graph.max - graph.min)) * plotWidth;
  const y = (value) => top + ((maxY - value) / (maxY - minY)) * plotHeight;
  const grid = Array.from({ length: 6 }, (_, index) => {
    const value = minY + ((maxY - minY) * index) / 5;
    const yPosition = y(value);
    return `<line class="visual-grid" x1="${left}" y1="${yPosition}" x2="${width - right}" y2="${yPosition}" />
      <text class="visual-axis-label" x="${left - 9}" y="${yPosition + 4}" text-anchor="end">${escapeHtml(formatPlotNumber(value))}</text>`;
  }).join("");
  const xLabels = Array.from({ length: 7 }, (_, index) => {
    const value = graph.min + ((graph.max - graph.min) * index) / 6;
    const xPosition = x(value);
    return `<line class="visual-grid visual-grid--vertical" x1="${xPosition}" y1="${top}" x2="${xPosition}" y2="${top + plotHeight}" />
      <text class="visual-axis-label" x="${xPosition}" y="${height - 15}" text-anchor="middle">${escapeHtml(formatPlotNumber(value))}</text>`;
  }).join("");
  const segments = [];
  let segment = [];
  for (const point of graph.points) {
    if (point.y === null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else {
      segment.push(point);
    }
  }
  if (segment.length) segments.push(segment);
  const path = segments.map((points) => points.map((point, index) => `${index ? "L" : "M"}${x(point.x).toFixed(2)},${y(point.y).toFixed(2)}`).join(" ")).join(" ");
  const xAxis = graph.min <= 0 && graph.max >= 0 ? x(0) : left;
  const yAxis = minY <= 0 && maxY >= 0 ? y(0) : top + plotHeight;

  return `<svg class="function-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="График функции ${escapeHtml(graph.expression)}">
    ${grid}${xLabels}
    <line class="visual-axis" x1="${left}" y1="${yAxis}" x2="${width - right}" y2="${yAxis}" />
    <line class="visual-axis" x1="${xAxis}" y1="${top}" x2="${xAxis}" y2="${top + plotHeight}" />
    <path class="function-plot__curve" d="${path}" />
    <text class="visual-axis-title" x="${width - right}" y="${height - 2}" text-anchor="end">x</text>
    <text class="visual-axis-title" x="14" y="${top + 2}">y</text>
  </svg>`;
}

function renderFunctionTab() {
  return `<div class="professional-layout">
    <section class="visual-card visual-card--plot">
      <div class="visual-card__heading"><div><span class="professional-eyebrow">ФУНКЦИОНАЛЬНЫЙ ГРАФИК</span><h2>${state.functionGraph ? `y = ${escapeHtml(state.functionGraph.expression)}` : "Исследуйте любую функцию"}</h2></div>
        ${state.functionGraph ? `<span class="visual-meta">x: ${escapeHtml(formatPlotNumber(state.functionGraph.min))} … ${escapeHtml(formatPlotNumber(state.functionGraph.max))}</span>` : ""}
      </div>
      <div class="plot-canvas">${renderFunctionPlot()}</div>
      <p class="visual-footnote">Используйте x, скобки и функции: sin, cos, log, sqrt.</p>
    </section>
    <aside class="visual-card visual-controls">
      <span class="professional-eyebrow">ПАРАМЕТРЫ</span><h2>Построить график</h2>
      <form class="visual-form" data-professional-form="function">
        <label>Функция f(x)<input name="expression" value="${escapeHtml(state.functionDraft.expression)}" required placeholder="Например: sin(x) * x" /></label>
        <div class="visual-form__row">
          <label>От x<input name="min" type="number" step="any" value="${escapeHtml(state.functionDraft.min)}" required /></label>
          <label>До x<input name="max" type="number" step="any" value="${escapeHtml(state.functionDraft.max)}" required /></label>
        </div>
        <label>Углы в тригонометрии
          <select name="angleUnit">
            <option value="RAD" ${state.functionDraft.angleUnit === "RAD" ? "selected" : ""}>Радианы</option>
            <option value="DEG" ${state.functionDraft.angleUnit === "DEG" ? "selected" : ""}>Градусы</option>
          </select>
        </label>
        <button class="button button--primary" type="submit">Построить график</button>
      </form>
      <div class="visual-examples"><span>Примеры</span>${["x^2", "sin(x)", "sqrt(x)"].map((expression) => `<button type="button" data-function-template="${expression}">${expression}</button>`).join("")}</div>
      ${state.functionError ? `<p class="visual-error">${escapeHtml(state.functionError)}</p>` : ""}
    </aside>
  </div>`;
}

function pieSlicePath(cx, cy, radius, startAngle, endAngle) {
  const startX = cx + radius * Math.cos(startAngle);
  const startY = cy + radius * Math.sin(startAngle);
  const endX = cx + radius * Math.cos(endAngle);
  const endY = cy + radius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

function renderDataChart() {
  if (!state.chartData) {
    return `<div class="visual-empty"><span>▥</span><strong>Визуализируйте свои данные</strong><p>Добавьте подписи и значения — выберите столбчатую, линейную или круговую диаграмму.</p></div>`;
  }

  const { type, data } = state.chartData;
  if (type === "pie") {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let angle = -Math.PI / 2;
    const slices = data.map((item, index) => {
      const nextAngle = angle + (item.value / total) * Math.PI * 2;
      const slice = item.value === total
        ? `<circle cx="380" cy="210" r="155" fill="${chartColors[index % chartColors.length]}" />`
        : item.value > 0
          ? `<path d="${pieSlicePath(380, 210, 155, angle, nextAngle)}" fill="${chartColors[index % chartColors.length]}"><title>${escapeHtml(`${item.label}: ${formatPlotNumber(item.value)}`)}</title></path>`
          : "";
      angle = nextAngle;
      return slice;
    }).join("");
    return `<svg class="data-chart data-chart--pie" viewBox="0 0 760 420" role="img" aria-label="Круговая диаграмма">${slices}</svg>`;
  }

  const width = 760;
  const height = 420;
  const left = 68;
  const right = 20;
  const top = 24;
  const bottom = 62;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  let minValue = Math.min(0, ...data.map(({ value }) => value));
  let maxValue = Math.max(0, ...data.map(({ value }) => value));
  if (minValue === maxValue) maxValue = minValue + 1;
  const padding = (maxValue - minValue) * 0.08;
  minValue -= padding;
  maxValue += padding;
  const y = (value) => top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
  const zeroY = y(0);
  const groupWidth = plotWidth / data.length;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = minValue + ((maxValue - minValue) * index) / 4;
    const yPosition = y(value);
    return `<line class="visual-grid" x1="${left}" y1="${yPosition}" x2="${width - right}" y2="${yPosition}" />
      <text class="visual-axis-label" x="${left - 9}" y="${yPosition + 4}" text-anchor="end">${escapeHtml(formatPlotNumber(value))}</text>`;
  }).join("");
  const points = data.map((item, index) => ({
    ...item,
    x: left + groupWidth * (index + 0.5),
    y: y(item.value),
    color: chartColors[index % chartColors.length],
  }));
  const marks = type === "bar"
    ? points.map((point) => `<rect class="data-chart__bar" x="${point.x - Math.min(32, groupWidth * 0.28)}" y="${Math.min(point.y, zeroY)}" width="${Math.min(64, groupWidth * 0.56)}" height="${Math.max(1, Math.abs(zeroY - point.y))}" rx="6" fill="${point.color}"><title>${escapeHtml(`${point.label}: ${formatPlotNumber(point.value)}`)}</title></rect>`).join("")
    : `<path class="data-chart__line" d="${points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ")}" />${points.map((point) => `<circle class="data-chart__point" cx="${point.x}" cy="${point.y}" r="5" fill="${point.color}"><title>${escapeHtml(`${point.label}: ${formatPlotNumber(point.value)}`)}</title></circle>`).join("")}`;
  const labels = points.map((point) => `<text class="visual-axis-label" x="${point.x}" y="${height - 24}" text-anchor="middle">${escapeHtml(point.label)}</text>`).join("");
  return `<svg class="data-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${type === "bar" ? "Столбчатая" : "Линейная"} диаграмма">
    ${grid}<line class="visual-axis" x1="${left}" y1="${zeroY}" x2="${width - right}" y2="${zeroY}" />${marks}${labels}
  </svg>`;
}

function renderChartLegend() {
  if (!state.chartData) return "";
  return `<div class="chart-legend">${state.chartData.data.map((item, index) => `
    <span><i style="--series-color:${chartColors[index % chartColors.length]}"></i>${escapeHtml(item.label)} <strong>${escapeHtml(formatPlotNumber(item.value))}</strong></span>`).join("")}</div>`;
}

function renderDataTab() {
  return `<div class="professional-layout">
    <section class="visual-card visual-card--plot">
      <div class="visual-card__heading"><div><span class="professional-eyebrow">ВАША ДИАГРАММА</span><h2>${state.chartData ? (state.chartData.type === "pie" ? "Круговая диаграмма" : state.chartData.type === "line" ? "Линейный график" : "Столбчатая диаграмма") : "Постройте диаграмму по своим данным"}</h2></div>
        ${state.chartData ? `<span class="visual-meta">${state.chartData.data.length} значений</span>` : ""}
      </div>
      <div class="plot-canvas">${renderDataChart()}</div>
      ${renderChartLegend()}
    </section>
    <aside class="visual-card visual-controls">
      <span class="professional-eyebrow">ИСТОЧНИК ДАННЫХ</span><h2>Настройка диаграммы</h2>
      <form class="visual-form" data-professional-form="data">
        <label>Тип
          <select name="type">
            <option value="bar" ${state.chartDraft.type === "bar" ? "selected" : ""}>Столбчатая</option>
            <option value="line" ${state.chartDraft.type === "line" ? "selected" : ""}>Линейная</option>
            <option value="pie" ${state.chartDraft.type === "pie" ? "selected" : ""}>Круговая</option>
          </select>
        </label>
        <label>Подписи — по одной в строке<textarea name="labels" rows="5" placeholder="Например:&#10;Январь&#10;Февраль&#10;Март">${escapeHtml(state.chartDraft.labels)}</textarea></label>
        <label>Значения — в том же порядке<textarea name="values" rows="5" placeholder="Например:&#10;12&#10;18&#10;14">${escapeHtml(state.chartDraft.values)}</textarea></label>
        <button class="button button--primary" type="submit">Построить диаграмму</button>
      </form>
      ${state.chartError ? `<p class="visual-error">${escapeHtml(state.chartError)}</p>` : ""}
    </aside>
  </div>`;
}

function renderProfessionalHistory() {
  return state.history.length
    ? state.history.slice(0, 8).map((item, index) => `<button class="professional-history-item" data-professional-history-index="${index}">
        <span>${displayExpression(item.expression)}</span><strong>${escapeHtml(localizeDecimal(item.result))}</strong>
      </button>`).join("")
    : `<p class="professional-history-empty">Вычисления появятся здесь.</p>`;
}

function renderCalculationTab() {
  return `<div class="professional-calculation-layout">
    <section class="visual-card calculation-card">
      <span class="professional-eyebrow">СВОБОДНОЕ ВЫРАЖЕНИЕ</span><h2>Математический расчёт</h2>
      <form class="visual-form calculation-form" data-professional-form="calculate">
        <label>Выражение<input name="expression" value="${escapeHtml(state.professionalExpression)}" placeholder="Например: 2^8 + sqrt(81)" required /></label>
        <label>Единицы углов
          <select name="angleUnit">
            <option value="RAD" ${state.professionalAngle === "RAD" ? "selected" : ""}>Радианы</option>
            <option value="DEG" ${state.professionalAngle === "DEG" ? "selected" : ""}>Градусы</option>
          </select>
        </label>
        <button class="button button--primary" type="submit">Вычислить</button>
      </form>
      ${state.professionalError ? `<p class="visual-error">${escapeHtml(state.professionalError)}</p>` : ""}
      ${state.professionalResult ? `<div class="calculation-result"><span>РЕЗУЛЬТАТ</span><strong>${escapeHtml(state.professionalResult)}</strong><button type="button" data-copy-professional-result>Копировать</button></div>` : ""}
      <p class="visual-footnote">Можно использовать арифметику, степени, скобки, проценты и функции sqrt, sin, cos, log.</p>
    </section>
    <aside class="visual-card professional-history">
      <span class="professional-eyebrow">НА ЭТОМ УСТРОЙСТВЕ</span><h2>История расчётов</h2>
      <div class="professional-history-list">${renderProfessionalHistory()}</div>
    </aside>
  </div>`;
}

function workspaceValue(value) {
  return new Intl.NumberFormat(uiLocale(), { maximumSignificantDigits: 10 })
    .format(value)
    .replace(/[\u00a0\u202f]/g, " ");
}

function localizeWorkspaceOutput(value) {
  const text = String(value);
  return state.language === "en" ? text.replace(/(\d),(\d)/g, "$1.$2") : text;
}

function renderProgrammerBaseCard(label, value, base) {
  return `<article class="programmer-base-card">
    <div><span>${label}</span><strong>${escapeHtml(formatProgrammerInteger(value, base, state.programmerBits, state.programmerSigned))}</strong></div>
    <button type="button" data-copy-programmer="${base}" aria-label="Скопировать ${label}" title="Скопировать ${label}">⧉</button>
  </article>`;
}

function renderProgrammerPage() {
  let a = 0n;
  let b = 0n;
  let error = state.programmerError;
  try {
    a = parseProgrammerInteger(state.programmerA, state.programmerBits, state.programmerSigned);
    b = parseProgrammerInteger(state.programmerB, state.programmerBits, state.programmerSigned);
  } catch (caught) {
    error = caught.message || "Некорректное целое число.";
  }
  const range = getProgrammerRange(state.programmerBits, state.programmerSigned);
  const operations = [
    ["and", "AND"],
    ["or", "OR"],
    ["xor", "XOR"],
    ["not", "NOT A"],
    ["shl", "A << n"],
    ["shr", "A >> n"],
  ];
  const operationRows = operations.map(([operation, label]) => {
    let hexResult = "—";
    let decResult = "";
    try {
      const operationB = operation === "shl" || operation === "shr"
        ? "4"
        : state.programmerB;
      const result = calculateProgrammerOperation(
        state.programmerA,
        operationB,
        operation,
        state.programmerBits,
        state.programmerSigned,
      );
      hexResult = formatProgrammerInteger(result, "hex", state.programmerBits, state.programmerSigned);
      decResult = formatProgrammerInteger(result, "dec", state.programmerBits, state.programmerSigned);
    } catch (caught) {
      hexResult = caught.message || "Ошибка";
    }
    return `<div class="programmer-operation-row">
      <span>${label}</span>
      <strong>${escapeHtml(hexResult)}${decResult ? `<small>${escapeHtml(decResult)}</small>` : ""}</strong>
    </div>`;
  }).join("");
  const bits = Array.from({ length: state.programmerBits }, (_, index) => {
    const position = state.programmerBits - 1 - index;
    const active = !error && ((a >> BigInt(position)) & 1n) === 1n;
    return `<button type="button" class="programmer-bit ${active ? "is-active" : ""}" data-programmer-bit="${position}" aria-label="Бит ${position}: ${active ? "включён" : "выключен"}" title="Бит ${position}">
      <span>${position}</span><strong>${active ? "1" : "0"}</strong>
    </button>`;
  }).join("");
  const baseCards = error
    ? ""
    : [
      renderProgrammerBaseCard("HEX", a, "hex"),
      renderProgrammerBaseCard("DEC", a, "dec"),
      renderProgrammerBaseCard("OCT", a, "oct"),
      renderProgrammerBaseCard("BIN", a, "bin"),
    ].join("");

  return `<main class="app-shell app-shell--professional">
    <header class="topbar">
      <div class="brand">
        <img class="brand__logo" src="${logoUrl}" alt="Limon Calculator" />
        <div class="brand__copy"><strong>Limon <span>Calculator</span></strong><small>Профессиональные вычисления</small></div>
      </div>
      <nav class="mode-tabs" aria-label="Режим калькулятора">
        ${modes.map((mode) => `<button class="mode-tab ${state.mode === mode ? "is-active" : ""}" data-mode="${mode}" aria-pressed="${state.mode === mode}">${modeLabels[mode]}</button>`).join("")}
      </nav>
    </header>
    <section class="professional-page programmer-page">
      <div class="workspace-card__heading programmer-heading">
        <div><span class="professional-eyebrow">LIMON · PROGRAMMER</span><h1>Программист</h1><p>Битовые операции, разрядность и точные границы значений.</p></div>
        <button type="button" class="workspace-tool-back" data-professional-tool="workspace">← Рабочая область</button>
      </div>
      <div class="programmer-layout">
        <article class="workspace-card programmer-main">
          <div class="programmer-toolbar">
            <div class="programmer-bits" aria-label="Разрядность">
              ${[8,16,32,64].map((bits) => `<button type="button" class="${state.programmerBits === bits ? "is-active" : ""}" data-programmer-bits="${bits}">${bits} бит</button>`).join("")}
            </div>
            <div class="programmer-sign" aria-label="Подпись числа">
              <button type="button" class="${!state.programmerSigned ? "is-active" : ""}" data-programmer-sign="unsigned">Без знака</button>
              <button type="button" class="${state.programmerSigned ? "is-active" : ""}" data-programmer-sign="signed">Со знаком</button>
            </div>
          </div>
          <div class="programmer-inputs">
            <label>A<input class="programmer-input" data-programmer-input="a" value="${escapeHtml(state.programmerA)}" autocomplete="off" spellcheck="false" aria-label="Значение A" /></label>
            <label>B<input class="programmer-input" data-programmer-input="b" value="${escapeHtml(state.programmerB)}" autocomplete="off" spellcheck="false" aria-label="Значение B" /></label>
          </div>
          ${error ? `<p class="workspace-error">${escapeHtml(error)}</p>` : ""}
          ${baseCards}
          <div class="programmer-bits-section">
            <div class="programmer-section-heading"><h2>Сетка битов A</h2><span>Клик переключает бит</span></div>
            <div class="programmer-bit-grid">${bits}</div>
          </div>
          <button type="button" class="button button--primary programmer-insert" data-workspace-action="insert-programmer">Вставить в рабочую область</button>
        </article>
        <aside class="workspace-sidebar programmer-sidebar">
          <section class="workspace-side-card programmer-range">
            <span class="professional-eyebrow">ДИАПАЗОН</span>
            <h2>${state.programmerBits} бит · ${state.programmerSigned ? "со знаком" : "без знака"}</h2>
            <div><span>Минимум</span><strong>${range.min.toString()}</strong></div>
            <div><span>Максимум</span><strong>${range.max.toString()}</strong></div>
          </section>
          <section class="workspace-side-card programmer-table">
            <span class="professional-eyebrow">A И B</span>
            <h2>Операции</h2>
            ${operationRows}
          </section>
        </aside>
      </div>
    </section>
    <div class="toast-region" aria-live="polite"></div>
  </main>`;
}

function formatFinanceMoney(value) {
  return new Intl.NumberFormat(uiLocale(), {
    style: "currency",
    currency: state.financeCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value).replace(/[\u00a0\u202f]/g, " ");
}

function renderLoanPage() {
  const principal = Number(state.financeDraft.principal.replace(",", "."));
  const annualRate = Number(state.financeDraft.annualRate.replace(",", "."));
  const months = Number(state.financeDraft.months);
  let loan = null;
  let error = "";
  try {
    loan = calculateLoan({
      principal,
      annualRate,
      months,
      type: state.financeDraft.loanType,
    });
  } catch (caught) {
    error = caught.message || "Не удалось рассчитать кредит.";
  }
  const schedule = loan?.schedule.slice(0, 12).map((row) => `<tr>
    <td>${row.month}</td>
    <td>${formatFinanceMoney(row.payment)}</td>
    <td>${formatFinanceMoney(row.interest)}</td>
    <td>${formatFinanceMoney(row.principal)}</td>
    <td>${formatFinanceMoney(row.balance)}</td>
  </tr>`).join("") || "";

  return `<main class="app-shell app-shell--professional">
    <header class="topbar">
      <div class="brand">
        <img class="brand__logo" src="${logoUrl}" alt="Limon Calculator" />
        <div class="brand__copy"><strong>Limon <span>Calculator</span></strong><small>Профессиональные вычисления</small></div>
      </div>
      <nav class="mode-tabs" aria-label="Режим калькулятора">
        ${modes.map((mode) => `<button class="mode-tab ${state.mode === mode ? "is-active" : ""}" data-mode="${mode}" aria-pressed="${state.mode === mode}">${modeLabels[mode]}</button>`).join("")}
      </nav>
    </header>
    <section class="professional-page finance-page">
      <div class="workspace-card__heading programmer-heading">
        <div><span class="professional-eyebrow">LIMON · FINANCE</span><h1>Финансы</h1><p>Кредиты, проценты, НДС, наценка и маржа.</p></div>
        <div class="finance-heading-actions">
          <label class="finance-currency-picker">Валюта расчётов
            <select data-finance-currency aria-label="Валюта финансовых расчётов">
              ${financeCurrencies.map(([code, name]) => `<option value="${code}" ${state.financeCurrency === code ? "selected" : ""}>${code} — ${name}</option>`).join("")}
            </select>
            <small>Суммы в выбранной валюте; обмена нет</small>
          </label>
          <button type="button" class="workspace-tool-back" data-professional-tool="workspace">← Рабочая область</button>
        </div>
      </div>
      <nav class="finance-tabs" aria-label="Инструменты финансового режима">
        <button type="button" class="${state.professionalFinanceTab === "loan" ? "is-active" : ""}" data-finance-tab="loan">Кредит</button>
        <button type="button" class="${state.professionalFinanceTab === "percent" ? "is-active" : ""}" data-finance-tab="percent">Проценты и НДС</button>
      </nav>
      <div class="finance-layout">${state.professionalFinanceTab === "loan"
        ? renderLoanTab(loan, error, schedule)
        : renderFinancePercentTab()}</div>
    </section>
    <div class="toast-region" aria-live="polite"></div>
  </main>`;
}

function renderLoanTab(loan, error, schedule) {
  return `<article class="workspace-card finance-main">
    <div class="finance-form-grid">
      <label>Сумма кредита<input type="text" data-finance-field="principal" value="${escapeHtml(state.financeDraft.principal)}" inputmode="decimal" /></label>
      <label>Годовая ставка, %<input type="text" data-finance-field="annualRate" value="${escapeHtml(state.financeDraft.annualRate)}" inputmode="decimal" /></label>
      <label>Срок, месяцев<input type="text" data-finance-field="months" value="${escapeHtml(state.financeDraft.months)}" inputmode="numeric" /></label>
      <label>Тип платежа<select data-finance-field="loanType">
        <option value="annuity" ${state.financeDraft.loanType === "annuity" ? "selected" : ""}>Аннуитетный</option>
        <option value="differential" ${state.financeDraft.loanType === "differential" ? "selected" : ""}>Дифференцированный</option>
      </select></label>
    </div>
    ${error ? `<p class="workspace-error">${escapeHtml(error)}</p>` : ""}
    ${loan ? `<div class="finance-result-grid">
      <article><span>Платёж</span><strong>${formatFinanceMoney(loan.payment)}</strong></article>
      <article><span>Общая выплата</span><strong>${formatFinanceMoney(loan.totalPayment)}</strong></article>
      <article><span>Переплата</span><strong>${formatFinanceMoney(loan.overpayment)}</strong><small>${loan.overpaymentPercent.toLocaleString(uiLocale())} %</small></article>
    </div>
    <div class="finance-pmt"><span>Формула для рабочей области</span><code>pmt(${state.financeDraft.principal}; ${state.financeDraft.annualRate}%; ${state.financeDraft.months})</code><button type="button" data-finance-action="insert-pmt" aria-label="Вставить формулу платежа">Вставить строку</button></div>
    <div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Месяц</th><th>Платёж</th><th>Проценты</th><th>Основной долг</th><th>Остаток</th></tr></thead><tbody>${schedule}</tbody></table></div>
    <button type="button" class="button button--secondary finance-export" data-finance-action="export-csv">Экспорт графика в CSV</button>` : ""}
  </article>`;
}

function renderFinancePercentTab() {
  let compound = null;
  let vatAdd = null;
  let vatExtract = null;
  let margin = null;
  try {
    compound = calculateCompoundInterest(100000, 8, 5);
    vatAdd = calculateVat(1200, Number(state.financeVatRate.replace(",", ".")), "add");
    vatExtract = calculateVat(1440, Number(state.financeVatRate.replace(",", ".")), "extract");
    margin = calculateMarkupMargin(800, 25);
  } catch {
    compound = null;
  }
  return `<div class="finance-tools-grid">
    <article class="workspace-card finance-tool-card">
      <span class="professional-eyebrow">СЛОЖНЫЙ ПРОЦЕНТ</span><h2>Рост вложений</h2>
      <p class="finance-fixed-example">${formatFinanceMoney(100000)} · 8 % годовых · 5 лет</p>
      <strong class="finance-big-result">${compound ? formatFinanceMoney(compound) : "—"}</strong>
      <button type="button" class="button button--secondary" data-finance-action="insert-compound">Вставить в рабочую область</button>
    </article>
    <article class="workspace-card finance-tool-card">
      <span class="professional-eyebrow">НДС</span><h2>Начислить или выделить</h2>
      <label>Ставка НДС, %<input type="text" data-finance-vat-rate value="${escapeHtml(state.financeVatRate)}" inputmode="decimal" /></label>
      <div class="finance-vat-results">
        <div><span>Добавить к ${formatFinanceMoney(1200)}</span><strong>${vatAdd ? formatFinanceMoney(vatAdd.total) : "—"}</strong><small>НДС ${vatAdd ? formatFinanceMoney(vatAdd.vat) : "—"}</small></div>
        <div><span>Выделить из ${formatFinanceMoney(1440)}</span><strong>${vatExtract ? formatFinanceMoney(vatExtract.base) : "—"}</strong><small>НДС ${vatExtract ? formatFinanceMoney(vatExtract.vat) : "—"}</small></div>
      </div>
    </article>
    <article class="workspace-card finance-tool-card">
      <span class="professional-eyebrow">НАЦЕНКА И МАРЖА</span><h2>Пример расчёта</h2>
      <p class="finance-fixed-example">Себестоимость ${formatFinanceMoney(800)} · наценка 25 %</p>
      <strong class="finance-big-result">${margin ? formatFinanceMoney(margin.selling) : "—"}</strong>
      <p class="finance-margin">Маржа: ${margin ? margin.margin.toLocaleString(uiLocale()) : "—"} %</p>
    </article>
  </div>`;
}

const converterOptions = {
  length: [
    ["m", "Метр"], ["km", "Километр"], ["cm", "Сантиметр"], ["mm", "Миллиметр"],
    ["mi", "Миля"], ["ft", "Фут"], ["in", "Дюйм"],
  ],
  mass: [
    ["kg", "Килограмм"], ["g", "Грамм"], ["mg", "Миллиграмм"],
    ["t", "Тонна"], ["lb", "Фунт"], ["oz", "Унция"],
  ],
  temperature: [["c", "Цельсий"], ["f", "Фаренгейт"], ["k", "Кельвин"]],
};

function renderConverterTab() {
  const category = converterOptions[state.converterCategory] ? state.converterCategory : "length";
  if (!converterOptions[category].some(([id]) => id === state.converterFrom)) state.converterFrom = converterOptions[category][0][0];
  if (!converterOptions[category].some(([id]) => id === state.converterTo)) state.converterTo = converterOptions[category][1]?.[0] || converterOptions[category][0][0];
  let result = "—";
  let error = "";
  try {
    result = formatFinanceMoney(convertProfessionalUnit(
      Number(state.converterValue.replace(",", ".")),
      category,
      state.converterFrom,
      state.converterTo,
    ));
  } catch (caught) {
    error = caught.message || "Не удалось преобразовать единицы.";
  }
  const options = converterOptions[category].map(([id, label]) =>
    `<option value="${id}" ${id === state.converterFrom ? "selected" : ""}>${label}</option>`).join("");
  const targetOptions = converterOptions[category].map(([id, label]) =>
    `<option value="${id}" ${id === state.converterTo ? "selected" : ""}>${label}</option>`).join("");
  return `<article class="workspace-card converter-card">
    <div class="converter-category" aria-label="Категория конвертера">
      <button type="button" class="${category === "length" ? "is-active" : ""}" data-converter-category="length">Длина</button>
      <button type="button" class="${category === "mass" ? "is-active" : ""}" data-converter-category="mass">Масса</button>
      <button type="button" class="${category === "temperature" ? "is-active" : ""}" data-converter-category="temperature">Температура</button>
    </div>
    <div class="converter-grid">
      <label>Значение<input type="text" data-converter-value value="${escapeHtml(state.converterValue)}" inputmode="decimal" /></label>
      <label>Из<select data-converter-unit="from">${options}</select></label>
      <span class="converter-arrow">→</span>
      <label>В<select data-converter-unit="to">${targetOptions}</select></label>
    </div>
    ${error ? `<p class="workspace-error">${escapeHtml(error)}</p>` : `<div class="converter-result"><span>Результат</span><strong>${result}</strong></div>`}
  </article>`;
}

function renderConverterPage() {
  return `<main class="app-shell app-shell--professional">
    <header class="topbar">
      <div class="brand">
        <img class="brand__logo" src="${logoUrl}" alt="Limon Calculator" />
        <div class="brand__copy"><strong>Limon <span>Calculator</span></strong><small>Профессиональные вычисления</small></div>
      </div>
      <nav class="mode-tabs" aria-label="Режим калькулятора">
        ${modes.map((mode) => `<button class="mode-tab ${state.mode === mode ? "is-active" : ""}" data-mode="${mode}" aria-pressed="${state.mode === mode}">${modeLabels[mode]}</button>`).join("")}
      </nav>
    </header>
    <section class="professional-page converter-page">
      <div class="workspace-card__heading programmer-heading">
        <div><span class="professional-eyebrow">LIMON · CONVERTER</span><h1>Конвертер</h1><p>Длина, масса и температура.</p></div>
        <button type="button" class="workspace-tool-back" data-professional-tool="workspace">← Рабочая область</button>
      </div>
      ${renderConverterTab()}
    </section>
    <div class="toast-region" aria-live="polite"></div>
  </main>`;
}

function renderWorkspaceSuggestions() {
  const autocomplete = state.workspaceAutocomplete;
  if (!autocomplete?.items.length) return "";
  const top = 14 + autocomplete.lineIndex * 40;
  return `<div class="workspace-suggestions" role="listbox" aria-label="Функции" style="top:${top}px">
    ${autocomplete.items.map((item, index) => `<button type="button" role="option" aria-selected="${index === autocomplete.index}" class="workspace-suggestion ${index === autocomplete.index ? "is-active" : ""}" data-workspace-function="${item.name}">
      <strong>${item.name}</strong><span>${item.description}</span>
    </button>`).join("")}
  </div>`;
}

function renderWorkspacePage() {
  const evaluation = evaluateWorkspace(state.workspaceText, {
    ans: state.lastAnswer,
    angleUnit: state.workspaceAngle,
  });
  const lineCount = Math.max(10, evaluation.rows.length);
  const rows = Array.from({ length: lineCount }, (_, index) => evaluation.rows[index] || {
    source: "",
    result: "",
    error: "",
    kind: "empty",
  });
  const variables = evaluation.variables.map((variable) => `<button type="button" class="workspace-variable" data-workspace-variable="${escapeHtml(variable.name)}" title="Вставить ${escapeHtml(variable.name)} в редактор">
    <span>${escapeHtml(variable.name)}</span><strong>${escapeHtml(localizeWorkspaceOutput(variable.result))}</strong>
  </button>`).join("");
  return `<main class="app-shell app-shell--professional">
    <header class="topbar">
      <div class="brand">
        <img class="brand__logo" src="${logoUrl}" alt="Limon Calculator" />
        <div class="brand__copy"><strong>Limon <span>Calculator</span></strong><small>Профессиональные вычисления</small></div>
      </div>
      <nav class="mode-tabs" aria-label="Режим калькулятора">
        ${modes.map((mode) => `<button class="mode-tab ${state.mode === mode ? "is-active" : ""}" data-mode="${mode}" aria-pressed="${state.mode === mode}">${modeLabels[mode]}</button>`).join("")}
      </nav>
    </header>
    <section class="workspace-lab">
      <article class="workspace-card">
        <div class="workspace-card__heading">
          <div><span class="professional-eyebrow">LIMON · MATH WORKSPACE</span><h1>Рабочая область</h1><p>Вводите выражения и переменные построчно — результаты обновляются сразу.</p></div>
          <button type="button" class="workspace-angle" data-workspace-action="angle" aria-label="Переключить единицы углов" title="Единицы углов">${state.workspaceAngle}</button>
        </div>
        <div class="workspace-toolbar" aria-label="Действия с рабочей областью">
          <button type="button" data-workspace-action="copy-values" aria-label="Скопировать значения">Скопировать значения</button>
          <button type="button" data-workspace-action="copy-text" aria-label="Скопировать текст строк">Скопировать строки</button>
          <button type="button" data-workspace-action="export-csv" aria-label="Сохранить результаты в CSV">Экспорт CSV</button>
        </div>
        <div class="workspace-code" style="--workspace-lines:${lineCount}">
          <div class="workspace-line-numbers" aria-hidden="true">${rows.map((_, index) => `<span class="${index + 1 === state.workspaceCursor.line ? "is-active" : ""}">${index + 1}</span>`).join("")}</div>
          <textarea class="workspace-editor" aria-label="Редактор выражений" spellcheck="false" autocapitalize="off" autocomplete="off">${escapeHtml(state.workspaceText)}</textarea>
          <div class="workspace-results" aria-label="Результаты по строкам">${rows.map((row, index) => `<div class="workspace-result ${row.error ? "is-error" : ""} ${row.kind === "comment" ? "is-comment" : ""}" title="${escapeHtml(row.error || row.result)}" aria-label="${row.error ? `Ошибка: ${escapeHtml(row.error)}` : `Результат строки ${index + 1}: ${escapeHtml(row.result || "нет")}`}">${row.error ? `Ошибка: ${escapeHtml(row.error)}` : escapeHtml(localizeWorkspaceOutput(row.result))}</div>`).join("")}</div>
          ${renderWorkspaceSuggestions()}
        </div>
        <div class="workspace-card__footer"><span>Enter — новая строка</span><span># — комментарий</span><span>Точность: 10 значащих цифр</span></div>
      </article>
      <aside class="workspace-sidebar">
        <section class="workspace-side-card">
          <div class="workspace-side-heading"><div><span class="professional-eyebrow">ТЕКУЩАЯ СЕССИЯ</span><h2>Переменные</h2></div><span class="workspace-variable-count">${evaluation.variables.length}</span></div>
          <button type="button" class="workspace-variable workspace-variable--ans" data-workspace-variable="Ans" title="Вставить последний результат">
            <span>Ans</span><strong>${workspaceValue(evaluation.ans)}</strong>
          </button>
          ${variables || '<p class="workspace-empty">Присваивайте значения, например цена = 1200</p>'}
          <p class="workspace-storage">${state.workspaceStorageError || "Текст сохраняется на этом устройстве."}</p>
        </section>
        <section class="workspace-side-card workspace-tools">
          <div><span class="professional-eyebrow">ИНСТРУМЕНТЫ</span><h2>Профессиональные</h2></div>
          <button type="button" data-professional-tool="programmer"><span class="workspace-tool-icon">01</span><span><strong>Программист</strong><small>Системы счисления и биты</small></span><span class="workspace-tool-soon">Открыть</span></button>
          <button type="button" data-professional-tool="finance"><span class="workspace-tool-icon">02</span><span><strong>Финансы</strong><small>Кредит, проценты, НДС</small></span><span class="workspace-tool-soon">Открыть</span></button>
          <button type="button" data-professional-tool="converter"><span class="workspace-tool-icon">03</span><span><strong>Конвертер</strong><small>Длина, масса, температура</small></span><span class="workspace-tool-soon">Открыть</span></button>
        </section>
        <section class="workspace-side-card workspace-function-list">
          <div><span class="professional-eyebrow">БЫСТРАЯ СПРАВКА</span><h2>Функции</h2></div>
          <p>sin · cos · tan · asin · acos · atan · ln · log · sqrt · abs · round · floor · ceil · min · max · sum · avg · median · stdev · nCr · nPr · pmt</p>
        </section>
      </aside>
    </section>
    <div class="toast-region" aria-live="polite"></div>
  </main>`;
}

function renderProfessionalWorkspace() {
  if (state.professionalTool === "programmer") return renderProgrammerPage();
  if (state.professionalTool === "finance") return renderLoanPage();
  if (state.professionalTool === "converter") return renderConverterPage();
  return renderWorkspacePage();
}

function renderHistory() {
  return state.history.length
    ? state.history.map((item, index) => `
      <button class="history-item" data-history-index="${index}">
        <span>${displayExpression(item.expression)}</span>
        <strong>${escapeHtml(localizeDecimal(item.result))}</strong>
      </button>`).join("")
    : '<div class="history-empty"><span>◷</span><strong>История пока пуста</strong><small>Ваши вычисления будут здесь</small></div>';
}

function render() {
  const screenKey = state.mode === "professional"
    ? `${state.mode}:${state.professionalTool}:${state.professionalTab}:${state.professionalFinanceTab}`
    : state.mode;
  const screenChanged = screenKey !== lastRenderedScreen;
  lastRenderedScreen = screenKey;
  document.body.classList.toggle("professional-mode", state.mode === "professional");
  document.body.classList.toggle("theme-dark", state.theme === "dark");
  document.body.classList.toggle("appearance-translucent", state.appearance === "translucent");
  document.body.classList.toggle("appearance-liquid-glass", state.appearance === "liquid-glass");
  document.documentElement.lang = state.language;
  void syncNativeWindowAppearance();
  if (state.mode === "professional") {
    root.innerHTML = renderProfessionalWorkspace();
    renderAccountControls();
    applyLanguage();
    if (screenChanged) root.firstElementChild?.classList.add("screen-enter");
    return;
  }
  root.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="brand">
          <img class="brand__logo" src="${logoUrl}" alt="Limon Calculator" />
          <div class="brand__copy"><strong>Limon <span>Calculator</span></strong><small>Точность в каждом вычислении</small></div>
        </div>
        <nav class="mode-tabs" aria-label="Режим калькулятора">
          ${modes.map((mode) => `<button class="mode-tab ${state.mode === mode ? "is-active" : ""}" data-mode="${mode}" aria-pressed="${state.mode === mode}">${modeLabels[mode]}</button>`).join("")}
        </nav>
      </header>
      <div class="workspace">
        <section class="calculator">
          ${state.mode === "advanced" ? `<div class="calculator-toolbar">
            <div class="toolbar-actions advanced-actions">
              <button class="toolbar-chip" data-action="angle" aria-label="Переключить режим углов" title="Режим углов">${state.angle}</button>
              <div class="memory-actions" aria-label="Калькулятор памяти">
                <button class="toolbar-chip" data-memory="clear" title="Очистить память" aria-label="Очистить память">MC</button>
                <button class="toolbar-chip" data-memory="recall" title="Вставить значение из памяти" aria-label="Вставить значение из памяти">MR</button>
                <button class="toolbar-chip" data-memory="add" title="Прибавить результат к памяти" aria-label="Прибавить результат к памяти">M+</button>
                <button class="toolbar-chip" data-memory="subtract" title="Вычесть результат из памяти" aria-label="Вычесть результат из памяти">M−</button>
              </div>
              <button class="toolbar-chip" data-key="ans" aria-label="Вставить предыдущий результат" title="Вставить предыдущий результат">Ans</button>
            </div>
          </div>` : ""}
          <div class="display ${state.error ? "display--error" : ""} ${state.justEvaluated ? "display--evaluated" : ""}" aria-live="polite">
            ${state.mode === "advanced" && state.hasMemory ? '<span class="display__memory" aria-label="В памяти есть значение">M</span>' : ""}
            <div class="display__expression">${state.justEvaluated ? escapeHtml(state.result) : state.expression ? displayExpression(state.expression) : '<span class="display-placeholder">Введите выражение</span>'}</div>
            <div class="display__result">${escapeHtml(state.error || localizeDecimal(state.result))}</div>
            <button class="display__copy" data-action="copy" aria-label="Скопировать результат" title="Скопировать результат">⧉</button>
            <div class="display__hint">${state.error ? "Проверьте выражение и попробуйте ещё раз" : state.justEvaluated ? "Продолжайте вычисление с этим результатом" : state.expression ? "Выражение остаётся на экране — продолжайте редактировать" : ""}</div>
          </div>
          ${state.mode === "advanced"
            ? `<div class="advanced-keypad-layout">${renderFunctionPanel()}<div class="keypad keypad--advanced" aria-label="Клавиатура калькулятора">${renderKeys()}</div></div>`
            : `<div class="keypad keypad--normal" aria-label="Клавиатура калькулятора">${renderKeys()}</div>`}
          <div class="calculator-footer"><span>↵ вычислить</span><span>Esc очистить</span><span>⌫ удалить символ</span></div>
        </section>
        <aside class="history">
          <div class="history__heading"><div><span class="eyebrow">ВАШИ ДАННЫЕ</span><h2>История</h2></div><div class="history__actions"><span class="history-storage" title="История хранится только на этом устройстве" aria-label="История хранится только на этом устройстве">ⓘ</span><button class="text-button" data-action="clear-history" ${state.history.length ? "" : "disabled"}>Очистить</button></div></div>
          <div class="history__list">${renderHistory()}</div>
        </aside>
      </div>
      <div class="toast-region" aria-live="polite"></div>
    </main>`;
  renderAccountControls();
  applyLanguage();
  if (screenChanged) root.firstElementChild?.classList.add("screen-enter");
}

function workspaceSuggestionsFor(text, selectionStart, selectionEnd) {
  const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
  const beforeCaret = text.slice(lineStart, selectionStart);
  const match = beforeCaret.match(/[\p{L}_][\p{L}\p{N}_]*$/u);
  if (!match) return null;
  const items = getWorkspaceFunctionSuggestions(match[0]);
  if (!items.length) return null;
  const suffix = text.slice(selectionEnd).match(/^[\p{L}\p{N}_]*/u)?.[0] || "";
  return {
    items,
    index: 0,
    start: selectionStart - match[0].length,
    end: selectionEnd + suffix.length,
    lineIndex: text.slice(0, lineStart).split("\n").length - 1,
  };
}

function saveWorkspaceText() {
  try {
    localStorage.setItem(workspaceKey, state.workspaceText);
    state.workspaceStorageError = "";
  } catch {
    state.workspaceStorageError = "Не удалось сохранить текст на этом устройстве.";
  }
}

function updateWorkspaceText(text, start, end = start, { focus = true } = {}) {
  state.workspaceText = text;
  state.workspaceCursor = {
    start,
    end,
    line: text.slice(0, start).split("\n").length,
  };
  state.workspaceAutocomplete = workspaceSuggestionsFor(text, start, end);
  saveWorkspaceText();
  render();
  if (focus) {
    const editor = root.querySelector(".workspace-editor");
    editor?.focus();
    editor?.setSelectionRange(start, end);
  }
}

function insertWorkspaceToken(token, selection = null) {
  const editor = root.querySelector(".workspace-editor");
  const start = selection?.start ?? editor?.selectionStart ?? state.workspaceCursor.start;
  const end = selection?.end ?? editor?.selectionEnd ?? state.workspaceCursor.end;
  const text = `${state.workspaceText.slice(0, start)}${token}${state.workspaceText.slice(end)}`;
  const caret = start + token.length;
  updateWorkspaceText(text, caret);
}

function acceptWorkspaceSuggestion(item = null) {
  const autocomplete = state.workspaceAutocomplete;
  if (!autocomplete?.items.length) return;
  const suggestion = item || autocomplete.items[autocomplete.index];
  if (!suggestion) return;
  const insertion = `${suggestion.name}(`;
  const text = `${state.workspaceText.slice(0, autocomplete.start)}${insertion}${state.workspaceText.slice(autocomplete.end)}`;
  const caret = autocomplete.start + insertion.length;
  updateWorkspaceText(text, caret);
}

function workspaceCsvCell(value) {
  const text = String(value ?? "");
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function saveWorkspaceCsv() {
  const rows = evaluateWorkspace(state.workspaceText, {
    ans: state.lastAnswer,
    angleUnit: state.workspaceAngle,
  }).rows;
  const csv = [
    ["Строка", "Результат", "Ошибка"],
    ...rows.map((row) => [row.source, row.result, row.error]),
  ].map((row) => row.map(workspaceCsvCell).join(";")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "limon-workspace.csv";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showToast(message) {
  const region = root.querySelector(".toast-region");
  region.textContent = translateUiText(message);
  region.classList.add("is-visible");
  window.setTimeout(() => region.classList.remove("is-visible"), 2600);
}

function updateResult() {
  state.error = "";
  if (!state.expression) {
    state.result = "0";
    render();
    return;
  }
  try {
    const value = evaluateExpression(state.expression, { ans: state.lastAnswer, angleUnit: state.angle });
    state.result = localizeDecimal(formatResult(value));
  } catch {
    state.result = "…";
  }
  render();
}

function addToHistory(expression, result) {
  if (!expression.trim()) return;
  state.history.unshift({ expression, result, timestamp: Date.now() });
  state.history = state.history.slice(0, 30);
  localStorage.setItem(historyKey, JSON.stringify(state.history));
}

function evaluate() {
  if (!state.expression.trim() || state.justEvaluated) return;
  try {
    const opening = (state.expression.match(/\(/g) || []).length;
    const closing = (state.expression.match(/\)/g) || []).length;
    if (opening > closing) state.expression += ")".repeat(opening - closing);
    const value = evaluateExpression(state.expression, { ans: state.lastAnswer, angleUnit: state.angle });
    const formatted = localizeDecimal(formatResult(value));
    addToHistory(state.expression, formatted);
    if (typeof value === "number" && Number.isFinite(value)) state.lastAnswer = value;
    state.result = formatted;
    state.error = "";
    state.justEvaluated = true;
    render();
  } catch (error) {
    state.error = error.message || "Не удалось вычислить выражение.";
    render();
  }
}

function appendToken(token) {
  state.error = "";
  if (token === "clear") {
    state.expression = "";
    state.result = "0";
    state.justEvaluated = false;
  } else if (token === "backspace") {
    if (state.justEvaluated) state.expression = formatResult(state.lastAnswer);
    state.expression = state.expression.slice(0, -1);
    state.justEvaluated = false;
  } else if (token === "equals") {
    evaluate();
    return;
  } else {
    if (state.justEvaluated) {
      if (/^[0-9.]$/.test(token) || ["pi", "e", "tau", "i", "ans", "["].includes(token)) {
        state.expression = "";
      } else if (token === "sign") {
        state.expression = `-(${formatResult(state.lastAnswer)})`;
        state.justEvaluated = false;
        updateResult();
        return;
      } else if (token.endsWith("(")) {
        state.expression = `${token}${formatResult(state.lastAnswer)})`;
        state.justEvaluated = false;
        updateResult();
        return;
      } else {
        state.expression = formatResult(state.lastAnswer);
      }
      state.justEvaluated = false;
    }
    if (token === "sign") {
    state.expression = state.expression
      ? `-(${state.expression})`
      : "-";
    } else if (token === "percent") {
      const match = state.expression.match(/(\d+(?:\.\d+)?)$/);
      if (match) state.expression = `${state.expression.slice(0, -match[1].length)}${match[1]}%`;
    } else if (token.endsWith("(")) {
      const currentExpression = state.expression.trim();
      if (currentExpression) {
        try {
          evaluateExpression(currentExpression, { ans: state.lastAnswer, angleUnit: state.angle });
          state.expression = `${token}${currentExpression})`;
        } catch {
          state.expression += token;
        }
      } else {
        state.expression += token;
      }
    } else if (token === "mod") {
      state.expression += " mod ";
    } else if (token === "root") {
      const radicand = state.justEvaluated ? formatResult(state.lastAnswer) : state.expression.trim();
      if (!radicand) {
        state.error = "Сначала введите подкоренное число.";
        render();
        return;
      }
      state.expression = `(${radicand})^(1/`;
      state.justEvaluated = false;
      updateResult();
      return;
    } else if (token === "1/(") {
      state.expression += "1/(";
    } else {
      state.expression += token;
    }
  }
  updateResult();
}

function currentNumericValue() {
  const value = state.expression.trim()
    ? evaluateExpression(state.expression, { ans: state.lastAnswer, angleUnit: state.angle })
    : state.lastAnswer;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Для памяти нужен конечный числовой результат.");
  }
  return value;
}

function handleMemory(action) {
  if (action === "clear") {
    state.memory = 0;
    state.hasMemory = false;
    render();
    return;
  }
  if (action === "recall") {
    if (!state.hasMemory) {
      showToast("Память пуста");
      return;
    }
    const recalled = formatResult(state.memory);
    if (!state.expression || state.justEvaluated) {
      state.expression = recalled;
    } else {
      state.expression += `(${recalled})`;
    }
    state.justEvaluated = false;
    updateResult();
    return;
  }
  try {
    const value = currentNumericValue();
    state.memory = (state.hasMemory ? state.memory : 0)
      + (action === "subtract" ? -value : value);
    if (!Number.isFinite(state.memory)) throw new Error("Значение памяти вышло за допустимый диапазон.");
    state.hasMemory = true;
    render();
  } catch (error) {
    showToast(error.message || "Не удалось изменить значение в памяти");
  }
}

function handleProfessionalForm(form) {
  const values = Object.fromEntries(new FormData(form));
  if (form.dataset.professionalForm === "function") {
    state.functionDraft = values;
    try {
      state.functionGraph = sampleFunction(values.expression, values.min, values.max, {
        angleUnit: values.angleUnit,
      });
      state.functionError = "";
    } catch (error) {
      state.functionError = error.message || "Не удалось построить график.";
    }
  } else if (form.dataset.professionalForm === "data") {
    state.chartDraft = values;
    try {
      state.chartData = parseChartData(values.labels, values.values, values.type);
      state.chartError = "";
    } catch (error) {
      state.chartError = error.message || "Не удалось построить диаграмму.";
    }
  } else {
    state.professionalExpression = values.expression;
    state.professionalAngle = values.angleUnit;
    try {
      const value = evaluateExpression(values.expression, {
        ans: state.lastAnswer,
        angleUnit: values.angleUnit,
      });
      state.professionalResult = localizeDecimal(formatResult(value));
      state.professionalError = "";
      if (typeof value === "number" && Number.isFinite(value)) state.lastAnswer = value;
      addToHistory(values.expression, state.professionalResult);
    } catch (error) {
      state.professionalResult = "";
      state.professionalError = error.message || "Не удалось вычислить выражение.";
    }
  }
  render();
}

root.addEventListener("input", (event) => {
  if (event.target.matches("[data-account-auth-field]")) {
    state.accountAuthDraft[event.target.name] = event.target.value;
    return;
  }
  if (event.target.matches("[data-finance-field]")) {
    const field = event.target.dataset.financeField;
    const selectionStart = event.target.selectionStart;
    const selectionEnd = event.target.selectionEnd;
    state.financeDraft[field] = event.target.value;
    render();
    const replacement = root.querySelector(`[data-finance-field="${field}"]`);
    replacement?.focus();
    if (typeof selectionStart === "number") replacement?.setSelectionRange(selectionStart, selectionEnd);
    return;
  }
  if (event.target.matches("[data-finance-vat-rate]")) {
    const selectionStart = event.target.selectionStart;
    const selectionEnd = event.target.selectionEnd;
    state.financeVatRate = event.target.value;
    render();
    const replacement = root.querySelector("[data-finance-vat-rate]");
    replacement?.focus();
    if (typeof selectionStart === "number") replacement?.setSelectionRange(selectionStart, selectionEnd);
    return;
  }
  if (event.target.matches("[data-converter-value]")) {
    const selectionStart = event.target.selectionStart;
    const selectionEnd = event.target.selectionEnd;
    state.converterValue = event.target.value;
    render();
    const replacement = root.querySelector("[data-converter-value]");
    replacement?.focus();
    if (typeof selectionStart === "number") replacement?.setSelectionRange(selectionStart, selectionEnd);
    return;
  }
  if (event.target.matches(".programmer-input")) {
    const field = event.target.dataset.programmerInput;
    const selectionStart = event.target.selectionStart;
    const selectionEnd = event.target.selectionEnd;
    if (field === "a") state.programmerA = event.target.value;
    if (field === "b") state.programmerB = event.target.value;
    state.programmerError = "";
    render();
    const replacement = root.querySelector(`[data-programmer-input="${field}"]`);
    replacement?.focus();
    if (typeof selectionStart === "number") replacement?.setSelectionRange(selectionStart, selectionEnd);
    return;
  }
  if (!event.target.matches(".workspace-editor")) return;
  const editor = event.target;
  updateWorkspaceText(editor.value, editor.selectionStart, editor.selectionEnd);
});

root.addEventListener("change", (event) => {
  if (event.target.matches("[data-app-setting]")) {
    const setting = event.target.dataset.appSetting;
    if (setting === "language") {
      state.language = event.target.value === "en" ? "en" : "ru";
      saveAppSettings();
      render();
      root.querySelector('[data-app-setting="language"]')?.focus();
    } else if (setting === "theme") {
      state.theme = event.target.value === "dark" ? "dark" : "light";
      document.body.classList.toggle("theme-dark", state.theme === "dark");
      saveAppSettings();
      void syncNativeWindowAppearance();
    } else if (setting === "appearance") {
      state.appearance = ["standard", "translucent", "liquid-glass"].includes(event.target.value)
        ? event.target.value
        : "standard";
      document.body.classList.toggle("appearance-translucent", state.appearance === "translucent");
      document.body.classList.toggle("appearance-liquid-glass", state.appearance === "liquid-glass");
      saveAppSettings();
      void syncNativeWindowAppearance();
    }
    return;
  }
  if (event.target.matches("[data-finance-currency]")) {
    state.financeCurrency = financeCurrencies.some(([code]) => code === event.target.value)
      ? event.target.value
      : "RUB";
    try {
      localStorage.setItem(financeCurrencyKey, state.financeCurrency);
    } catch {
      showToast("Не удалось сохранить выбранную валюту на этом устройстве");
    }
    render();
  }
  if (event.target.matches("[data-converter-unit]")) {
    const direction = event.target.dataset.converterUnit;
    if (direction === "from") state.converterFrom = event.target.value;
    if (direction === "to") state.converterTo = event.target.value;
    render();
  }
  if (event.target.matches("[data-finance-field='loanType']")) {
    state.financeDraft.loanType = event.target.value;
    render();
  }
});

root.addEventListener("keydown", (event) => {
  if (!event.target.matches(".workspace-editor") || !state.workspaceAutocomplete?.items.length) return;
  const autocomplete = state.workspaceAutocomplete;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    autocomplete.index = (autocomplete.index + direction + autocomplete.items.length) % autocomplete.items.length;
    render();
    const editor = root.querySelector(".workspace-editor");
    editor?.focus();
    editor?.setSelectionRange(state.workspaceCursor.start, state.workspaceCursor.end);
  } else if (event.key === "Tab" || event.key === "Enter") {
    event.preventDefault();
    acceptWorkspaceSuggestion();
  } else if (event.key === "Escape") {
    event.preventDefault();
    state.workspaceAutocomplete = null;
    render();
    const editor = root.querySelector(".workspace-editor");
    editor?.focus();
    editor?.setSelectionRange(state.workspaceCursor.start, state.workspaceCursor.end);
  }
});

root.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-account-open")) {
    openAccountDrawer();
    return;
  }
  if (target.hasAttribute("data-account-close")) {
    closeAccountDrawer();
    return;
  }
  if (target.hasAttribute("data-account-settings-toggle")) {
    state.accountSettingsOpen = !state.accountSettingsOpen;
    target.setAttribute("aria-expanded", String(state.accountSettingsOpen));
    const fields = root.querySelector(".account-settings__fields");
    fields?.classList.toggle("is-expanded", state.accountSettingsOpen);
    fields?.setAttribute("aria-hidden", String(!state.accountSettingsOpen));
    return;
  }
  if (target.dataset.accountAuthMode) {
    state.accountAuthMode = target.dataset.accountAuthMode;
    state.accountAuthMessage = null;
    render();
    root.querySelector(`[name="${state.accountAuthMode === "sign-up" ? "name" : "email"}"]`)?.focus();
    return;
  }
  if (target.dataset.authAction === "sign-out") {
    if (state.accountAuthBusy) return;
    state.accountAuthBusy = true;
    target.disabled = true;
    target.textContent = "Выходим…";
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      state.accountUser = null;
      state.accountAuthMessage = null;
    } catch (error) {
      state.accountAuthMessage = { type: "error", text: accountErrorMessage(error) };
    } finally {
      state.accountAuthBusy = false;
      render();
    }
    return;
  }
  if (target.dataset.financeTab) {
    state.professionalFinanceTab = target.dataset.financeTab;
    render();
    return;
  }
  if (target.dataset.converterCategory) {
    state.converterCategory = target.dataset.converterCategory;
    state.converterFrom = converterOptions[state.converterCategory][0][0];
    state.converterTo = converterOptions[state.converterCategory][1]?.[0] || state.converterFrom;
    render();
    return;
  }
  if (target.dataset.mode) {
    state.mode = target.dataset.mode;
    updateResult();
    return;
  }
  if (target.dataset.professionalTool) {
    state.professionalTool = target.dataset.professionalTool;
    if (target.dataset.professionalTool === "converter") state.professionalFinanceTab = "converter";
    if (target.dataset.professionalTool === "finance") state.professionalFinanceTab = "loan";
    render();
    return;
  }
  if (target.dataset.financeAction) {
    const action = target.dataset.financeAction;
    if (action === "insert-pmt") {
      const line = `pmt(${state.financeDraft.principal}; ${state.financeDraft.annualRate}%; ${state.financeDraft.months})`;
      state.workspaceText = `${state.workspaceText}${state.workspaceText.endsWith("\n") || !state.workspaceText ? "" : "\n"}${line}`;
      state.professionalTool = "workspace";
      saveWorkspaceText();
      render();
      showToast("Формула вставлена в рабочую область");
    } else if (action === "insert-compound") {
      const line = "100000 * (1 + 8%)^5";
      state.workspaceText = `${state.workspaceText}${state.workspaceText.endsWith("\n") || !state.workspaceText ? "" : "\n"}${line}`;
      state.professionalTool = "workspace";
      saveWorkspaceText();
      render();
      showToast("Расчёт вставлен в рабочую область");
    } else if (action === "export-csv") {
      try {
        const principal = Number(state.financeDraft.principal.replace(",", "."));
        const annualRate = Number(state.financeDraft.annualRate.replace(",", "."));
        const months = Number(state.financeDraft.months);
        const loan = calculateLoan({ principal, annualRate, months, type: state.financeDraft.loanType });
        const csv = [
          ["Месяц", `Платёж (${state.financeCurrency})`, `Проценты (${state.financeCurrency})`, `Основной долг (${state.financeCurrency})`, `Остаток (${state.financeCurrency})`],
          ...loan.schedule.map((row) => [row.month, row.payment, row.interest, row.principal, row.balance]),
        ].map((row) => row.map(workspaceCsvCell).join(";")).join("\r\n");
        const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "limon-loan.csv";
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast("CSV сохранён");
      } catch (caught) {
        showToast(caught.message || "Не удалось сохранить CSV");
      }
    }
    return;
  }
  if (target.dataset.programmerBits) {
    state.programmerBits = Number(target.dataset.programmerBits);
    state.programmerError = "";
    render();
    return;
  }
  if (target.dataset.programmerSign) {
    state.programmerSigned = target.dataset.programmerSign === "signed";
    state.programmerError = "";
    render();
    return;
  }
  if (target.dataset.programmerBit !== undefined) {
    try {
      const a = parseProgrammerInteger(state.programmerA, state.programmerBits, state.programmerSigned);
      const position = BigInt(target.dataset.programmerBit);
      const toggled = a ^ (1n << position);
      state.programmerA = toggled.toString();
      state.programmerError = "";
    } catch (caught) {
      state.programmerError = caught.message || "Некорректное значение A.";
    }
    render();
    return;
  }
  if (target.hasAttribute("data-copy-programmer")) {
    try {
      const a = parseProgrammerInteger(state.programmerA, state.programmerBits, state.programmerSigned);
      await navigator.clipboard.writeText(formatProgrammerInteger(
        a,
        target.dataset.copyProgrammer,
        state.programmerBits,
        state.programmerSigned,
      ));
      showToast(`${target.dataset.copyProgrammer.toUpperCase()} скопирован`);
    } catch (caught) {
      showToast(caught.message || "Не удалось скопировать значение");
    }
    return;
  }
  if (target.dataset.workspaceFunction) {
    acceptWorkspaceSuggestion({ name: target.dataset.workspaceFunction });
    return;
  }
  if (target.dataset.workspaceVariable) {
    insertWorkspaceToken(target.dataset.workspaceVariable);
    return;
  }
  if (target.dataset.workspaceAction) {
    const action = target.dataset.workspaceAction;
    if (action === "insert-programmer") {
      try {
        const a = parseProgrammerInteger(state.programmerA, state.programmerBits, state.programmerSigned);
        const insertion = a.toString();
        state.workspaceText = `${state.workspaceText}${state.workspaceText.endsWith("\n") || !state.workspaceText ? "" : "\n"}${insertion}`;
        state.professionalTool = "workspace";
        saveWorkspaceText();
        render();
        showToast("Значение вставлено в рабочую область");
      } catch (caught) {
        showToast(caught.message || "Некорректное значение");
      }
    } else if (action === "angle") {
      state.workspaceAngle = state.workspaceAngle === "DEG"
        ? "RAD"
        : state.workspaceAngle === "RAD" ? "GRAD" : "DEG";
      render();
    } else if (action === "export-csv") {
      try {
        saveWorkspaceCsv();
        showToast("CSV сохранён");
      } catch (error) {
        showToast(error.message || "Не удалось сохранить CSV");
      }
    } else {
      const text = action === "copy-text"
        ? state.workspaceText
        : evaluateWorkspace(state.workspaceText, {
          ans: state.lastAnswer,
          angleUnit: state.workspaceAngle,
        }).rows.map((row) => row.result).filter(Boolean).join("\n");
      if (!text) {
        showToast(action === "copy-text" ? "В редакторе нет текста" : "Нет значений для копирования");
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        showToast(action === "copy-text" ? "Текст строк скопирован" : "Значения скопированы");
      } catch (error) {
        showToast(error.message || "Не удалось скопировать данные");
      }
    }
    return;
  }
  if (target.dataset.memory) {
    handleMemory(target.dataset.memory);
    return;
  }
  if (target.dataset.key === "second") {
    state.secondFunction = !state.secondFunction;
    render();
    return;
  }
  if (target.dataset.professionalTab) {
    state.professionalTab = target.dataset.professionalTab;
    render();
    return;
  }
  if (target.dataset.functionTemplate) {
    state.functionDraft.expression = target.dataset.functionTemplate;
    state.functionError = "";
    render();
    return;
  }
  if (target.dataset.professionalHistoryIndex !== undefined) {
    const item = state.history[Number(target.dataset.professionalHistoryIndex)];
    if (item) {
      state.professionalExpression = item.expression;
      state.professionalResult = item.result;
      state.professionalError = "";
      state.professionalTab = "calculate";
      render();
    }
    return;
  }
  if (target.hasAttribute("data-copy-professional-result")) {
    try {
      await navigator.clipboard.writeText(localizeDecimal(state.professionalResult));
      showToast("Результат скопирован");
    } catch {
      showToast("Не удалось скопировать результат");
    }
    return;
  }
  if (target.dataset.key) {
    if (state.secondFunction) state.secondFunction = false;
    appendToken(target.dataset.key);
    return;
  }
  if (target.dataset.historyIndex !== undefined) {
    const item = state.history[Number(target.dataset.historyIndex)];
    if (item) {
      state.expression = item.expression;
      state.result = item.result;
      try {
        const value = evaluateExpression(item.expression, { ans: state.lastAnswer, angleUnit: state.angle });
        if (typeof value === "number" && Number.isFinite(value)) state.lastAnswer = value;
      } catch {
        state.lastAnswer = 0;
      }
      state.error = "";
      state.justEvaluated = false;
      render();
    }
    return;
  }
  switch (target.dataset.action) {
    case "angle":
      state.angle = state.angle === "DEG" ? "RAD" : state.angle === "RAD" ? "GRAD" : "DEG";
      updateResult();
      break;
    case "clear-history":
      state.history = [];
      localStorage.removeItem(historyKey);
      render();
      break;
    case "copy":
      try {
        await navigator.clipboard.writeText(localizeDecimal(state.result));
        showToast("Результат скопирован");
      } catch {
        showToast("Не удалось скопировать результат");
      }
      break;
  }
});

root.addEventListener("submit", (event) => {
  const accountForm = event.target.closest("#account-auth-form");
  if (accountForm) {
    event.preventDefault();
    void submitAccountAuthForm(accountForm);
    return;
  }
  const form = event.target.closest("[data-professional-form]");
  if (!form) return;
  event.preventDefault();
  handleProfessionalForm(form);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.accountOpen) {
    event.preventDefault();
    closeAccountDrawer();
    return;
  }
  if (event.key === "Tab" && state.accountOpen) {
    const drawer = root.querySelector(".account-drawer");
    const focusable = drawer?.querySelectorAll('button:not(:disabled), input:not(:disabled)') || [];
    if (!focusable.length) {
      event.preventDefault();
      drawer?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === drawer)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  if (state.accountOpen) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof Element
    && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
  if (/^[0-9.]$/.test(event.key)) {
    event.preventDefault();
    appendToken(event.key === "." ? "." : event.key);
  } else if (["+", "-", "*", "/", "^", "(", ")"].includes(event.key)) {
    event.preventDefault();
    appendToken(event.key);
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    evaluate();
  } else if (event.key === "Backspace") {
    event.preventDefault();
    appendToken("backspace");
  } else if (event.key === "Escape") {
    appendToken("clear");
  } else if (event.key === "%") {
    event.preventDefault();
    appendToken("percent");
  } else if (event.key === ",") {
    event.preventDefault();
    appendToken(/(?:mod|nthRoot)\([^()]*$/i.test(state.expression) ? "," : ".");
  } else if (event.key === ";") {
    event.preventDefault();
    appendToken(",");
  } else if (["[", "]"].includes(event.key)) {
    event.preventDefault();
    appendToken(event.key);
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  const nextUser = session?.user ? accountProfile(session.user) : null;
  const userChanged = state.accountUser?.id !== nextUser?.id
    || state.accountUser?.name !== nextUser?.name
    || state.accountUser?.email !== nextUser?.email;
  const wasLoading = !state.accountReady;
  state.accountUser = nextUser;
  state.accountReady = true;
  if (userChanged || wasLoading) render();
});

render();
