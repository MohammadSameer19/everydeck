import { describe, expect, it } from "vitest";
import {
  DECK_SIZE,
  LAST_INDEX,
  TOTAL,
  factorial,
  lehmerWeight,
} from "@/lib/factorials";

describe("factorials", () => {
  it("computes 0! through 12! exactly", () => {
    const expected = [
      1n,
      1n,
      2n,
      6n,
      24n,
      120n,
      720n,
      5040n,
      40320n,
      362880n,
      3628800n,
      39916800n,
      479001600n,
    ];
    for (let n = 0; n <= 12; n++) {
      expect(factorial(n), `n = ${n}`).toBe(expected[n]);
    }
  });

  it("is 52! — 68 digits, 226 bits", () => {
    expect(TOTAL.toString()).toBe(
      "80658175170943878571660636856403766975289505440883277824000000000000"
    );
    expect(TOTAL.toString().length).toBe(68);
    expect(TOTAL.toString(2).length).toBe(226);
    expect(LAST_INDEX).toBe(TOTAL - 1n);
  });

  it("has the property the module-load tripwire checks", () => {
    // If the hardcoded literal in factorials.ts ever drifts from the
    // computed value, importing the module throws. Reaching this test at
    // all means the tripwires did not fire.
    expect(factorial(DECK_SIZE)).toBe(TOTAL);
  });

  it("rejects out-of-domain n", () => {
    expect(() => factorial(-1)).toThrow(RangeError);
    expect(() => factorial(53)).toThrow(RangeError);
    expect(() => factorial(1.5)).toThrow(RangeError);
    expect(() => factorial(NaN)).toThrow(RangeError);
  });

  it("weighs position i by (51 - i)!", () => {
    expect(lehmerWeight(0)).toBe(51n * factorial(50));
    expect(lehmerWeight(50)).toBe(factorial(1));
    expect(lehmerWeight(51)).toBe(factorial(0));
    expect(() => lehmerWeight(52)).toThrow(RangeError);
  });

  it("exceeds what a double can represent — the reason everything is BigInt", () => {
    // This is the load-bearing assertion behind every BigInt in the
    // project: prove a lossy Number round-trip does NOT survive, so that
    // if any future code path ever coerced an index to Number, the
    // round-trip tests in deckMath would fail rather than silently pass.
    const k = LAST_INDEX;
    expect(BigInt(Number(k))).not.toBe(k);
    expect(Number.isSafeInteger(Number(k))).toBe(false);
  });
});
