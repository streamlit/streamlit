/** @ignore */
export declare function getBool(
  _data: any,
  _index: number,
  byte: number,
  bit: number
): boolean;
/** @ignore */
export declare function getBit(
  _data: any,
  _index: number,
  byte: number,
  bit: number
): 0 | 1;
/** @ignore */
export declare function setBool(
  bytes: Uint8Array,
  index: number,
  value: any
): boolean;
/** @ignore */
export declare function truncateBitmap(
  offset: number,
  length: number,
  bitmap: Uint8Array
): Uint8Array;
/** @ignore */
export declare function packBools(values: Iterable<any>): Uint8Array;
/** @ignore */
export declare function iterateBits<T>(
  bytes: Uint8Array,
  begin: number,
  length: number,
  context: any,
  get: (context: any, index: number, byte: number, bit: number) => T
): IterableIterator<T>;
/**
 * Compute the population count (the number of bits set to 1) for a range of bits in a Uint8Array.
 * @param vector The Uint8Array of bits for which to compute the population count.
 * @param lhs The range's left-hand side (or start) bit
 * @param rhs The range's right-hand side (or end) bit
 */
/** @ignore */
export declare function popcnt_bit_range(
  data: Uint8Array,
  lhs: number,
  rhs: number
): number;
/** @ignore */
export declare function popcnt_array(
  arr: ArrayBufferView,
  byteOffset?: number,
  byteLength?: number
): number;
/** @ignore */
export declare function popcnt_uint32(uint32: number): number;
