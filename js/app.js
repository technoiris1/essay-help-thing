import { loadData, saveData } from "./storage.js";

const data = loadData();
let selectedUniversityId = null;
let selectedTopicId = null;

const $ = (id) => document.getElementById(id);
const elements = {
  universityList: $("university-list"),
  emptyUniversities: $("empty-universities"),
  emptySelection: $("empty-selection"),
  universityView: $("university-view"),
  selectedUniversityName: $("selected-university-name"),
  toggleComplete: $("toggle-complete"),
  topicList: $("topic-list"),
  emptyTopics: $("empty-topics"),
  fullscreenDialog: $("fullscreen-dialog"),
  fullscreenText: $("fullscreen-text"),
  fullscreenTopic: $("fullscreen-topic"),
  fullscreenCount: $("fullscreen-count"),
  fullscreenLimit: $("fullscreen-limit"),
  themeToggle: $("theme-toggle"),
  deadlineSummary: $("deadline-summary"),
  countdown: $("countdown"),
  countdownValue: $("countdown-value"),
  toggleTimer: $("toggle-timer"),
  deadlineDialog: $("deadline-dialog"),
  deadlineForm: $("deadline-form"),
  deadlineDate: $("edit-deadline-date"),
  deadlineTimezone: $("edit-deadline-timezone"),
  universityDialog: $("university-dialog"),
  universityForm: $("university-form"),
  universityName: $("university-name"),
  deadlineDateNew: $("deadline-date"),
  deadlineTimezoneNew: $("deadline-timezone"),
  topicDialog: $("topic-dialog"),
  topicForm: $("topic-form"),
  topicTitle: $("topic-title"),
  limitType: $("limit-type"),
  limit: $("limit"),
  printExport: $("print-export"),
};
let countdownInterval;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  elements.themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  elements.themeToggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
  localStorage.setItem("essay-desk-theme", theme);
}

function currentUniversity() {
  return data.universities.find((university) => university.id === selectedUniversityId);
}

function currentTopic() {
  return currentUniversity()?.topics.find((topic) => topic.id === selectedTopicId);
}

function persist() {
  saveData(data);
}

function makeId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function renderUniversities() {
  elements.universityList.replaceChildren();
  elements.emptyUniversities.hidden = data.universities.length > 0;
  data.universities.forEach((university) => {
    const button = document.createElement("button");
    button.className = `university-item${university.id === selectedUniversityId ? " active" : ""}${university.completed ? " completed" : ""}`;
    button.type = "button";
    button.innerHTML = `<span>${escapeHtml(university.name)}${university.completed ? '<small class="complete-label">Complete</small>' : ""}</span><small>${university.topics.length}</small>`;
    button.addEventListener("click", () => selectUniversity(university.id));
    elements.universityList.append(button);
  });
}

function renderSelectedUniversity() {
  clearInterval(countdownInterval);
  const university = currentUniversity();
  elements.emptySelection.hidden = Boolean(university);
  elements.universityView.hidden = !university;
  if (!university) return;

  elements.selectedUniversityName.textContent = university.name;
  elements.toggleComplete.textContent = university.completed ? "Mark incomplete" : "Mark complete";
  renderDeadline(university);
  elements.topicList.replaceChildren();
  elements.emptyTopics.hidden = university.topics.length > 0;
  university.topics.forEach((topic) => elements.topicList.append(createTopicCard(topic)));

  function deadlineDate(university) {
    if (!university.deadline?.date || !university.deadline?.timezone) return null;
    try {
      return zonedDateToUtc(university.deadline.date, university.deadline.timezone);
    } catch (error) {
      console.error("Could not read application deadline.", error);
      return null;
    }
  }

  function renderDeadline(university) {
    clearInterval(countdownInterval);
    elements.countdown.hidden = !university.timerRunning;
    elements.toggleTimer.disabled = !university.deadline;
    elements.toggleTimer.textContent = university.timerRunning ? "Stop timer" : "Run timer";
    if (!university.deadline) {
      elements.deadlineSummary.textContent = "No deadline set";
      return;
    }
    const date = deadlineDate(university);
    if (!date) return;
    elements.deadlineSummary.textContent = `${formatDeadline(university.deadline.date)} · ${timezoneLabel(university.deadline.timezone)}`;
    if (university.timerRunning) {
      updateCountdown(date);
      countdownInterval = setInterval(() => updateCountdown(date), 1000);
    }
  }

  function updateCountdown(date) {
    const milliseconds = date.getTime() - Date.now();
    const expired = milliseconds <= 0;
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    elements.countdownValue.textContent = expired ? "Deadline passed" : `${days}d ${hours}h ${minutes}m ${seconds}s`;
    elements.countdown.classList.toggle("expired", expired);
  }

  function formatDeadline(value) {
    const [date, time] = value.split("T");
    return `${date} at ${time}`;
  }

  function timezoneLabel(timezone) {
    return new Intl.DateTimeFormat("en", { timeZone: timezone, timeZoneName: "short" })
      .formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value ?? timezone;
  }

  function zonedDateToUtc(value, timezone) {
    const [datePart, timePart] = value.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    let timestamp = localAsUtc;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(new Date(timestamp));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      timestamp += localAsUtc - Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
    }
    return new Date(timestamp);
  }
}

