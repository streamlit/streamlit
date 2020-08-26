/** @ignore */
declare type RangeLike = {
  length: number;
  stride?: number;
};
/** @ignore */
declare type ClampThen<T extends RangeLike> = (
  source: T,
  index: number
) => any;
/** @ignore */
declare type ClampRangeThen<T extends RangeLike> = (
  source: T,
  offset: number,
  length: number
) => any;
export declare function clampIndex<T extends RangeLike>(
  source: T,
  index: number
): number;
export declare function clampIndex<
  T extends RangeLike,
  N extends ClampThen<T> = ClampThen<T>
>(source: T, index: number, then: N): ReturnType<N>;
export declare function clampRange<T extends RangeLike>(
  source: T,
  begin: number | undefined,
  end: number | undefined
): [number, number];
export declare function clampRange<
  T extends RangeLike,
  N extends ClampRangeThen<T> = ClampRangeThen<T>
>(
  source: T,
  begin: number | undefined,
  end: number | undefined,
  then: N
): ReturnType<N>;
/** @ignore */
export declare function createElementComparator(
  search: any
): (value: any) => boolean;
export {};
