/** Display formatting. Kept out of the math core so it can stay pure. */

/** 1234567 -> "1,234,567" */
export function formatIndex(index: bigint): string {
  const digits = index.toString();
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return out;
}

/** Strip grouping from user input: "1,234 567" -> "1234567" */
export function stripGrouping(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

/**
 * "8.07e+67" — for showing how absurd the number is without 68 digits.
 *
 * Keeps two decimal places, so the mantissa stays a real fraction rather
 * than the misleading three leading digits of an integer ("806e+52").
 */
export function formatScientific(value: bigint, decimals = 2): string {
  const s = value.toString();
  if (s.length <= decimals + 1) return s;

  const exponent = s.length - 1;
  const scaled = Number(`${s.slice(0, decimals + 1)}.0`) / 100;
  return `${scaled.toFixed(decimals).replace(/\.?0+$/, "")}e+${exponent}`;
}

/** Parse user-typed digits into a BigInt. Returns null on anything non-numeric. */
export function parseIndexInput(input: string): bigint | null {
  const digits = stripGrouping(input);
  if (digits.length === 0) return null;
  try {
    return BigInt(digits);
  } catch {
    return null;
  }
}

/** "8.07e+67 arrangements" */
export function pluralize(
  value: bigint,
  singular: string,
  plural = `${singular}s`
): string {
  return `${formatScientific(value)} ${value === 1n ? singular : plural}`;
}
