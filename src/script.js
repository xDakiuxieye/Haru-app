
/* ========================================
   HARU — funciones e interacción
   ======================================== */

"use strict";

const $ = (selector, parent = document) =>
  parent.querySelector(selector);

const $$ = (selector, parent = document) =>
  [...parent.querySelectorAll(selector)];

const STORAGE_KEYS = {
  habits: "haru-habits-v1",
  diary: "haru-diary-v1",
  theme: "haru-theme-v1"
};

const today = () => formatDate(new Date());

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLongDate(value) {
  return parseDate(value).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatShortDate(value) {
  return parseDate(value).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;

    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch (error) {
    console.error(`No se pudo leer ${key}:`, error);
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`No se pudo guardar ${key}:`, error);
    alert("No se pudieron guardar los cambios. Comprueba el almacenamiento disponible del navegador.");
    return false;
  }
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ---------- Datos iniciales ---------- */

const defaultHabits = [
  { id: "agua", name: "Beber un vaso de agua", completedDates: [] },
  { id: "pausa", name: "Tomarme un momento para mí", completedDates: [] },
  { id: "orden", name: "Ordenar un pequeño espacio", completedDates: [] }
];

let habits = readStorage(STORAGE_KEYS.habits, null);
let diaryEntries = readStorage(STORAGE_KEYS.diary, []);
let currentTheme = readStorage(STORAGE_KEYS.theme, "dia");

if (!Array.isArray(habits)) {
  habits = defaultHabits.map(habit => ({
    ...habit,
    completedDates: []
  }));
}

if (!Array.isArray(diaryEntries)) {
  diaryEntries = [];
}

if (!["dia", "tarde", "noche"].includes(currentTheme)) {
  currentTheme = "dia";
}

let currentPage = "inicio";
let calendarMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1
);
let selectedDate = today();
let editingDiaryId = null;

/* ---------- Guardado ---------- */

function saveHabits() {
  return saveStorage(STORAGE_KEYS.habits, habits);
}

function saveDiary() {
  return saveStorage(STORAGE_KEYS.diary, diaryEntries);
}

/* ---------- Navegación ---------- */


const pageHeadings = {
  inicio: "Un nuevo día",
  habitos: "Mis pequeños hábitos",
  calendario: "Tus días, a tu ritmo",
  diario: "Un lugar para ti",
  ajustes: "Ajustes de Haru",
  zen: "Zen Space · Un momento para ti"
};



function navigate(page) {
  const target = $(`#page-${page}`);

  if (!target) return;

if (page === "diario" && !canOpenDiary()) {
  return;
}
window.navigate = navigate;
  currentPage = page;

  $$(".page-section").forEach(section => {
    section.classList.toggle("active", section === target);
  });

  $$(".nav-item").forEach(button => {
    const active = button.dataset.page === page;
    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  $("#top-heading").textContent = pageHeadings[page] || "Haru";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.page);
  });
});

$$("[data-go]").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    navigate(button.dataset.go);
  });
});

/* ---------- Apariencia ---------- */

function applyTheme(theme, persist = true) {
  if (!["dia", "tarde", "noche"].includes(theme)) {
    theme = "dia";
  }

  currentTheme = theme;
  document.body.dataset.theme = theme;

  const themeColors = {
    dia: "#f3f6f7",
    tarde: "#faf0e8",
    noche: "#111b2b"
  };

  const themeMeta = $('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", themeColors[theme]);
  }

  $$("[data-theme-choice]").forEach(button => {
    const selected = button.dataset.themeChoice === theme;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));

    const label = $(".theme-selected", button);
    if (label) {
      label.textContent = selected ? "✓ Tema seleccionado" : "Seleccionar tema";
    }
  });

  if (persist) {
    saveStorage(STORAGE_KEYS.theme, theme);
  }
}

$$("[data-theme-choice]").forEach(button => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeChoice);
  });
});

/* ---------- Hábitos ---------- */

function isCompleted(habit, date = today()) {
  return Array.isArray(habit.completedDates) &&
    habit.completedDates.includes(date);
}

function toggleHabit(id, date = today()) {
  const habit = habits.find(item => item.id === id);
  if (!habit) return;

  if (!Array.isArray(habit.completedDates)) {
    habit.completedDates = [];
  }

  if (habit.completedDates.includes(date)) {
    habit.completedDates = habit.completedDates.filter(item => item !== date);
  } else {
    habit.completedDates.push(date);
  }

  if (saveHabits()) renderAll();
}

