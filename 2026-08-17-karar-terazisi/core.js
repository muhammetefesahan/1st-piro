export function calculateDecision(criteria, optionA, optionB) {
  if (!criteria.length || criteria.length !== optionA.length || optionA.length !== optionB.length) {
    throw new Error("Kriterler ve puanlar eşleşmelidir.");
  }

  const totalWeight = criteria.reduce((sum, item) => sum + Number(item.weight), 0);
  if (totalWeight <= 0) throw new Error("Toplam ağırlık sıfırdan büyük olmalıdır.");

  const normalized = criteria.map((item) => ({
    name: item.name,
    weight: Number(item.weight) / totalWeight,
  }));
  const score = (values) => normalized.reduce((sum, item, index) => sum + item.weight * Number(values[index]), 0);
  const scoreA = score(optionA);
  const scoreB = score(optionB);
  const winner = Math.abs(scoreA - scoreB) < 1e-9 ? "tie" : scoreA > scoreB ? "a" : "b";

  const sensitivity = normalized
    .map((item, index) => {
      const difference = Number(optionA[index]) - Number(optionB[index]);
      if (winner === "tie" || item.weight >= 1) return null;
      const otherDifference = normalized.reduce((sum, other, otherIndex) => {
        if (otherIndex === index) return sum;
        const shareAmongOthers = other.weight / (1 - item.weight);
        return sum + shareAmongOthers * (Number(optionA[otherIndex]) - Number(optionB[otherIndex]));
      }, 0);
      const denominator = difference - otherDifference;
      if (!denominator) return null;
      const targetWeight = -otherDifference / denominator;
      if (targetWeight < 0 || targetWeight > 1) return null;
      const requiredShift = targetWeight - item.weight;
      return { name: item.name, change: requiredShift * 100, target: targetWeight * 100 };
    })
    .filter(Boolean)
    .sort((left, right) => Math.abs(left.change) - Math.abs(right.change))[0] ?? null;

  return { scoreA, scoreB, winner, sensitivity };
}
