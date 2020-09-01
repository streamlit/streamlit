/** @ignore */
export declare class BaseInt64 {
  protected buffer: Uint32Array;
  constructor(buffer: Uint32Array);
  high(): number;
  low(): number;
  protected _times(other: BaseInt64): this;
  protected _plus(other: BaseInt64): void;
  lessThan(other: BaseInt64): boolean;
  equals(other: BaseInt64): boolean;
  greaterThan(other: BaseInt64): boolean;
  hex(): string;
}
/** @ignore */
export declare class Uint64 extends BaseInt64 {
  times(other: Uint64): Uint64;
  plus(other: Uint64): Uint64;
  /** @nocollapse */
  static from(val: any, out_buffer?: Uint32Array): Uint64;
  /** @nocollapse */
  static fromNumber(num: number, out_buffer?: Uint32Array): Uint64;
  /** @nocollapse */
  static fromString(str: string, out_buffer?: Uint32Array): Uint64;
  /** @nocollapse */
  static convertArray(values: (string | number)[]): Uint32Array;
  /** @nocollapse */
  static multiply(left: Uint64, right: Uint64): Uint64;
  /** @nocollapse */
  static add(left: Uint64, right: Uint64): Uint64;
}
/** @ignore */
export declare class Int64 extends BaseInt64 {
  negate(): Int64;
  times(other: Int64): Int64;
  plus(other: Int64): Int64;
  lessThan(other: Int64): boolean;
  /** @nocollapse */
  static from(val: any, out_buffer?: Uint32Array): Int64;
  /** @nocollapse */
  static fromNumber(num: number, out_buffer?: Uint32Array): Int64;
  /** @nocollapse */
  static fromString(str: string, out_buffer?: Uint32Array): Int64;
  /** @nocollapse */
  static convertArray(values: (string | number)[]): Uint32Array;
  /** @nocollapse */
  static multiply(left: Int64, right: Int64): Int64;
  /** @nocollapse */
  static add(left: Int64, right: Int64): Int64;
}
/** @ignore */
export declare class Int128 {
  private buffer;
  constructor(buffer: Uint32Array);
  high(): Int64;
  low(): Int64;
  negate(): Int128;
  times(other: Int128): Int128;
  plus(other: Int128): Int128;
  hex(): string;
  /** @nocollapse */
  static multiply(left: Int128, right: Int128): Int128;
  /** @nocollapse */
  static add(left: Int128, right: Int128): Int128;
  /** @nocollapse */
  static from(val: any, out_buffer?: Uint32Array): Int128;
  /** @nocollapse */
  static fromNumber(num: number, out_buffer?: Uint32Array): Int128;
  /** @nocollapse */
  static fromString(str: string, out_buffer?: Uint32Array): Int128;
  /** @nocollapse */
  static convertArray(values: (string | number)[]): Uint32Array;
}