function render() {
  renderUniversities();
  renderSelectedUniversity();
}

function selectUniversity(id) {
  selectedUniversityId = id;
  selectedTopicId = null;
  render();
  elements.universityView.scrollIntoView({ block: "start", behavior: "smooth" });
}

function selectTopic(id) {
  selectedTopicId = id;
  openFullscreenEditor();
}

function openUniversityDialog() {
  elements.universityForm.reset();
  elements.deadlineTimezoneNew.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  elements.universityDialog.showModal();
  elements.universityName.focus();
}

function openTopicDialog() {
  elements.topicForm.reset();
  elements.topicDialog.showModal();
  elements.topicTitle.focus();
}

function addUniversity(event) {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  const name = elements.universityName.value.trim();
  if (!name) return;
  const university = {
    id: makeId(),
    name,
    topics: [],
    completed: false,
    deadline: elements.deadlineDateNew.value ? {
      date: elements.deadlineDateNew.value,
      timezone: elements.deadlineTimezoneNew.value,
    } : null,
    timerRunning: false,
  };
  data.universities.push(university);
  selectedUniversityId = university.id;
  selectedTopicId = null;
  persist();
  elements.universityDialog.close();
  render();
}

function openDeadlineDialog() {
  const university = currentUniversity();
  if (!university) return;
  elements.deadlineDate.value = university.deadline?.date ?? "";
  elements.deadlineTimezone.value = university.deadline?.timezone ?? "UTC";
  elements.deadlineDialog.showModal();
}

function saveDeadline(event) {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  const university = currentUniversity();
  if (!university) return;
  university.deadline = {
    date: elements.deadlineDate.value,
    timezone: elements.deadlineTimezone.value,
  };
  university.timerRunning = false;
  persist();
  elements.deadlineDialog.close();
  render();
}

function toggleTimer() {
  const university = currentUniversity();
  if (!university?.deadline) return;
  university.timerRunning = !university.timerRunning;
  persist();
  render();
}

function addTopic(event) {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  const university = currentUniversity();
  const title = elements.topicTitle.value.trim();
  const limit = Number(elements.limit.value);
  if (!university || !title || !Number.isInteger(limit) || limit < 1) return;
  const topic = { id: makeId(), title, limitType: elements.limitType.value, limit, essay: "" };
  university.topics.push(topic);
  persist();
  elements.topicDialog.close();
  render();
}

function deleteUniversity() {
  const university = currentUniversity();
  if (!university || !confirm(`Delete ${university.name} and all its essays?`)) return;
  data.universities = data.universities.filter((item) => item.id !== university.id);
  selectedUniversityId = null;
  selectedTopicId = null;
  persist();
  render();
}

function toggleComplete() {
  const university = currentUniversity();
  if (!university) return;
  university.completed = !university.completed;
  persist();
  render();
}

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function getCountText(topic, text) {
  const words = countWords(text);
  const characters = text.length;
  const count = topic.limitType === "words" ? words : characters;
  return {
    summary: `${words.toLocaleString()} words · ${characters.toLocaleString()} characters`,
    limit: `${count.toLocaleString()} / ${topic.limit.toLocaleString()} ${topic.limitType}`,
    over: count > topic.limit,
  };
}

function updateTopicCount(topic, text, countElement, limitElement) {
  const count = getCountText(topic, text);
  countElement.textContent = count.summary;
  limitElement.textContent = count.limit;
  limitElement.classList.toggle("over", count.over);
}

