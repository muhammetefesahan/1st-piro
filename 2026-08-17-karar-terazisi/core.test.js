import test from "node:test";
import assert from "node:assert/strict";
import { calculateDecision } from "./core.js";

test("ağırlıkları normalize edip kazananı bulur", () => {
  const result = calculateDecision(
    [{ name: "Fiyat", weight: 2 }, { name: "Kalite", weight: 1 }],
    [9, 3],
    [3, 9],
  );
  assert.equal(result.winner, "a");
  assert.equal(result.scoreA, 7);
  assert.equal(result.scoreB, 5);
});

test("eşitliği doğru bildirir", () => {
  const result = calculateDecision([{ name: "Hız", weight: 1 }], [5], [5]);
  assert.equal(result.winner, "tie");
  assert.equal(result.sensitivity, null);
});

test("sonucu değiştirebilecek en küçük ağırlık kaymasını bulur", () => {
  const result = calculateDecision(
    [{ name: "Fiyat", weight: 60 }, { name: "Konfor", weight: 40 }],
    [8, 4],
    [4, 8],
  );
  assert.equal(result.sensitivity.name, "Fiyat");
  assert.ok(Math.abs(result.sensitivity.change + 10) < 1e-9);
});

test("geçersiz girdileri reddeder", () => {
  assert.throws(() => calculateDecision([], [], []), /eşleşmelidir/);
  assert.throws(() => calculateDecision([{ name: "Fiyat", weight: 0 }], [1], [2]), /sıfırdan büyük/);
});