function renderHabitList(container, date = today(), showActions = false) {
  container.replaceChildren();

  if (habits.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const title = document.createElement("strong");
    title.textContent = "Aquí empieza algo bonito";

    const message = document.createElement("span");
    message.textContent = "Añade tu primer hábito cuando quieras.";

    empty.append(title, message);
    container.append(empty);
    return;
  }

  habits.forEach(habit => {
    const done = isCompleted(habit, date);

    const row = document.createElement("article");
    row.className = "habit-row";

    const check = document.createElement("button");
    check.type = "button";
    check.className = `habit-check${done ? " checked" : ""}`;
    check.textContent = done ? "✓" : "";
    check.setAttribute("aria-label", `${done ? "Desmarcar" : "Completar"} ${habit.name}`);
    check.setAttribute("aria-pressed", String(done));
    check.addEventListener("click", () => toggleHabit(habit.id, date));

    const main = document.createElement("div");
    main.className = "habit-main";

    const name = document.createElement("div");
    name.className = `habit-name${done ? " done" : ""}`;
    name.textContent = habit.name;

    const subtitle = document.createElement("div");
    subtitle.className = "habit-subtitle";
    subtitle.textContent = done ? "Hecho. ¡Buen trabajo! ♡" : "Un pequeño paso a la vez";

    main.append(name, subtitle);
    row.append(check, main);

    if (showActions) {
      const actions = document.createElement("div");
      actions.className = "habit-actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "small-action";
      edit.textContent = "Editar";
      edit.addEventListener("click", () => editHabit(habit.id));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "small-action delete";
      remove.textContent = "Eliminar";
      remove.addEventListener("click", () => deleteHabit(habit.id));

      actions.append(edit, remove);
      row.append(actions);
    }

    container.append(row);
  });
}

function renderHabits() {
  renderHabitList($("#home-habits"), today(), false);
  renderHabitList($("#all-habits"), today(), true);

  const completed = habits.filter(habit => isCompleted(habit)).length;

  $("#stat-completed").textContent = `${completed} / ${habits.length}`;
  $("#stat-total").textContent = String(habits.length);
  $("#habit-count").textContent =
    `${habits.length} ${habits.length === 1 ? "hábito" : "hábitos"}`;
}

$("#habit-form").addEventListener("submit", event => {
  event.preventDefault();

  const input = $("#habit-name");
  const name = input.value.trim();

  if (!name) {
    input.focus();
    return;
  }

  habits.push({
    id: makeId(),
    name,
    completedDates: []
  });

  if (saveHabits()) {
    input.value = "";
    renderAll();
    input.focus();
  } else {
    habits.pop();
  }
});

function editHabit(id) {
  const habit = habits.find(item => item.id === id);
  if (!habit) return;

  const updated = prompt("¿Cómo quieres llamar a este hábito?", habit.name);

  if (updated === null) return;

  const name = updated.trim();
  if (!name) {
    alert("El nombre no puede estar vacío.");
    return;
  }

  const previous = habit.name;
  habit.name = name;

  if (saveHabits()) {
    renderAll();
  } else {
    habit.name = previous;
  }
}

function deleteHabit(id) {
  const habit = habits.find(item => item.id === id);
  if (!habit) return;

  if (!confirm(`¿Quieres eliminar el hábito «${habit.name}» y su historial?`)) {
    return;
  }

  const previous = habits;
  habits = habits.filter(item => item.id !== id);

  if (saveHabits()) {
    renderAll();
  } else {
    habits = previous;
  }
}

$("#reset-today").addEventListener("click", () => {
  if (!confirm("¿Quieres desmarcar todos los hábitos de hoy?")) return;

  const previous = habits.map(habit => ({
    ...habit,
    completedDates: [...(habit.completedDates || [])]
  }));

  habits.forEach(habit => {
    habit.completedDates = (habit.completedDates || [])
      .filter(date => date !== today());
  });

  if (saveHabits()) {
    renderAll();
  } else {
    habits = previous;
  }
});

/* ---------- Calendario ---------- */

const monthFormatter = new Intl.DateTimeFormat("es-MX", {
  month: "long",
  year: "numeric"
});

function renderCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  $("#calendar-title").textContent = monthFormatter.format(calendarMonth);

  const grid = $("#calendar-grid");
  grid.replaceChildren();

  
const weekStart = Number(readStorage("haru-week-start-v1", 1));
const weekdays = weekStart === 0
  ? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
  : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

