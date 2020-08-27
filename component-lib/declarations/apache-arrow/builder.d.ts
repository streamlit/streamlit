import { Data } from "./data";
import { BuilderType as B, VectorType as V } from "./interfaces";
import {
  BufferBuilder,
  BitmapBufferBuilder,
  DataBufferBuilder,
  OffsetsBufferBuilder
} from "./builder/buffer";
import {
  DataType,
  Float,
  Int,
  Decimal,
  FixedSizeBinary,
  Date_,
  Time,
  Timestamp,
  Interval,
  Utf8,
  Binary,
  List,
  Map_
} from "./type";
/**
 * A set of options required to create a `Builder` instance for a given `DataType`.
 * @see {@link Builder}
 */
export interface BuilderOptions<T extends DataType = any, TNull = any> {
  type: T;
  nullValues?: TNull[] | ReadonlyArray<TNull> | null;
  children?:
    | {
        [key: string]: BuilderOptions;
      }
    | BuilderOptions[];
}
/**
 * A set of options to create an Iterable or AsyncIterable `Builder` transform function.
 * @see {@link Builder.throughIterable}
 * @see {@link Builder.throughAsyncIterable}
 */
export interface IterableBuilderOptions<T extends DataType = any, TNull = any>
  extends BuilderOptions<T, TNull> {
  highWaterMark?: number;
  queueingStrategy?: "bytes" | "count";
  dictionaryHashFunction?: (value: any) => string | number;
  valueToChildTypeId?: (
    builder: Builder<T, TNull>,
    value: any,
    offset: number
  ) => number;
}
/**
 * An abstract base class for types that construct Arrow Vectors from arbitrary JavaScript values.
 *
 * A `Builder` is responsible for writing arbitrary JavaScript values
 * to ArrayBuffers and/or child Builders according to the Arrow specification
 * for each DataType, creating or resizing the underlying ArrayBuffers as necessary.
 *
 * The `Builder` for each Arrow `DataType` handles converting and appending
 * values for a given `DataType`. The high-level {@link Builder.new `Builder.new()`} convenience
 * method creates the specific `Builder` subclass for the supplied `DataType`.
 *
 * Once created, `Builder` instances support both appending values to the end
 * of the `Builder`, and random-access writes to specific indices
 * (`Builder.prototype.append(value)` is a convenience method for
 * `builder.set(builder.length, value)`). Appending or setting values beyond the
 * Builder's current length may cause the builder to grow its underlying buffers
 * or child Builders (if applicable) to accommodate the new values.
 *
 * After enough values have been written to a `Builder`, `Builder.prototype.flush()`
 * will commit the values to the underlying ArrayBuffers (or child Builders). The
 * internal Builder state will be reset, and an instance of `Data<T>` is returned.
 * Alternatively, `Builder.prototype.toVector()` will flush the `Builder` and return
 * an instance of `Vector<T>` instead.
 *
 * When there are no more values to write, use `Builder.prototype.finish()` to
 * finalize the `Builder`. This does not reset the internal state, so it is
 * necessary to call `Builder.prototype.flush()` or `toVector()` one last time
 * if there are still values queued to be flushed.
 *
 * Note: calling `Builder.prototype.finish()` is required when using a `DictionaryBuilder`,
 * because this is when it flushes the values that have been enqueued in its internal
 * dictionary's `Builder`, and creates the `dictionaryVector` for the `Dictionary` `DataType`.
 *
 * ```ts
 * import { Builder, Utf8 } from 'apache-arrow';
 *
 * const utf8Builder = Builder.new({
 *     type: new Utf8(),
 *     nullValues: [null, 'n/a']
 * });
 *
 * utf8Builder
 *     .append('hello')
 *     .append('n/a')
 *     .append('world')
 *     .append(null);
 *
 * const utf8Vector = utf8Builder.finish().toVector();
 *
 * console.log(utf8Vector.toJSON());
 * // > ["hello", null, "world", null]
 * ```
 *
 * @typeparam T The `DataType` of this `Builder`.
 * @typeparam TNull The type(s) of values which will be considered null-value sentinels.
 */
