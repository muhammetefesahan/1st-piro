export function normalizeHabitText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

export function createHabit(text, createdAt = new Date().toISOString()) {
  const normalizedText = normalizeHabitText(text);
  if (!normalizedText) {
    throw new Error("Alışkanlık adı boş olamaz.");
  }

  return {
    id: `${Date.parse(createdAt)}-${normalizedText.toLowerCase().replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, "-")}`,
    text: normalizedText,
    done: false,
    createdAt,
  };
}

export function toggleHabit(habits, id) {
  return habits.map((habit) => habit.id === id ? { ...habit, done: !habit.done } : habit);
}

export function removeHabit(habits, id) {
  return habits.filter((habit) => habit.id !== id);
}

export function summarizeHabits(habits) {
  const total = habits.length;
  const done = habits.filter((habit) => habit.done).length;
  const completionRate = total ? Math.round((done / total) * 100) : 0;
  const sparkScore = done * 12 + Math.max(0, total - done) * 3 + (total && done === total ? 10 : 0);
  const nextHabit = habits.find((habit) => !habit.done) ?? null;

  return {
    total,
    done,
    pending: total - done,
    completionRate,
    sparkScore,
    nextHabit,
  };
}

export function buildNudge(summary) {
  if (!summary.total) return "Bugün başlamak için küçük bir alışkanlık ekle.";
  if (!summary.pending) return "Tüm kıvılcımlar yanıyor; zinciri yarın da koru.";
  return `${summary.nextHabit.text} için iki dakikalık ilk adımı seç.`;
}
