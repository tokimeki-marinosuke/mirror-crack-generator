/** Mulberry32。安全な整数を uint32 に正規化し、毎回新しい乱数系列を返す。 */
export function createRandom(seed: number): () => number {
  if (!Number.isSafeInteger(seed)) throw new Error('シードは安全な整数で指定してください。');
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