export declare abstract class Builder<T extends DataType = any, TNull = any> {
  /**
   * Create a `Builder` instance based on the `type` property of the supplied `options` object.
   * @param {BuilderOptions<T, TNull>} options An object with a required `DataType` instance
   * and other optional parameters to be passed to the `Builder` subclass for the given `type`.
   *
   * @typeparam T The `DataType` of the `Builder` to create.
   * @typeparam TNull The type(s) of values which will be considered null-value sentinels.
   * @nocollapse
   */
  static new<T extends DataType = any, TNull = any>(
    options: BuilderOptions<T, TNull>
  ): B<T, TNull>;
  /** @nocollapse */
  static throughNode<T extends DataType = any, TNull = any>(
    options: import("./io/node/builder").BuilderDuplexOptions<T, TNull>
  ): import("stream").Duplex;
  /** @nocollapse */
  static throughDOM<T extends DataType = any, TNull = any>(
    options: import("./io/whatwg/builder").BuilderTransformOptions<T, TNull>
  ): import("./io/whatwg/builder").BuilderTransform<T, TNull>;
  /**
   * Transform a synchronous `Iterable` of arbitrary JavaScript values into a
   * sequence of Arrow Vector<T> following the chunking semantics defined in
   * the supplied `options` argument.
   *
   * This function returns a function that accepts an `Iterable` of values to
   * transform. When called, this function returns an Iterator of `Vector<T>`.
   *
   * The resulting `Iterator<Vector<T>>` yields Vectors based on the
   * `queueingStrategy` and `highWaterMark` specified in the `options` argument.
   *
   * * If `queueingStrategy` is `"count"` (or omitted), The `Iterator<Vector<T>>`
   *   will flush the underlying `Builder` (and yield a new `Vector<T>`) once the
   *   Builder's `length` reaches or exceeds the supplied `highWaterMark`.
   * * If `queueingStrategy` is `"bytes"`, the `Iterator<Vector<T>>` will flush
   *   the underlying `Builder` (and yield a new `Vector<T>`) once its `byteLength`
   *   reaches or exceeds the supplied `highWaterMark`.
   *
   * @param {IterableBuilderOptions<T, TNull>} options An object of properties which determine the `Builder` to create and the chunking semantics to use.
   * @returns A function which accepts a JavaScript `Iterable` of values to
   *          write, and returns an `Iterator` that yields Vectors according
   *          to the chunking semantics defined in the `options` argument.
   * @nocollapse
   */
  static throughIterable<T extends DataType = any, TNull = any>(
    options: IterableBuilderOptions<T, TNull>
  ): ThroughIterable<T, TNull>;
  /**
   * Transform an `AsyncIterable` of arbitrary JavaScript values into a
   * sequence of Arrow Vector<T> following the chunking semantics defined in
   * the supplied `options` argument.
   *
   * This function returns a function that accepts an `AsyncIterable` of values to
   * transform. When called, this function returns an AsyncIterator of `Vector<T>`.
   *
   * The resulting `AsyncIterator<Vector<T>>` yields Vectors based on the
   * `queueingStrategy` and `highWaterMark` specified in the `options` argument.
   *
   * * If `queueingStrategy` is `"count"` (or omitted), The `AsyncIterator<Vector<T>>`
   *   will flush the underlying `Builder` (and yield a new `Vector<T>`) once the
   *   Builder's `length` reaches or exceeds the supplied `highWaterMark`.
   * * If `queueingStrategy` is `"bytes"`, the `AsyncIterator<Vector<T>>` will flush
   *   the underlying `Builder` (and yield a new `Vector<T>`) once its `byteLength`
   *   reaches or exceeds the supplied `highWaterMark`.
   *
   * @param {IterableBuilderOptions<T, TNull>} options An object of properties which determine the `Builder` to create and the chunking semantics to use.
   * @returns A function which accepts a JavaScript `AsyncIterable` of values
   *          to write, and returns an `AsyncIterator` that yields Vectors
   *          according to the chunking semantics defined in the `options`
   *          argument.
   * @nocollapse
   */
  static throughAsyncIterable<T extends DataType = any, TNull = any>(
    options: IterableBuilderOptions<T, TNull>
  ): ThroughAsyncIterable<T, TNull>;
  /**
   * Construct a builder with the given Arrow DataType with optional null values,
   * which will be interpreted as "null" when set or appended to the `Builder`.
   * @param {{ type: T, nullValues?: any[] }} options A `BuilderOptions` object used to create this `Builder`.
   */
  constructor({ type: type, nullValues: nulls }: BuilderOptions<T, TNull>);
  /**
   * The Builder's `DataType` instance.
   * @readonly
   */
  type: T;
  /**
   * The number of values written to the `Builder` that haven't been flushed yet.
   * @readonly
   */
  length: number;
  /**
   * A boolean indicating whether `Builder.prototype.finish()` has been called on this `Builder`.
   * @readonly
   */
  finished: boolean;
  /**
   * The number of elements in the underlying values TypedArray that
   * represent a single logical element, determined by this Builder's
   * `DataType`. This is 1 for most types, but is larger when the `DataType`
   * is `Int64`, `Uint64`, `Decimal`, `DateMillisecond`, certain variants of
   * `Interval`, `Time`, or `Timestamp`, `FixedSizeBinary`, and `FixedSizeList`.
   * @readonly
   */
  readonly stride: number;
  readonly children: Builder[];
  /**
   * The list of null-value sentinels for this `Builder`. When one of these values
   * is written to the `Builder` (either via `Builder.prototype.set()` or `Builder.prototype.append()`),
   * a 1-bit is written to this Builder's underlying null BitmapBufferBuilder.
   * @readonly
   */
  readonly nullValues?: TNull[] | ReadonlyArray<TNull> | null;
  /**
   * Flush the `Builder` and return a `Vector<T>`.
   * @returns {Vector<T>} A `Vector<T>` of the flushed values.
   */
  toVector(): V<T>;
  readonly ArrayType: any;
  readonly nullCount: number;
  readonly numChildren: number;
  /**
   * @returns The aggregate length (in bytes) of the values that have been written.
   */
  readonly byteLength: number;
  /**
   * @returns The aggregate number of rows that have been reserved to write new values.
   */
  readonly reservedLength: number;
  /**
   * @returns The aggregate length (in bytes) that has been reserved to write new values.
   */
  readonly reservedByteLength: number;
  protected _offsets: DataBufferBuilder<Int32Array>;
  readonly valueOffsets: Int32Array | null;
  protected _values: BufferBuilder<T["TArray"], any>;
  readonly values: T["TArray"];
  protected _nulls: BitmapBufferBuilder;
  readonly nullBitmap: Uint8Array | null;
  protected _typeIds: DataBufferBuilder<Int8Array>;
  readonly typeIds: Int8Array | null;
  protected _isValid: (value: T["TValue"] | TNull) => boolean;
  protected _setValue: (
    inst: Builder<T>,
    index: number,
    value: T["TValue"]
  ) => void;
  /**
   * Appends a value (or null) to this `Builder`.
   * This is equivalent to `builder.set(builder.length, value)`.
   * @param {T['TValue'] | TNull } value The value to append.
   */
  append(value: T["TValue"] | TNull): this;
  /**
   * Validates whether a value is valid (true), or null (false)
   * @param {T['TValue'] | TNull } value The value to compare against null the value representations
   */
  isValid(value: T["TValue"] | TNull): boolean;
  /**
   * Write a value (or null-value sentinel) at the supplied index.
   * If the value matches one of the null-value representations, a 1-bit is
   * written to the null `BitmapBufferBuilder`. Otherwise, a 0 is written to
   * the null `BitmapBufferBuilder`, and the value is passed to
   * `Builder.prototype.setValue()`.
   * @param {number} index The index of the value to write.
   * @param {T['TValue'] | TNull } value The value to write at the supplied index.
   * @returns {this} The updated `Builder` instance.
   */
  set(index: number, value: T["TValue"] | TNull): this;
  /**
   * Write a value to the underlying buffers at the supplied index, bypassing
   * the null-value check. This is a low-level method that
   * @param {number} index
   * @param {T['TValue'] | TNull } value
   */
  setValue(index: number, value: T["TValue"]): void;
  setValid(index: number, valid: boolean): boolean;
  addChild(child: Builder, name?: string): void;
  /**
   * Retrieve the child `Builder` at the supplied `index`, or null if no child
   * exists at that index.
   * @param {number} index The index of the child `Builder` to retrieve.
   * @returns {Builder | null} The child Builder at the supplied index or null.
   */
  getChildAt<R extends DataType = any>(index: number): Builder<R> | null;
  /**
   * Commit all the values that have been written to their underlying
   * ArrayBuffers, including any child Builders if applicable, and reset
   * the internal `Builder` state.
   * @returns A `Data<T>` of the buffers and childData representing the values written.
   */
  flush(): Data<T>;
  /**
   * Finalize this `Builder`, and child builders if applicable.
   * @returns {this} The finalized `Builder` instance.
   */
  finish(): this;
  /**
   * Clear this Builder's internal state, including child Builders if applicable, and reset the length to 0.
   * @returns {this} The cleared `Builder` instance.
   */
  clear(): this;
}
/** @ignore */
export declare abstract class FixedWidthBuilder<
  T extends
    | Int
    | Float
    | FixedSizeBinary
    | Date_
    | Timestamp
    | Time
    | Decimal
    | Interval = any,
  TNull = any
