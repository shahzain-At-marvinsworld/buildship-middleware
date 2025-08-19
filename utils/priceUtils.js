exports.parsePriceConditionAdvance = (priceLabel) => {
  if (!priceLabel || typeof priceLabel !== 'string') return null;

  const value = priceLabel.toLowerCase();

  // Map fuzzy terms to max price thresholds
  const priceMap = {
    cheap: 10,
    budget: 12,
    low: 15,
    value: 18,
    mid: 25,
    midrange: 30,
    standard: 35,
    decent: 40,
    premium: 60,
    luxury: 100,
    high: 100,
    expensive: 150,
  };

  if (!isNaN(parseFloat(value))) {
    return parseFloat(value); // direct price
  }

  return priceMap[value] || null;
};

export function parsePriceConditionBasic (priceStr) {
  const match = priceStr.match(/under\s*\$\s*(\d+)/i);
  return match ? parseFloat(match[1]) : null;
}
