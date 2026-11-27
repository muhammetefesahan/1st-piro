import { evaluateStudent } from "./core.js";

const form = document.querySelector("#grade-form");
const result = document.querySelector("#result");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const r = evaluateStudent(form.first.value, form.second.value);
    result.className = r.passed ? "pass" : "fail";
    result.textContent = `Ortalama: ${r.average} — ${r.status}`;
  } catch (error) {
    result.className = "fail";
    result.textContent = error.message;
  }
});
