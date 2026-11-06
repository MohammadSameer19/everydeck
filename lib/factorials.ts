/**
 * Exact factorial arithmetic for the permutation address space.
 *
 * 52! = 80658175170943878571660636856403766975289505440883277824000000000000
 *     = 68 decimal digits = 226 bits
 *
 * That is far past Number.MAX_SAFE_INTEGER (2^53), so every value in this
 * module is a BigInt and must stay one. See {@link TOTAL}.
 */

export const DECK_SIZE = 52;

/** FACTORIALS[n] === n! as a BigInt, for n in [0, 52]. */
const FACTORIALS: readonly bigint[] = (() => {
  const table: bigint[] = [1n]; // 0!
  for (let n = 1; n <= DECK_SIZE; n++) {
    table.push((table[n - 1] as bigint) * BigInt(n));
  }
  return table;
})();

/** n! as an exact BigInt. Throws if n is not an integer in [0, 52]. */
export function factorial(n: number): bigint {
  if (!Number.isInteger(n) || n < 0 || n > DECK_SIZE) {
    throw new RangeError(
      `factorial: n must be an integer in [0, ${DECK_SIZE}], got ${n}`
    );
  }
  return FACTORIALS[n] as bigint;
}

/** The whole address space: 52!. Valid indices are [0, TOTAL). */
export const TOTAL: bigint = FACTORIALS[DECK_SIZE] as bigint;

/** TOTAL - 1, the last addressable index. Useful as an upper clamp. */
export const LAST_INDEX: bigint = TOTAL - 1n;

/** The weight of position i in the Lehmer code: (51 - i)!. */
export function lehmerWeight(i: number): bigint {
  if (!Number.isInteger(i) || i < 0 || i >= DECK_SIZE) {
    throw new RangeError(
      `lehmerWeight: i must be an integer in [0, ${DECK_SIZE - 1}], got ${i}`
    );
  }
  return FACTORIALS[DECK_SIZE - 1 - i] as bigint;
}

// --- Module-load tripwires -------------------------------------------------
// These run once on import. They cannot "fail" a test run gracefully — if
// any of them throw, the whole application is dead on arrival, which is
// exactly the intended outcome. A wrong constant here means every link
// ever shared points at the wrong deck, and we want that loudly.

if (factorial(52) !== TOTAL) {
  throw new Error("factorials: 52! disagrees with TOTAL");
}

const TOTAL_LITERAL =
  80_658_175_170_943_878_571_660_636_856_403_766_975_289_505_440_883_277_824_000_000_000_000n;

if (TOTAL !== TOTAL_LITERAL) {
  throw new Error(
    `factorials: TOTAL drift detected. Computed ${TOTAL}, expected ${TOTAL_LITERAL}`
  );
}

if (TOTAL.toString().length !== 68) {
  throw new Error("factorials: TOTAL should be a 68-digit number");
}
