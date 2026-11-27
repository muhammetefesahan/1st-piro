export const PASS_THRESHOLD = 60;

export function parseGrade(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (text === "") throw new Error("Not boş olamaz.");
  const grade = Number(text);
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) {
    throw new Error("Not 0 ile 100 arasında olmalı.");
  }
  return grade;
}

export function evaluateStudent(firstExam, secondExam) {
  const first = parseGrade(firstExam);
  const second = parseGrade(secondExam);
  const average = Math.round(((first + second) / 2) * 100) / 100;
  const passed = average >= PASS_THRESHOLD;
  return { first, second, average, passed, status: passed ? "Geçti" : "Kaldı" };
}
