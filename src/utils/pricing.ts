// src/utils/pricing.ts

/**
 * How much cheaper a year of Pro is than 12 months, as a whole percent rounded down. Null
 * when it isn't cheaper, so the paywall never claims a saving that the prices don't give.
 */
export const yearlySaving = (monthly: number, yearly: number): number | null => {
  if (!(monthly > 0) || !(yearly > 0)) return null;
  const percent = Math.floor((1 - yearly / (monthly * 12)) * 100);
  return percent >= 1 ? percent : null;
};