> extends Builder<T, TNull> {
  constructor(opts: BuilderOptions<T, TNull>);
  setValue(index: number, value: T["TValue"]): void;
}
/** @ignore */
export declare abstract class VariableWidthBuilder<
  T extends Binary | Utf8 | List | Map_,
  TNull = any
> extends Builder<T, TNull> {
  protected _pendingLength: number;
  protected _offsets: OffsetsBufferBuilder;
  protected _pending: Map<number, any> | undefined;
  constructor(opts: BuilderOptions<T, TNull>);
  setValue(index: number, value: T["TValue"]): void;
  setValid(index: number, isValid: boolean): boolean;
  clear(): this;
  flush(): Data<T>;
  finish(): this;
  protected _flush(): this;
  protected abstract _flushPending(
    pending: Map<number, any>,
    pendingLength: number
  ): void;
}
/** @ignore */
declare type ThroughIterable<T extends DataType = any, TNull = any> = (
  source: Iterable<T["TValue"] | TNull>
) => IterableIterator<V<T>>;
/** @ignore */
declare type ThroughAsyncIterable<T extends DataType = any, TNull = any> = (
  source: Iterable<T["TValue"] | TNull> | AsyncIterable<T["TValue"] | TNull>
) => AsyncIterableIterator<V<T>>;
export {};