weekdays.forEach(day => {

    const heading = document.createElement("div");
    heading.className = "calendar-weekday";
    heading.textContent = day;
    grid.append(heading);
  });

  const firstDay = new Date(year, month, 1);
  
const offset = (firstDay.getDay() - weekStart + 7) % 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();

  for (let cell = 0; cell < 42; cell++) {
    let dayNumber;
    let date;
    let outside = false;

    if (cell < offset) {
      dayNumber = previousMonthDays - offset + cell + 1;
      date = new Date(year, month - 1, dayNumber);
      outside = true;
    } else if (cell >= offset + daysInMonth) {
      dayNumber = cell - offset - daysInMonth + 1;
      date = new Date(year, month + 1, dayNumber);
      outside = true;
    } else {
      dayNumber = cell - offset + 1;
      date = new Date(year, month, dayNumber);
    }

    const dateKey = formatDate(date);
    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "calendar-day";
    dayButton.textContent = String(dayNumber);
    dayButton.setAttribute("aria-label", formatLongDate(dateKey));

    if (outside) dayButton.classList.add("outside");
    if (dateKey === today()) dayButton.classList.add("today");
    if (dateKey === selectedDate) dayButton.classList.add("selected");

    const dots = document.createElement("span");
    dots.className = "calendar-dots";

    const hasCompletedHabit = habits.some(habit => isCompleted(habit, dateKey));
    const hasDiaryEntry = diaryEntries.some(entry => entry.date === dateKey);

    if (hasCompletedHabit) {
      const dot = document.createElement("i");
      dot.className = "habit-dot";
      dot.setAttribute("aria-label", "Hábitos completados");
      dots.append(dot);
    }

    if (hasDiaryEntry) {
      const dot = document.createElement("i");
      dot.className = "diary-dot";
      dot.setAttribute("aria-label", "Entrada de diario");
      dots.append(dot);
    }

    dayButton.append(dots);
    dayButton.addEventListener("click", () => {
      selectedDate = dateKey;

      if (date.getMonth() !== calendarMonth.getMonth() ||
          date.getFullYear() !== calendarMonth.getFullYear()) {
        calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      }

      renderCalendar();
      renderSelectedDay();
    });

    grid.append(dayButton);
  }

  $("#prev-month").disabled = year <= 1900 && month === 0;
  $("#next-month").disabled = year >= 2100 && month === 11;
}

$("#prev-month").addEventListener("click", () => {
  calendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() - 1,
    1
  );
  renderCalendar();
});

$("#next-month").addEventListener("click", () => {
  calendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    1
  );
  renderCalendar();
});

function renderSelectedDay() {
  $("#selected-date-title").textContent = formatLongDate(selectedDate);

  const content = $("#selected-day-content");
  content.replaceChildren();

  const dayHabits = habits.filter(habit => isCompleted(habit, selectedDate));
  const entries = diaryEntries.filter(entry => entry.date === selectedDate);

  const summary = document.createElement("p");
  summary.textContent =
    `${dayHabits.length} de ${habits.length} hábitos completados. ` +
    `${entries.length} ${entries.length === 1 ? "entrada" : "entradas"} de diario.`;
  content.append(summary);

  if (dayHabits.length) {
    const title = document.createElement("strong");
    title.textContent = "Pequeños logros";
    content.append(title);

    const list = document.createElement("ul");
    dayHabits.forEach(habit => {
      const item = document.createElement("li");
      item.textContent = habit.name;
      list.append(item);
    });
    content.append(list);
  }

  entries.forEach(entry => {
    const article = document.createElement("article");
    article.className = "diary-entry";

    const title = document.createElement("h3");
    title.textContent = entry.title || "Un momento de mi día";

    const text = document.createElement("p");
    text.textContent = entry.content || "Esta entrada no tiene texto.";

    article.append(title, text);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "text-button";
    edit.textContent = "Abrir en mi diario →";
    edit.addEventListener("click", () => {
      navigate("diario");
      startDiaryEdit(entry.id);
    });

    article.append(edit);
    content.append(article);
  });

  if (!dayHabits.length && !entries.length) {
    const empty = document.createElement("p");
    empty.textContent = "Este día está esperando su propia historia. Y está bien.";
    content.append(empty);
  }
}

/* ---------- Diario ---------- */

function resetDiaryForm() {
  editingDiaryId = null;
  $("#diary-form").reset();
  $("#diary-date").value = today();
  $("#cancel-edit").hidden = true;
  $("#diary-form button[type='submit']").textContent = "Guardar entrada ♡";
}

