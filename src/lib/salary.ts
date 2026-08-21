interface ParsedSalary {
  min: number;
  max: number;
  period: "year" | "hour";
}

function parseSalary(text: string | null): ParsedSalary | null {
  if (!text) return null;
  const period = /hour/i.test(text) ? "hour" : /year/i.test(text) ? "year" : null;
  if (!period) return null;

  const numbers = text.match(/[\d,]+(\.\d+)?/g);
  if (!numbers || numbers.length === 0) return null;

  const values = numbers.map((n) => parseFloat(n.replace(/,/g, "")));
  return { min: Math.min(...values), max: Math.max(...values), period };
}

// A job "meets the bar" if the TOP of its listed range reaches your floor —
// not the bottom. Employers often post a wide/lowballed range; if the top
// end clears your minimum, it's still worth a look. Jobs with no salary
// listed at all are NOT excluded (can't judge what isn't shown).
export function meetsMinSalary(
  salaryText: string | null,
  minSalary: { annual: number; hourly: number }
): boolean {
  const parsed = parseSalary(salaryText);
  if (!parsed) return true;
  const threshold = parsed.period === "hour" ? minSalary.hourly : minSalary.annual;
  return parsed.max >= threshold;
}
