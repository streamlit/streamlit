/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * A circular buffer implementation.
 */
export class CircularBuffer<T> {
  private _buffer: T[]

  private _size: number

  private _index: number

  private _wrappedCount: number

  /**
   * Creates an instance of CircularBuffer.
   * @param {number} size - The size of the buffer.
   */
  constructor(size: number) {
    this._buffer = new Array(size)
    this._size = size
    this._index = 0
    this._wrappedCount = 0
  }

  /**
   * Adds a value to the buffer.
   * @param {T} value - The value to add to the buffer.
   */
  push(value: T): void {
    this._buffer[this._index] = value
    this._index = (this._index + 1) % this._size

    if (this._index === 0) {
      this._wrappedCount = this._wrappedCount + 1
    }
  }

  /**
   * Gets the current state of the buffer.
   * @returns {readonly T[]} The buffer array.
   */
  get buffer(): readonly T[] {
    return this._buffer
  }

  /**
   * Gets the total number of entries written to the buffer.
   * @returns {number} The total number of written entries.
   */
  get totalWrittenEntries(): number {
    return this._wrappedCount * this._size + this._index
  }
}