function startDiaryEdit(id) {
  const entry = diaryEntries.find(item => item.id === id);
  if (!entry) return;

  editingDiaryId = id;
  $("#diary-date").value = entry.date;
  $("#diary-title").value = entry.title || "";
  $("#diary-content").value = entry.content || "";
  $("#cancel-edit").hidden = false;
  $("#diary-form button[type='submit']").textContent = "Guardar cambios ♡";

  $("#diary-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#diary-form").addEventListener("submit", event => {
  event.preventDefault();

  const date = $("#diary-date").value;
  const title = $("#diary-title").value.trim();
  const content = $("#diary-content").value.trim();

  if (!date) {
    alert("Elige una fecha para tu entrada.");
    return;
  }

  if (!title && !content) {
    alert("Escribe un título o algo de texto antes de guardar.");
    $("#diary-content").focus();
    return;
  }

  const previous = diaryEntries.map(entry => ({ ...entry }));

  if (editingDiaryId) {
    diaryEntries = diaryEntries.map(entry =>
      entry.id === editingDiaryId
        ? { ...entry, date, title, content, updatedAt: new Date().toISOString() }
        : entry
    );
  } else {
    diaryEntries.push({
      id: makeId(),
      date,
      title,
      content,
      createdAt: new Date().toISOString()
    });
  }

  if (saveDiary()) {
    selectedDate = date;
    calendarMonth = new Date(
      parseDate(date).getFullYear(),
      parseDate(date).getMonth(),
      1
    );

    resetDiaryForm();
    renderAll();
  } else {
    diaryEntries = previous;
  }
});

$("#cancel-edit").addEventListener("click", resetDiaryForm);

function deleteDiaryEntry(id) {
  const entry = diaryEntries.find(item => item.id === id);
  if (!entry) return;

  if (!confirm("¿Quieres eliminar esta entrada del diario? Esta acción no se puede deshacer.")) {
    return;
  }

  const previous = diaryEntries;
  diaryEntries = diaryEntries.filter(item => item.id !== id);

  if (saveDiary()) {
    renderAll();
  } else {
    diaryEntries = previous;
  }
}

function renderDiary() {
  $("#stat-entries").textContent = String(diaryEntries.length);

  const list = $("#diary-list");
  list.replaceChildren();

  const sorted = [...diaryEntries].sort((a, b) =>
    b.date.localeCompare(a.date) ||
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );

  if (!sorted.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const title = document.createElement("strong");
    title.textContent = "Tu historia empieza aquí";

    const message = document.createElement("span");
    message.textContent = "Guarda tu primera entrada cuando te apetezca.";

    empty.append(title, message);
    list.append(empty);
    return;
  }

  sorted.forEach(entry => {
    const article = document.createElement("article");
    article.className = "diary-entry";

    const header = document.createElement("header");
    const info = document.createElement("div");

    const date = document.createElement("time");
    date.dateTime = entry.date;
    date.textContent = formatShortDate(entry.date);

    const title = document.createElement("h3");
    title.textContent = entry.title || "Un momento de mi día";

    info.append(date, title);

    const actions = document.createElement("div");
    actions.className = "habit-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "small-action";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => startDiaryEdit(entry.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small-action delete";
    remove.textContent = "Eliminar";
    remove.addEventListener("click", () => deleteDiaryEntry(entry.id));

    actions.append(edit, remove);
    header.append(info, actions);

    const text = document.createElement("p");
    text.textContent = entry.content || "";

    article.append(header, text);
    list.append(article);
  });
}

/* ---------- Fecha, frases y resumen ---------- */

const quotes = [
  "No necesitas florecer todos los días para seguir creciendo.",
  "Descansar también forma parte del camino.",
  "Los pequeños pasos siguen siendo pasos.",
  "No tienes que compararte con la primavera de nadie.",
  "Puedes empezar de nuevo tantas veces como lo necesites.",
  "Tu valor no depende de cuántas cosas consigas hacer hoy.",
  "A veces, avanzar es simplemente darte un respiro."
];

function renderHeader() {
  const now = new Date();

  $("#top-date").textContent = now.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).toLocaleUpperCase("es-MX");

  $("#daily-quote").textContent = quotes[now.getDate() % quotes.length];
}

$("#go-today").addEventListener("click", () => {
  const current = today();
  selectedDate = current;

  calendarMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );

  renderCalendar();
  renderSelectedDay();
  navigate("inicio");
});

/* ---------- Ajustes de Haru v1.0 ---------- */

