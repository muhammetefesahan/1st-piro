import test from "node:test";
import assert from "node:assert/strict";
import { evaluateStudent, parseGrade } from "./core.js";

test("ortalama 60 ve üzeriyse geçti", () => {
  assert.deepEqual(evaluateStudent(50, 70), { first: 50, second: 70, average: 60, passed: true, status: "Geçti" });
  assert.equal(evaluateStudent(90, 80).status, "Geçti");
});

test("ortalama 60'ın altındaysa kaldı", () => {
  const result = evaluateStudent(59, 60);
  assert.equal(result.average, 59.5);
  assert.equal(result.status, "Kaldı");
});

test("virgüllü ve metin notları kabul eder", () => {
  assert.equal(parseGrade("72,5"), 72.5);
  assert.equal(evaluateStudent("60", "60").status, "Geçti");
});

test("geçersiz notları reddeder", () => {
  assert.throws(() => parseGrade(""), /boş/);
  assert.throws(() => parseGrade("abc"), /0 ile 100/);
  assert.throws(() => parseGrade(101), /0 ile 100/);
  assert.throws(() => parseGrade(-1), /0 ile 100/);
});
