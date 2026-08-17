import { calculateDecision } from "./core.js";

const criteriaNode = document.querySelector("#criteria");
const presets = [
  { name: "Maliyet", weight: 35, a: 8, b: 5 },
  { name: "Konfor", weight: 25, a: 6, b: 9 },
  { name: "Dayanıklılık", weight: 40, a: 9, b: 6 },
];

function createLabeledInput(labelText, field, item, inputType = "text") {
  const label = document.createElement("label");
  label.append(labelText);

  const input = document.createElement("input");
  input.dataset.field = field;
  input.type = inputType;
  input.value = item[field];
  label.append(input);

  return label;
}

function addCriterion(item = { name: "Yeni kriter", weight: 20, a: 5, b: 5 }) {
  const row = document.createElement("div");
  row.className = "criterion";

  const nameLabel = createLabeledInput("Kriter", "name", item);
  nameLabel.querySelector("input").maxLength = 28;

  const weightLabel = createLabeledInput("Ağırlık", "weight", item, "number");
  weightLabel.querySelector("input").min = 0;
  weightLabel.querySelector("input").max = 100;

  const optionALabel = createLabeledInput("A puanı", "a", item, "number");
  optionALabel.querySelector("input").min = 1;
  optionALabel.querySelector("input").max = 10;

  const optionBLabel = createLabeledInput("B puanı", "b", item, "number");
  optionBLabel.querySelector("input").min = 1;
  optionBLabel.querySelector("input").max = 10;

  const removeButton = document.createElement("button");
  removeButton.className = "remove";
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", "Kriteri kaldır");
  removeButton.textContent = "×";
  removeButton.addEventListener("click", () => {
    row.remove();
    render();
  });

  row.append(nameLabel, weightLabel, optionALabel, optionBLabel, removeButton);
  row.addEventListener("input", render);
  criteriaNode.append(row);
}

function render() {
  const rows = [...document.querySelectorAll(".criterion")];
  try {
    const criteria = rows.map((row) => ({ name: row.querySelector('[data-field="name"]').value, weight: row.querySelector('[data-field="weight"]').value }));
    const a = rows.map((row) => row.querySelector('[data-field="a"]').value);
    const b = rows.map((row) => row.querySelector('[data-field="b"]').value);
    const result = calculateDecision(criteria, a, b);
    const nameA = document.querySelector("#name-a").value || "A seçeneği";
    const nameB = document.querySelector("#name-b").value || "B seçeneği";
    const winner = result.winner === "tie" ? "Karar başa baş." : `${result.winner === "a" ? nameA : nameB} önde.`;
    document.querySelector("#winner").textContent = winner;
    document.querySelector("#score-a").textContent = `${nameA}: ${result.scoreA.toFixed(2)}`;
    document.querySelector("#score-b").textContent = `${nameB}: ${result.scoreB.toFixed(2)}`;
    document.querySelector("#meter-fill").style.width = `${Math.max(0, Math.min(100, 50 + (result.scoreA - result.scoreB) * 5))}%`;
    document.querySelector("#insight").textContent = result.sensitivity
      ? `${result.sensitivity.name} ağırlığını ${Math.abs(result.sensitivity.change).toFixed(1)} puan ${result.sensitivity.change > 0 ? "artırmak" : "azaltmak"} sonucu değiştirebilir. Kararın bu kritere hassas.`
      : "Mevcut aralıkta tek bir kriter ağırlığı değişimi sonucu çevirmiyor; kararın görece sağlam.";
  } catch (error) {
    document.querySelector("#winner").textContent = "Biraz daha bilgi gerekli.";
    document.querySelector("#insight").textContent = error.message;
  }
}

presets.forEach(addCriterion);
document.querySelector("#add").addEventListener("click", () => { addCriterion(); render(); });
document.querySelectorAll("#name-a, #name-b").forEach((input) => input.addEventListener("input", render));
render();