const SETTINGS_KEYS = {
  weekStart: "haru-week-start-v1",
  diaryPin: "haru-diary-pin-v1",
  reminderEnabled: "haru-reminder-enabled-v1",
  reminderTime: "haru-reminder-time-v1"
};

function initSettings() {
  const weekStart = readStorage(SETTINGS_KEYS.weekStart, 1);
  $("#week-start").value = String(weekStart === 0 ? 0 : 1);

  $("#week-start").addEventListener("change", () => {
    const value = Number($("#week-start").value);
    saveStorage(SETTINGS_KEYS.weekStart, value === 0 ? 0 : 1);
    renderCalendar();
  });

  $("#export-data").addEventListener("click", exportData);

  $("#import-trigger").addEventListener("click", () => {
    $("#import-file").click();
  });

  $("#import-file").addEventListener("change", importData);

  $("#set-diary-pin").addEventListener("click", setDiaryPin);
  $("#remove-diary-pin").addEventListener("click", removeDiaryPin);

  $("#reminder-time").value = readStorage(
    SETTINGS_KEYS.reminderTime, "20:00"
  );

  $("#reminders-enabled").checked = readStorage(
    SETTINGS_KEYS.reminderEnabled, false
  );

  $("#reminder-time").addEventListener("change", () => {
    saveStorage(SETTINGS_KEYS.reminderTime, $("#reminder-time").value);
  });

  $("#reminders-enabled").addEventListener("change", toggleReminders);
  $("#test-reminder").addEventListener("click", testReminder);

  updateReminderStatus();
}

/* Exportación: genera un archivo JSON descargable. */

