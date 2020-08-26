import { FixedWidthBuilder } from "../builder";
import { Float, Float16, Float32, Float64 } from "../type";
/** @ignore */
export declare class FloatBuilder<
  T extends Float = Float,
  TNull = any
> extends FixedWidthBuilder<T, TNull> {}
/** @ignore */
export declare class Float16Builder<TNull = any> extends FloatBuilder<
  Float16,
  TNull
> {
  setValue(index: number, value: number): void;
}
/** @ignore */
export declare class Float32Builder<TNull = any> extends FloatBuilder<
  Float32,
  TNull
> {
  setValue(index: number, value: number): void;
}
/** @ignore */
export declare class Float64Builder<TNull = any> extends FloatBuilder<
  Float64,
  TNull
> {
  setValue(index: number, value: number): void;
}
