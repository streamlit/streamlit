export { Vector } from "../vector";
export { BaseVector } from "./base";
export { BinaryVector } from "./binary";
export { BoolVector } from "./bool";
export { Chunked } from "./chunked";
export { DateVector, DateDayVector, DateMillisecondVector } from "./date";
export { DecimalVector } from "./decimal";
export { DictionaryVector } from "./dictionary";
export { FixedSizeBinaryVector } from "./fixedsizebinary";
export { FixedSizeListVector } from "./fixedsizelist";
export {
  FloatVector,
  Float16Vector,
  Float32Vector,
  Float64Vector
} from "./float";
export {
  IntervalVector,
  IntervalDayTimeVector,
  IntervalYearMonthVector
} from "./interval";
export {
  IntVector,
  Int8Vector,
  Int16Vector,
  Int32Vector,
  Int64Vector,
  Uint8Vector,
  Uint16Vector,
  Uint32Vector,
  Uint64Vector
} from "./int";
export { ListVector } from "./list";
export { MapVector } from "./map";
export { NullVector } from "./null";
export { StructVector } from "./struct";
export {
  TimestampVector,
  TimestampSecondVector,
  TimestampMillisecondVector,
  TimestampMicrosecondVector,
  TimestampNanosecondVector
} from "./timestamp";
export {
  TimeVector,
  TimeSecondVector,
  TimeMillisecondVector,
  TimeMicrosecondVector,
  TimeNanosecondVector
} from "./time";
export { UnionVector, DenseUnionVector, SparseUnionVector } from "./union";
export { Utf8Vector } from "./utf8";
export { MapRow, StructRow } from "./row";
import { Data } from "../data";
import { Vector } from "../vector";
import { DataType } from "../type";
import { IterableBuilderOptions } from "../builder";
import { VectorType as V, VectorCtorArgs } from "../interfaces";
declare module "../vector" {
  namespace Vector {
    export { newVector as new };
    export { vectorFrom as from };
  }
}
declare module "./base" {
  namespace BaseVector {
    export { vectorFrom as from };
  }
  interface BaseVector<T extends DataType> {
    get(index: number): T["TValue"] | null;
    set(index: number, value: T["TValue"] | null): void;
    indexOf(value: T["TValue"] | null, fromIndex?: number): number;
    toArray(): T["TArray"];
    getByteWidth(): number;
    [Symbol.iterator](): IterableIterator<T["TValue"] | null>;
  }
}
/** @ignore */
declare function newVector<T extends DataType>(
  data: Data<T>,
  ...args: VectorCtorArgs<V<T>>
): V<T>;
/** @ignore */
export interface VectorBuilderOptions<T extends DataType, TNull = any>
  extends IterableBuilderOptions<T, TNull> {
  values: Iterable<T["TValue"] | TNull>;
}
/** @ignore */
export interface VectorBuilderOptionsAsync<T extends DataType, TNull = any>
  extends IterableBuilderOptions<T, TNull> {
  values: AsyncIterable<T["TValue"] | TNull>;
}
/** @ignore */
export declare function vectorFromValuesWithType<
  T extends DataType,
  TNull = any
>(
  newDataType: () => T,
  input:
    | Iterable<T["TValue"] | TNull>
    | AsyncIterable<T["TValue"] | TNull>
    | VectorBuilderOptions<T, TNull>
    | VectorBuilderOptionsAsync<T, TNull>
): V<T> | Vector<T> | Promise<V<T>> | Promise<Vector<T>>;
/** @ignore */
declare function vectorFrom<T extends DataType = any, TNull = any>(
  input: VectorBuilderOptions<T, TNull>
): Vector<T>;
declare function vectorFrom<T extends DataType = any, TNull = any>(
  input: VectorBuilderOptionsAsync<T, TNull>
): Promise<Vector<T>>;
