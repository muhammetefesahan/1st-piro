import test from "node:test";
import assert from "node:assert/strict";
import { buildNudge, createHabit, removeHabit, summarizeHabits, toggleHabit } from "./core.js";

test("alışkanlık metnini temizleyip kayıt oluşturur", () => {
  const habit = createHabit("  Su   iç  ", "2026-08-17T12:00:00.000Z");
  assert.equal(habit.text, "Su iç");
  assert.equal(habit.done, false);
  assert.match(habit.id, /^1786968000000-/);
});

test("alışkanlığı id üzerinden tamamlandı durumuna çevirir", () => {
  const habits = [createHabit("Okuma", "2026-08-17T12:00:00.000Z")];
  const toggled = toggleHabit(habits, habits[0].id);
  assert.equal(toggled[0].done, true);
  assert.equal(habits[0].done, false);
});

test("özet ve kıvılcım puanını hesaplar", () => {
  const first = { ...createHabit("Yürüyüş", "2026-08-17T12:00:00.000Z"), done: true };
  const second = createHabit("Esneme", "2026-08-17T13:00:00.000Z");
  const summary = summarizeHabits([first, second]);
  assert.equal(summary.done, 1);
  assert.equal(summary.pending, 1);
  assert.equal(summary.completionRate, 50);
  assert.equal(summary.sparkScore, 15);
  assert.equal(summary.nextHabit.text, "Esneme");
});

test("boş, bitmiş ve açık listeler için öneri üretir", () => {
  assert.equal(buildNudge(summarizeHabits([])), "Bugün başlamak için küçük bir alışkanlık ekle.");

  const completed = { ...createHabit("Nefes", "2026-08-17T12:00:00.000Z"), done: true };
  assert.equal(buildNudge(summarizeHabits([completed])), "Tüm kıvılcımlar yanıyor; zinciri yarın da koru.");

  const pending = createHabit("Defter", "2026-08-17T13:00:00.000Z");
  assert.equal(buildNudge(summarizeHabits([pending])), "Defter için iki dakikalık ilk adımı seç.");
});

test("silme işlemi sadece hedef alışkanlığı kaldırır", () => {
  const first = createHabit("Uyku", "2026-08-17T12:00:00.000Z");
  const second = createHabit("Okuma", "2026-08-17T13:00:00.000Z");
  assert.deepEqual(removeHabit([first, second], first.id), [second]);
});

test("boş alışkanlık adını reddeder", () => {
  assert.throws(() => createHabit("   "), /boş olamaz/);
});
