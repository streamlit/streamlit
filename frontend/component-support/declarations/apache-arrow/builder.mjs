// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
import { Vector } from "./vector"
import { BufferType } from "./enum"
import { Data } from "./data"
import { createIsValidFunction } from "./builder/valid"
import {
  BitmapBufferBuilder,
  DataBufferBuilder,
  OffsetsBufferBuilder,
} from "./builder/buffer"
import { strideForType } from "./type"
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
export class Builder {
  /**
   * Construct a builder with the given Arrow DataType with optional null values,
   * which will be interpreted as "null" when set or appended to the `Builder`.
   * @param {{ type: T, nullValues?: any[] }} options A `BuilderOptions` object used to create this `Builder`.
   */
  constructor({ type: type, nullValues: nulls }) {
    /**
     * The number of values written to the `Builder` that haven't been flushed yet.
     * @readonly
     */
    this.length = 0
    /**
     * A boolean indicating whether `Builder.prototype.finish()` has been called on this `Builder`.
     * @readonly
     */
    this.finished = false
    this.type = type
    this.children = []
    this.nullValues = nulls
    this.stride = strideForType(type)
    this._nulls = new BitmapBufferBuilder()
    if (nulls && nulls.length > 0) {
      this._isValid = createIsValidFunction(nulls)
    }
  }
  /**
   * Create a `Builder` instance based on the `type` property of the supplied `options` object.
   * @param {BuilderOptions<T, TNull>} options An object with a required `DataType` instance
   * and other optional parameters to be passed to the `Builder` subclass for the given `type`.
   *
   * @typeparam T The `DataType` of the `Builder` to create.
   * @typeparam TNull The type(s) of values which will be considered null-value sentinels.
   * @nocollapse
   */
  // @ts-ignore
  static new(options) {}
  /** @nocollapse */
  // @ts-ignore
  static throughNode(options) {
    throw new Error(`"throughNode" not available in this environment`)
  }
  /** @nocollapse */
  // @ts-ignore
  static throughDOM(options) {
    throw new Error(`"throughDOM" not available in this environment`)
  }
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
  static throughIterable(options) {
    return throughIterable(options)
  }
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
  static throughAsyncIterable(options) {
    return throughAsyncIterable(options)
  }
  /**
   * Flush the `Builder` and return a `Vector<T>`.
   * @returns {Vector<T>} A `Vector<T>` of the flushed values.
   */
  toVector() {
    return Vector.new(this.flush())
  }
  get ArrayType() {
    return this.type.ArrayType
  }
  get nullCount() {
    return this._nulls.numInvalid
  }
  get numChildren() {
    return this.children.length
  }
  /**
   * @returns The aggregate length (in bytes) of the values that have been written.
   */
  get byteLength() {
    let size = 0
    this._offsets && (size += this._offsets.byteLength)
    this._values && (size += this._values.byteLength)
    this._nulls && (size += this._nulls.byteLength)
    this._typeIds && (size += this._typeIds.byteLength)
    return this.children.reduce((size, child) => size + child.byteLength, size)
  }
  /**
   * @returns The aggregate number of rows that have been reserved to write new values.
   */
  get reservedLength() {
    return this._nulls.reservedLength
  }
  /**
   * @returns The aggregate length (in bytes) that has been reserved to write new values.
   */
  get reservedByteLength() {
    let size = 0
    this._offsets && (size += this._offsets.reservedByteLength)
    this._values && (size += this._values.reservedByteLength)
    this._nulls && (size += this._nulls.reservedByteLength)
    this._typeIds && (size += this._typeIds.reservedByteLength)
    return this.children.reduce(
      (size, child) => size + child.reservedByteLength,
      size
    )
  }
  get valueOffsets() {
    return this._offsets ? this._offsets.buffer : null
  }
  get values() {
    return this._values ? this._values.buffer : null
  }
  get nullBitmap() {
    return this._nulls ? this._nulls.buffer : null
  }
  get typeIds() {
    return this._typeIds ? this._typeIds.buffer : null
  }
  /**
   * Appends a value (or null) to this `Builder`.
   * This is equivalent to `builder.set(builder.length, value)`.
   * @param {T['TValue'] | TNull } value The value to append.
   */
  append(value) {
    return this.set(this.length, value)
  }
  /**
   * Validates whether a value is valid (true), or null (false)
   * @param {T['TValue'] | TNull } value The value to compare against null the value representations
   */
  // @ts-ignore
  isValid(value) {
    return this._isValid(value)
  }
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
  set(index, value) {
    if (this.setValid(index, this.isValid(value))) {
      this.setValue(index, value)
    }
    return this
  }
  /**
   * Write a value to the underlying buffers at the supplied index, bypassing
   * the null-value check. This is a low-level method that
   * @param {number} index
   * @param {T['TValue'] | TNull } value
   */
  // @ts-ignore
  setValue(index, value) {
    this._setValue(this, index, value)
  }
  setValid(index, valid) {
    this.length = this._nulls.set(index, +valid).length
    return valid
  }
  // @ts-ignore
  addChild(child, name = `${this.numChildren}`) {
    throw new Error(`Cannot append children to non-nested type "${this.type}"`)
  }
  /**
   * Retrieve the child `Builder` at the supplied `index`, or null if no child
   * exists at that index.
   * @param {number} index The index of the child `Builder` to retrieve.
   * @returns {Builder | null} The child Builder at the supplied index or null.
   */
  getChildAt(index) {
    return this.children[index] || null
  }
  /**
   * Commit all the values that have been written to their underlying
   * ArrayBuffers, including any child Builders if applicable, and reset
   * the internal `Builder` state.
   * @returns A `Data<T>` of the buffers and childData representing the values written.
   */
  flush() {
    const buffers = []
    const values = this._values
    const offsets = this._offsets
    const typeIds = this._typeIds
    const { length, nullCount } = this
    if (typeIds) {
      /* Unions */
      buffers[BufferType.TYPE] = typeIds.flush(length)
      // DenseUnions
      offsets && (buffers[BufferType.OFFSET] = offsets.flush(length))
    } else if (offsets) {
      /* Variable-width primitives (Binary, Utf8) and Lists */
      // Binary, Utf8
      values && (buffers[BufferType.DATA] = values.flush(offsets.last()))
      buffers[BufferType.OFFSET] = offsets.flush(length)
    } else if (values) {
      /* Fixed-width primitives (Int, Float, Decimal, Time, Timestamp, and Interval) */
      buffers[BufferType.DATA] = values.flush(length)
    }
    nullCount > 0 && (buffers[BufferType.VALIDITY] = this._nulls.flush(length))
    const data = Data.new(
      this.type,
      0,
      length,
      nullCount,
      buffers,
      this.children.map(child => child.flush())
    )
    this.clear()
    return data
  }
  /**
   * Finalize this `Builder`, and child builders if applicable.
   * @returns {this} The finalized `Builder` instance.
   */
  finish() {
    this.finished = true
    this.children.forEach(child => child.finish())
    return this
  }
  /**
   * Clear this Builder's internal state, including child Builders if applicable, and reset the length to 0.
   * @returns {this} The cleared `Builder` instance.
   */
  clear() {
    this.length = 0
    this._offsets && this._offsets.clear()
    this._values && this._values.clear()
    this._nulls && this._nulls.clear()
    this._typeIds && this._typeIds.clear()
    this.children.forEach(child => child.clear())
    return this
  }
}
Builder.prototype.length = 1
Builder.prototype.stride = 1
Builder.prototype.children = null
Builder.prototype.finished = false
Builder.prototype.nullValues = null
Builder.prototype._isValid = () => true
/** @ignore */
export class FixedWidthBuilder extends Builder {
  constructor(opts) {
    super(opts)
    this._values = new DataBufferBuilder(new this.ArrayType(0), this.stride)
  }
  setValue(index, value) {
    const values = this._values
    values.reserve(index - values.length + 1)
    return super.setValue(index, value)
  }
}
/** @ignore */
export class VariableWidthBuilder extends Builder {
  constructor(opts) {
    super(opts)
    this._pendingLength = 0
    this._offsets = new OffsetsBufferBuilder()
  }
  setValue(index, value) {
    const pending = this._pending || (this._pending = new Map())
    const current = pending.get(index)
    current && (this._pendingLength -= current.length)
    this._pendingLength += value.length
    pending.set(index, value)
  }
  setValid(index, isValid) {
    if (!super.setValid(index, isValid)) {
      ;(this._pending || (this._pending = new Map())).set(index, undefined)
      return false
    }
    return true
  }
  clear() {
    this._pendingLength = 0
    this._pending = undefined
    return super.clear()
  }
  flush() {
    this._flush()
    return super.flush()
  }
  finish() {
    this._flush()
    return super.finish()
  }
  _flush() {
    const pending = this._pending
    const pendingLength = this._pendingLength
    this._pendingLength = 0
    this._pending = undefined
    if (pending && pending.size > 0) {
      this._flushPending(pending, pendingLength)
    }
    return this
  }
}
/** @ignore */
function throughIterable(options) {
  const { ["queueingStrategy"]: queueingStrategy = "count" } = options
  const {
    ["highWaterMark"]: highWaterMark = queueingStrategy !== "bytes"
      ? 1000
      : 2 ** 14,
  } = options
  const sizeProperty = queueingStrategy !== "bytes" ? "length" : "byteLength"
  return function*(source) {
    let numChunks = 0
    let builder = Builder.new(options)
    for (const value of source) {
      if (builder.append(value)[sizeProperty] >= highWaterMark) {
        ++numChunks && (yield builder.toVector())
      }
    }
    if (builder.finish().length > 0 || numChunks === 0) {
      yield builder.toVector()
    }
  }
}
/** @ignore */
function throughAsyncIterable(options) {
  const { ["queueingStrategy"]: queueingStrategy = "count" } = options
  const {
    ["highWaterMark"]: highWaterMark = queueingStrategy !== "bytes"
      ? 1000
      : 2 ** 14,
  } = options
  const sizeProperty = queueingStrategy !== "bytes" ? "length" : "byteLength"
  return async function*(source) {
    let numChunks = 0
    let builder = Builder.new(options)
    for await (const value of source) {
      if (builder.append(value)[sizeProperty] >= highWaterMark) {
        ++numChunks && (yield builder.toVector())
      }
    }
    if (builder.finish().length > 0 || numChunks === 0) {
      yield builder.toVector()
    }
  }
}

//# sourceMappingURL=builder.mjs.map
