const STORAGE_KEY = "appointment-calendar-items";
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

const state = {
  appointments: loadAppointments(),
  visibleDate: new Date(),
  selectedDate: toDateKey(new Date()),
};

const elements = {
  calendarGrid: document.querySelector("#calendar-grid"),
  clientName: document.querySelector("#client-name"),
  clientSummary: document.querySelector("#client-summary"),
  currentMonth: document.querySelector("#current-month"),
  form: document.querySelector("#appointment-form"),
  monthlyTotal: document.querySelector("#monthly-total"),
  notes: document.querySelector("#appointment-notes"),
  selectedDayLabel: document.querySelector("#selected-day-label"),
  selectedDayList: document.querySelector("#selected-day-list"),
  template: document.querySelector("#appointment-template"),
  date: document.querySelector("#appointment-date"),
  time: document.querySelector("#appointment-time"),
};

document.querySelector("#previous-month").addEventListener("click", () => moveMonth(-1));
document.querySelector("#next-month").addEventListener("click", () => moveMonth(1));
elements.form.addEventListener("submit", addAppointment);

elements.date.value = state.selectedDate;
elements.time.value = "09:00";
render();

function addAppointment(event) {
  event.preventDefault();

  const appointment = {
    id: crypto.randomUUID(),
    client: elements.clientName.value.trim(),
    date: elements.date.value,
    time: elements.time.value,
    notes: elements.notes.value.trim(),
  };

  state.appointments.push(appointment);
  state.selectedDate = appointment.date;
  state.visibleDate = parseDateKey(appointment.date);
  saveAppointments();
  elements.form.reset();
  elements.date.value = state.selectedDate;
  elements.time.value = appointment.time;
  render();
}

function deleteAppointment(id) {
  state.appointments = state.appointments.filter((appointment) => appointment.id !== id);
  saveAppointments();
  render();
}

function moveMonth(offset) {
  state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() + offset, 1);
  state.selectedDate = toDateKey(state.visibleDate);
  elements.date.value = state.selectedDate;
  render();
}

function render() {
  const monthAppointments = getMonthAppointments();
  elements.currentMonth.textContent = dateFormatter.format(state.visibleDate);
  elements.monthlyTotal.textContent = monthAppointments.length;
  renderCalendar(monthAppointments);
  renderClientSummary(monthAppointments);
  renderSelectedDay();
}

function renderCalendar(monthAppointments) {
  elements.calendarGrid.innerHTML = "";

  for (const date of getCalendarDates(state.visibleDate)) {
    const dateKey = toDateKey(date);
    const dayAppointments = monthAppointments.filter((appointment) => appointment.date === dateKey);
    const button = document.createElement("button");
    button.className = "day";
    button.type = "button";
    button.setAttribute("aria-label", `${dayFormatter.format(date)}: ${dayAppointments.length} appointments`);

    if (date.getMonth() !== state.visibleDate.getMonth()) {
      button.classList.add("outside-month");
    }

    if (dateKey === state.selectedDate) {
      button.classList.add("selected");
    }

    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = date.getDate();

    if (dayAppointments.length) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = dayAppointments.length;
      dayNumber.append(badge);
    }

    const dayClients = document.createElement("span");
    dayClients.className = "day-clients";
    appendDayClientPreview(dayClients, dayAppointments);
    button.append(dayNumber, dayClients);
    button.addEventListener("click", () => {
      state.selectedDate = dateKey;
      elements.date.value = dateKey;
      render();
    });
    elements.calendarGrid.append(button);
  }
}

function renderClientSummary(monthAppointments) {
  const countsByClient = monthAppointments.reduce((counts, appointment) => {
    counts.set(appointment.client, (counts.get(appointment.client) ?? 0) + 1);
    return counts;
  }, new Map());

  elements.clientSummary.innerHTML = "";

  if (!countsByClient.size) {
    elements.clientSummary.innerHTML = '<li class="empty-state">No appointments this month yet.</li>';
    return;
  }

  [...countsByClient.entries()]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .forEach(([client, count]) => {
      const item = document.createElement("li");
      const clientName = document.createElement("span");
      const clientCount = document.createElement("strong");
      clientName.textContent = client;
      clientCount.textContent = count;
      item.append(clientName, clientCount);
      elements.clientSummary.append(item);
    });
}

function renderSelectedDay() {
  const selectedDate = parseDateKey(state.selectedDate);
  const appointments = state.appointments
    .filter((appointment) => appointment.date === state.selectedDate)
    .sort((first, second) => first.time.localeCompare(second.time));

  elements.selectedDayLabel.textContent = dayFormatter.format(selectedDate);
  elements.selectedDayList.innerHTML = "";

  if (!appointments.length) {
    elements.selectedDayList.innerHTML = '<li class="empty-state">No appointments scheduled for this day.</li>';
    return;
  }

  appointments.forEach((appointment) => {
    const item = elements.template.content.firstElementChild.cloneNode(true);
    item.querySelector(".appointment-client").textContent = appointment.client;
    item.querySelector(".appointment-meta").textContent = timeFormatter.format(new Date(`${appointment.date}T${appointment.time}`));
    item.querySelector(".appointment-notes").textContent = appointment.notes;
    item.querySelector(".appointment-notes").hidden = !appointment.notes;
    item.querySelector(".delete-appointment").addEventListener("click", () => deleteAppointment(appointment.id));
    elements.selectedDayList.append(item);
  });
}

function getMonthAppointments() {
  const year = state.visibleDate.getFullYear();
  const month = state.visibleDate.getMonth();
  return state.appointments.filter((appointment) => {
    const appointmentDate = parseDateKey(appointment.date);
    return appointmentDate.getFullYear() === year && appointmentDate.getMonth() === month;
  });
}

function getCalendarDates(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstCalendarDate = new Date(year, month, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    return new Date(firstCalendarDate.getFullYear(), firstCalendarDate.getMonth(), firstCalendarDate.getDate() + index);
  });
}

function appendDayClientPreview(container, dayAppointments) {
  dayAppointments.slice(0, 3).forEach((appointment) => {
    const preview = document.createElement("span");
    preview.textContent = `${appointment.time} · ${appointment.client}`;
    container.append(preview);
  });
}

function loadAppointments() {
  const savedAppointments = localStorage.getItem(STORAGE_KEY);
  if (savedAppointments) {
    return JSON.parse(savedAppointments);
  }

  const today = toDateKey(new Date());
  return [
    { id: crypto.randomUUID(), client: "Sample Client", date: today, time: "09:00", notes: "Edit or delete this starter appointment." },
  ];
}

function saveAppointments() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.appointments));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}
