const dayjs = require('dayjs');

// Tinh khau hao theo phuong phap duong thang (chuan pho bien nhat trong ke toan VN)
// Tra ve: { monthlyDepreciation, monthsElapsed, accumulatedDepreciation, remainingValue }
function calcDepreciation(purchaseCost, purchaseDate, depreciationMonths) {
  const cost = purchaseCost || 0;
  const months = depreciationMonths || 36;
  if (!purchaseDate || cost <= 0 || months <= 0) {
    return { monthlyDepreciation: 0, monthsElapsed: 0, accumulatedDepreciation: 0, remainingValue: cost };
  }
  const monthlyDepreciation = cost / months;
  const monthsElapsed = Math.max(0, dayjs().diff(dayjs(purchaseDate), 'month'));
  const accumulatedDepreciation = Math.min(cost, monthlyDepreciation * monthsElapsed);
  const remainingValue = Math.max(0, cost - accumulatedDepreciation);
  return {
    monthlyDepreciation: Math.round(monthlyDepreciation),
    monthsElapsed,
    accumulatedDepreciation: Math.round(accumulatedDepreciation),
    remainingValue: Math.round(remainingValue),
  };
}

module.exports = { calcDepreciation };