function createTopicCard(topic) {
  const card = document.createElement("article");
  card.className = "topic-card";
  const heading = document.createElement("div");
  heading.className = "topic-card-heading";
  const details = document.createElement("div");
  details.innerHTML = `<h4>${escapeHtml(topic.title)}</h4><span class="topic-limit">${topic.limit.toLocaleString()} ${topic.limitType}</span>`;
  const fullscreenButton = document.createElement("button");
  fullscreenButton.className = "button button-quiet fullscreen-button";
  fullscreenButton.type = "button";
  fullscreenButton.textContent = "Fullscreen";
  fullscreenButton.addEventListener("click", () => {
    selectedTopicId = topic.id;
    openFullscreenEditor();
  });
  heading.append(details, fullscreenButton);
  const textarea = document.createElement("textarea");
  textarea.dataset.topicId = topic.id;
  textarea.value = topic.essay;
  textarea.placeholder = "Start writing here…";
  textarea.spellcheck = true;
  const footer = document.createElement("div");
  footer.className = "editor-footer";
  const countElement = document.createElement("span");
  const limitElement = document.createElement("span");
  footer.append(countElement, limitElement);
  textarea.addEventListener("input", () => {
    topic.essay = textarea.value;
    updateTopicCount(topic, textarea.value, countElement, limitElement);
    persist();
  });
  updateTopicCount(topic, textarea.value, countElement, limitElement);
  card.append(heading, textarea, footer);
  return card;
}

function openFullscreenEditor() {
  const topic = currentTopic();
  if (!topic) return;
  elements.fullscreenTopic.textContent = topic.title;
  elements.fullscreenText.value = topic.essay;
  updateFullscreenCount();
  elements.fullscreenDialog.showModal();
  elements.fullscreenText.focus();
}

function updateFullscreenCount() {
  const topic = currentTopic();
  if (!topic) return;
  const count = getCountText(topic, elements.fullscreenText.value);
  elements.fullscreenCount.textContent = count.summary;
  elements.fullscreenLimit.textContent = count.limit;
  elements.fullscreenLimit.classList.toggle("over", count.over);
}

function saveFullscreenEssay() {
  const topic = currentTopic();
  if (!topic) return;
  topic.essay = elements.fullscreenText.value;
  persist();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character]));
}

$("add-university").addEventListener("click", openUniversityDialog);
$("empty-add-university").addEventListener("click", openUniversityDialog);
$("add-topic").addEventListener("click", openTopicDialog);
$("delete-university").addEventListener("click", deleteUniversity);
$("toggle-complete").addEventListener("click", toggleComplete);
$("edit-deadline").addEventListener("click", openDeadlineDialog);
$("toggle-timer").addEventListener("click", toggleTimer);
$("theme-toggle").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
$("export-pdf").addEventListener("click", () => {
  const university = currentUniversity();
  if (!university) {
    alert("Select a university before exporting.");
    return;
  }
  elements.printExport.replaceChildren();
  const heading = document.createElement("h1");
  heading.textContent = university.name;
  elements.printExport.append(heading);
  university.topics.forEach((topic) => {
    const essaySection = document.createElement("section");
    essaySection.className = "print-essay";
    const topicHeading = document.createElement("h2");
    topicHeading.textContent = topic.title;
    const limit = document.createElement("p");
    limit.className = "print-limit";
    limit.textContent = `Limit: ${topic.limit.toLocaleString()} ${topic.limitType}`;
    const essay = document.createElement("p");
    essay.className = "print-essay-text";
    essay.textContent = topic.essay || "No essay written yet.";
    essaySection.append(topicHeading, limit, essay);
    elements.printExport.append(essaySection);
  });
  const originalTitle = document.title;
  document.title = `${university.name} - Essay Desk`;
  window.addEventListener("afterprint", () => {
    document.title = originalTitle;
    elements.printExport.replaceChildren();
  }, { once: true });
  window.print();
});
elements.universityForm.addEventListener("submit", addUniversity);
elements.topicForm.addEventListener("submit", addTopic);
elements.deadlineForm.addEventListener("submit", saveDeadline);
elements.fullscreenText.addEventListener("input", () => {
  saveFullscreenEssay();
  updateFullscreenCount();
  const topic = currentTopic();
  if (topic) {
    const textarea = elements.topicList.querySelector(`textarea[data-topic-id="${topic.id}"]`);
    if (textarea) textarea.value = topic.essay;
  }
});

applyTheme(localStorage.getItem("essay-desk-theme") === "dark" ? "dark" : "light");
if (data.universities.length > 0) selectedUniversityId = data.universities[0].id;
render();
