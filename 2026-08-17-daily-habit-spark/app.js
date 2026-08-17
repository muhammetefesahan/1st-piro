import { buildNudge, createHabit, removeHabit, summarizeHabits, toggleHabit } from "./core.js";

const storageKey = "daily-habit-spark:v1";
const form = document.querySelector("#habit-form");
const input = document.querySelector("#habit-input");
const list = document.querySelector("#habit-list");
const template = document.querySelector("#habit-template");
const sparkValue = document.querySelector("#spark-value");
const doneCount = document.querySelector("#done-count");
const completionRate = document.querySelector("#completion-rate");
const dailyNudge = document.querySelector("#daily-nudge");

let habits = loadHabits();

function loadHabits() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHabits() {
  localStorage.setItem(storageKey, JSON.stringify(habits));
}

function render() {
  const summary = summarizeHabits(habits);
  sparkValue.textContent = summary.sparkScore;
  doneCount.textContent = `${summary.done} tamam / ${summary.total} toplam`;
  completionRate.textContent = `${summary.completionRate}%`;
  dailyNudge.textContent = buildNudge(summary);

  list.replaceChildren();
  if (!habits.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "Henüz alışkanlık yok.";
    list.append(empty);
    saveHabits();
    return;
  }

  habits.forEach((habit) => {
    const item = template.content.firstElementChild.cloneNode(true);
    item.classList.toggle("is-done", habit.done);
    item.querySelector("h2").textContent = habit.text;
    item.querySelector("p").textContent = habit.done ? "Bugün tamamlandı." : "Bugünün kıvılcımı bekliyor.";

    const checkButton = item.querySelector(".check-button");
    checkButton.setAttribute("aria-pressed", String(habit.done));
    checkButton.addEventListener("click", () => {
      habits = toggleHabit(habits, habit.id);
      render();
    });

    item.querySelector(".remove-button").addEventListener("click", () => {
      habits = removeHabit(habits, habit.id);
      render();
    });

    list.append(item);
  });

  saveHabits();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    habits = [...habits, createHabit(input.value)];
    input.value = "";
    render();
  } catch (error) {
    input.setCustomValidity(error.message);
    input.reportValidity();
    input.setCustomValidity("");
  }
});

render();