function exportData() {
  const backup = {
    app: "Haru",
    version: 1,
    exportedAt: new Date().toISOString(),
    habits,
    diaryEntries,
    preferences: {
      theme: currentTheme,
      weekStart: readStorage(SETTINGS_KEYS.weekStart, 1),
      reminderEnabled: readStorage(SETTINGS_KEYS.reminderEnabled, false),
      reminderTime: readStorage(SETTINGS_KEYS.reminderTime, "20:00")
    }
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `haru-copia-${today()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* Importación: valida la estructura y pide confirmación. */

async function importData(event) {
  const input = event.target;
  const file = input.files && input.files[0];

  if (!file) return;

  try {
    const backup = JSON.parse(await file.text());

    const validBackup =
      backup &&
      backup.app === "Haru" &&
      backup.version === 1 &&
      Array.isArray(backup.habits) &&
      Array.isArray(backup.diaryEntries) &&
      backup.habits.every(h =>
        h && typeof h.id === "string" &&
        typeof h.name === "string" &&
        Array.isArray(h.completedDates) &&
        h.completedDates.every(d =>
          typeof d === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(d)
        )
      ) &&
      backup.diaryEntries.every(entry =>
        entry &&
        typeof entry.id === "string" &&
        typeof entry.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
        typeof entry.title === "string" &&
        typeof entry.content === "string"
      );

    if (!validBackup) {
      alert("Este archivo no parece ser una copia válida de Haru v1.0.");
      return;
    }

    if (!confirm(
      "Importar esta copia reemplazará los hábitos y las entradas actuales. " +
      "¿Ya exportaste tus datos actuales y quieres continuar?"
    )) {
      return;
    }

    const previous = {
      habits: localStorage.getItem(STORAGE_KEYS.habits),
      diary: localStorage.getItem(STORAGE_KEYS.diary),
      theme: localStorage.getItem(STORAGE_KEYS.theme),
      weekStart: localStorage.getItem(SETTINGS_KEYS.weekStart),
      reminderEnabled: localStorage.getItem(SETTINGS_KEYS.reminderEnabled),
      reminderTime: localStorage.getItem(SETTINGS_KEYS.reminderTime)
    };

    try {
      const prefs = backup.preferences || {};

      if (!saveStorage(STORAGE_KEYS.habits, backup.habits) ||
          !saveStorage(STORAGE_KEYS.diary, backup.diaryEntries) ||
          !saveStorage(STORAGE_KEYS.theme,
            ["dia", "tarde", "noche"].includes(prefs.theme)
              ? prefs.theme : "dia") ||
          !saveStorage(SETTINGS_KEYS.weekStart,
            prefs.weekStart === 0 ? 0 : 1) ||
          !saveStorage(SETTINGS_KEYS.reminderEnabled,
            prefs.reminderEnabled === true) ||
          !saveStorage(SETTINGS_KEYS.reminderTime,
            typeof prefs.reminderTime === "string" &&
            /^\d{2}:\d{2}$/.test(prefs.reminderTime)
              ? prefs.reminderTime : "20:00")) {
        throw new Error("No se pudieron guardar todos los datos.");
      }

      habits = backup.habits;
      diaryEntries = backup.diaryEntries;
      currentTheme = ["dia", "tarde", "noche"].includes(prefs.theme)
        ? prefs.theme : "dia";

      calendarMonth = new Date(
        new Date().getFullYear(), new Date().getMonth(), 1
      );
      selectedDate = today();

      $("#week-start").value = String(prefs.weekStart === 0 ? 0 : 1);
      $("#reminder-time").value = readStorage(
        SETTINGS_KEYS.reminderTime, "20:00"
      );
      $("#reminders-enabled").checked = readStorage(
        SETTINGS_KEYS.reminderEnabled, false
      );

      renderAll();
      updateReminderStatus();
      alert("¡Copia importada! ♡");
    } catch (error) {
      for (const [key, value] of [
        [STORAGE_KEYS.habits, previous.habits],
        [STORAGE_KEYS.diary, previous.diary],
        [STORAGE_KEYS.theme, previous.theme],
        [SETTINGS_KEYS.weekStart, previous.weekStart],
        [SETTINGS_KEYS.reminderEnabled, previous.reminderEnabled],
        [SETTINGS_KEYS.reminderTime, previous.reminderTime]
      ]) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }

      habits = readStorage(STORAGE_KEYS.habits, []);
      diaryEntries = readStorage(STORAGE_KEYS.diary, []);
      currentTheme = readStorage(STORAGE_KEYS.theme, "dia");
      renderAll();

      alert("No se pudo completar la importación. Se restauraron los datos anteriores.");
      console.error(error);
    }
  } catch (error) {
    alert("No se pudo leer el archivo. Comprueba que sea un JSON válido.");
    console.error(error);
  } finally {
    input.value = "";
  }
}

/* Bloqueo de interfaz del diario.
   No equivale a cifrar los datos almacenados. */

let diaryUnlocked = false;

function setDiaryPin() {
  const pin = $("#diary-pin").value.trim();

  if (!/^\d{4,8}$/.test(pin)) {
    alert("El PIN debe tener entre 4 y 8 dígitos.");
    return;
  }

  const existingPin = readStorage(SETTINGS_KEYS.diaryPin, null);

  if (existingPin && !diaryUnlocked) {
    const currentPin = prompt("Introduce tu PIN actual para cambiarlo.");
    if (currentPin !== existingPin) {
      alert("El PIN no coincide.");
      return;
    }
  }

  if (!saveStorage(SETTINGS_KEYS.diaryPin, pin)) return;

  diaryUnlocked = true;
  $("#diary-pin").value = "";
  alert("PIN configurado. Recuerda que es un bloqueo básico, no cifrado.");
}

function removeDiaryPin() {
  const existingPin = readStorage(SETTINGS_KEYS.diaryPin, null);

  if (!existingPin) {
    alert("No hay ningún PIN configurado.");
    return;
  }

  const pin = prompt("Introduce tu PIN para quitar el bloqueo.");

  if (pin !== existingPin) {
    alert("El PIN no coincide.");
    return;
  }

  localStorage.removeItem(SETTINGS_KEYS.diaryPin);
  diaryUnlocked = false;
  alert("Bloqueo desactivado.");
}

function canOpenDiary() {
  const pin = readStorage(SETTINGS_KEYS.diaryPin, null);

  if (!pin || diaryUnlocked) return true;

  const entered = prompt("Tu diario está bloqueado. Introduce tu PIN.");

  if (entered === pin) {
    diaryUnlocked = true;
    return true;
  }

  alert("PIN incorrecto.");
  return false;
}

/* Recordatorios: funcionan mientras esta página esté abierta
   y el navegador permita mostrar notificaciones. */

let reminderTimer = null;
let lastReminderDate = "";

function updateReminderStatus(message) {
  $("#reminder-status").textContent = message ||
    ($("#reminders-enabled").checked
      ? "Recordatorio activado. Haru debe permanecer abierta para comprobar la hora."
      : "Los recordatorios están desactivados.");
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Este navegador no admite notificaciones web.");
    return false;
  }

  if (Notification.permission === "granted") return true;

  if (Notification.permission === "denied") {
    alert("Las notificaciones están bloqueadas en los permisos del navegador.");
    return false;
  }

  return (await Notification.requestPermission()) === "granted";
}

async function toggleReminders() {
  const enabled = $("#reminders-enabled").checked;

  if (enabled) {
    const allowed = await requestNotificationPermission();

    if (!allowed) {
      $("#reminders-enabled").checked = false;
      saveStorage(SETTINGS_KEYS.reminderEnabled, false);
      updateReminderStatus("No se activaron las notificaciones. Comprueba los permisos del navegador.");
      return;
    }
  }

  saveStorage(SETTINGS_KEYS.reminderEnabled, enabled);
  startReminderChecks();
  updateReminderStatus();
}

async function testReminder() {
  if (!await requestNotificationPermission()) {
    updateReminderStatus("Permite las notificaciones para probarlas.");
    return;
  }

  new Notification("Un pequeño recordatorio de Haru 🌸", {
    body: "Tómate un momento para ti. ¿Quieres revisar tus hábitos?",
    tag: "haru-test"
  });
}

function startReminderChecks() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = null;

  if (!readStorage(SETTINGS_KEYS.reminderEnabled, false)) return;

  const check = () => {
    if (document.visibilityState !== "visible") return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = new Date();
    const date = formatDate(now);
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const reminderTime = readStorage(SETTINGS_KEYS.reminderTime, "20:00");

    if (time !== reminderTime || lastReminderDate === date) return;

    lastReminderDate = date;

    const pending = habits.filter(habit => !isCompleted(habit, date)).length;

    new Notification("Un momento para Haru 🌸", {
      body: pending
        ? `Te quedan ${pending} hábitos por revisar. Haz lo que puedas, a tu ritmo.`
        : "Ya revisaste todos tus hábitos de hoy. ¡Gracias por dedicarte un momento!",
      tag: "haru-daily"
    });
  };

  check();
  reminderTimer = setInterval(check, 30000);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    startReminderChecks();
  }
});

/* ---------- Renderizado general ---------- */

function renderAll() {
  renderHeader();
  renderHabits();
  renderDiary();
  renderCalendar();
  renderSelectedDay();
  applyTheme(currentTheme, false);
}

/* ---------- Inicio ---------- */


$("#diary-date").value = today();
initSettings();
applyTheme(currentTheme, false);
renderAll();
startReminderChecks();

/* ---------- Perfil personal de Haru ---------- */

const PROFILE_KEYS = {
  name: "haru-profile-name-v1",
  photo: "haru-profile-photo-v1"
};

let profilePhotoData = "";

function renderProfile() {
  const savedName = localStorage.getItem(PROFILE_KEYS.name) || "";
  const name = $("#profile-name");
  const homeName = $("#home-profile-name");
  const avatar = $("#profile-avatar");
  
  const preview = $("#profile-photo-preview");

  if (name) name.value = savedName;
  if (homeName) homeName.textContent = savedName || "florecita";

  profilePhotoData = localStorage.getItem(PROFILE_KEYS.photo) || "";

  if (avatar) {
    avatar.querySelector("img")?.remove();

    if (profilePhotoData) {
      const img = document.createElement("img");
      img.src = profilePhotoData;
      img.alt = "Foto de perfil";
      img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 35%;border-radius:50%;display:block;margin:0";
      avatar.appendChild(img);
      
    }
  }

  if (preview) {
    preview.querySelector("img")?.remove();

    if (profilePhotoData) {
      const img = document.createElement("img");
      img.src = profilePhotoData;
      img.alt = "Vista previa de tu foto";
      preview.appendChild(img);
    }
  }
}

function initProfile() {
  const avatar = $("#profile-avatar");
  const photoInput = $("#profile-photo");
  const nameInput = $("#profile-name");
  const saveButton = $("#save-profile");
  const clearButton = $("#clear-profile");
  const status = $("#profile-status");

  avatar?.addEventListener("click", () => navigate("perfil"));

  photoInput?.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      if (status) status.textContent = "Elige un archivo de imagen válido.";
      photoInput.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      if (status) status.textContent = "La imagen debe pesar 2 MB o menos.";
      photoInput.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      profilePhotoData = String(reader.result || "");

      const preview = $("#profile-photo-preview");
      if (preview) {
  preview.querySelector("img")?.remove();

  if (profilePhotoData) {
    const img = document.createElement("img");
    img.src = profilePhotoData;
    img.alt = "Vista previa de tu foto";
    preview.appendChild(img);
  }
}

      if (status) status.textContent = "Foto lista. Guarda el perfil para conservarla.";
    };

    reader.readAsDataURL(file);
  });

  saveButton?.addEventListener("click", () => {
    const name = nameInput?.value.trim() || "";

    if (name.length > 40) {
      if (status) status.textContent = "El nombre debe tener 40 caracteres o menos.";
      return;
    }

    try {
      if (name) {
        localStorage.setItem(PROFILE_KEYS.name, name);
      } else {
        localStorage.removeItem(PROFILE_KEYS.name);
      }

      if (profilePhotoData) {
        localStorage.setItem(PROFILE_KEYS.photo, profilePhotoData);
      } else {
        localStorage.removeItem(PROFILE_KEYS.photo);
      }

      renderProfile();
      if (status) status.textContent = "¡Perfil guardado! ♡";
    } catch (error) {
      if (status) {
        status.textContent = "No se pudo guardar. Prueba con una imagen más pequeña.";
      }
    }
  });

  clearButton?.addEventListener("click", () => {
    if (!confirm("¿Quieres restablecer tu nombre y tu foto de perfil?")) return;

    localStorage.removeItem(PROFILE_KEYS.name);
    localStorage.removeItem(PROFILE_KEYS.photo);

    profilePhotoData = "";
    if (photoInput) photoInput.value = "";

    renderProfile();
    if (status) status.textContent = "Perfil restablecido.";
  });

  renderProfile();
}

initProfile();




/* ---------- Zen Space: temporizador ---------- */

(() => {
  const startButton = document.querySelector("#zen-start");
  const durationSelect = document.querySelector("#zen-duration");
  const customDuration = document.querySelector("#zen-custom-duration");
  const activitySelect = document.querySelector("#zen-activity");
  const customActivity = document.querySelector("#zen-custom-activity");

  const session = document.querySelector("#zen-session");
  const countdown = document.querySelector("#zen-countdown");
  const sessionTitle = document.querySelector("#zen-session-title");
  const sessionActivity = document.querySelector("#zen-session-activity");
  const sessionMessage = document.querySelector("#zen-session-message");
  const returnButton = document.querySelector("#zen-return");

  if (
    !startButton || !durationSelect || !customDuration ||
    !activitySelect || !session || !countdown
  ) return;

  let timerInterval = null;
  let endTime = 0;

  durationSelect.addEventListener("change", () => {
    customDuration.hidden = durationSelect.value !== "custom";
  });

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function finishSession() {
    clearInterval(timerInterval);
    timerInterval = null;

    countdown.textContent = "00:00";
    if (sessionTitle) sessionTitle.textContent = "Lo hiciste. ♡";
    if (returnButton) returnButton.hidden = false;
    if (sessionMessage) {
      sessionMessage.textContent = "Tu momento ha terminado. Gracias por dedicarte este tiempo.";
    }
  }

  function updateCountdown() {
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    countdown.textContent = formatTime(remaining);

    if (remaining <= 0) finishSession();
  }

  startButton.addEventListener("click", () => {
    let seconds;

    if (durationSelect.value === "custom") {
      const minutes = Number(document.querySelector("#zen-minutes")?.value || 0);
      const extraSeconds = Number(document.querySelector("#zen-seconds")?.value || 0);

      if (
        !Number.isInteger(minutes) ||
        !Number.isInteger(extraSeconds) ||
        minutes < 0 || minutes > 180 ||
        extraSeconds < 0 || extraSeconds > 59
      ) {
        alert("Elige una duración válida.");
        return;
      }

      seconds = minutes * 60 + extraSeconds;
    } else {
      seconds = Number(durationSelect.value);
    }

    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 10800) {
      alert("Elige una duración entre 1 segundo y 3 horas.");
      return;
    }

    const customName = customActivity?.value.trim();
    const activity = customName || activitySelect.value;

    clearInterval(timerInterval);

    if (sessionTitle) sessionTitle.textContent = "Es hora de cuidarte";
    if (sessionActivity) sessionActivity.textContent = activity;
    if (sessionMessage) {
      sessionMessage.textContent = "No necesitas hacer nada más. Solo estar aquí.";
    }

    countdown.textContent = formatTime(seconds);
    session.hidden = false;
    if (returnButton) returnButton.hidden = true;
    session.classList.add("is-running");

    if (typeof window.navigate === "function") {
      window.navigate("zen");
    }

    endTime = Date.now() + seconds * 1000;
    updateCountdown();
    timerInterval = setInterval(updateCountdown, 250);
  });
  returnButton?.addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = null;

  session.hidden = true;
  session.classList.remove("is-running");

  if (typeof window.navigate === "function") {
    window.navigate("habitos");
  }
});
})();
