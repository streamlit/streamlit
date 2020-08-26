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
import { memcpy } from "../util/buffer";
import {
  BigIntAvailable,
  BigInt64Array,
  BigUint64Array
} from "../util/compat";
/** @ignore */
const roundLengthUpToNearest64Bytes = (len, BPE) =>
  ((len * BPE + 63) & ~63 || 64) / BPE;
/** @ignore */
const sliceOrExtendArray = (arr, len = 0) =>
  arr.length >= len
    ? arr.subarray(0, len)
    : memcpy(new arr.constructor(len), arr, 0);
/** @ignore */
export class BufferBuilder {
  constructor(buffer, stride = 1) {
    this.buffer = buffer;
    this.stride = stride;
    this.BYTES_PER_ELEMENT = buffer.BYTES_PER_ELEMENT;
    this.ArrayType = buffer.constructor;
    this._resize((this.length = (buffer.length / stride) | 0));
  }
  get byteLength() {
    return (this.length * this.stride * this.BYTES_PER_ELEMENT) | 0;
  }
  get reservedLength() {
    return this.buffer.length / this.stride;
  }
  get reservedByteLength() {
    return this.buffer.byteLength;
  }
  // @ts-ignore
  set(index, value) {
    return this;
  }
  append(value) {
    return this.set(this.length, value);
  }
  reserve(extra) {
    if (extra > 0) {
      this.length += extra;
      const stride = this.stride;
      const length = this.length * stride;
      const reserved = this.buffer.length;
      if (length >= reserved) {
        this._resize(
          reserved === 0
            ? roundLengthUpToNearest64Bytes(length * 1, this.BYTES_PER_ELEMENT)
            : roundLengthUpToNearest64Bytes(length * 2, this.BYTES_PER_ELEMENT)
        );
      }
    }
    return this;
  }
  flush(length = this.length) {
    length = roundLengthUpToNearest64Bytes(
      length * this.stride,
      this.BYTES_PER_ELEMENT
    );
    const array = sliceOrExtendArray(this.buffer, length);
    this.clear();
    return array;
  }
  clear() {
    this.length = 0;
    this._resize(0);
    return this;
  }
  _resize(newLength) {
    return (this.buffer = memcpy(new this.ArrayType(newLength), this.buffer));
  }
}
BufferBuilder.prototype.offset = 0;
/** @ignore */
export class DataBufferBuilder extends BufferBuilder {
  last() {
    return this.get(this.length - 1);
  }
  get(index) {
    return this.buffer[index];
  }
  set(index, value) {
    this.reserve(index - this.length + 1);
    this.buffer[index * this.stride] = value;
    return this;
  }
}
/** @ignore */
export class BitmapBufferBuilder extends DataBufferBuilder {
  constructor(data = new Uint8Array(0)) {
    super(data, 1 / 8);
    this.numValid = 0;
  }
  get numInvalid() {
    return this.length - this.numValid;
  }
  get(idx) {
    return (this.buffer[idx >> 3] >> idx % 8) & 1;
  }
  set(idx, val) {
    const { buffer } = this.reserve(idx - this.length + 1);
    const byte = idx >> 3,
      bit = idx % 8,
      cur = (buffer[byte] >> bit) & 1;
    // If `val` is truthy and the current bit is 0, flip it to 1 and increment `numValid`.
    // If `val` is falsey and the current bit is 1, flip it to 0 and decrement `numValid`.
    val
      ? cur === 0 && ((buffer[byte] |= 1 << bit), ++this.numValid)
      : cur === 1 && ((buffer[byte] &= ~(1 << bit)), --this.numValid);
    return this;
  }
  clear() {
    this.numValid = 0;
    return super.clear();
  }
}
/** @ignore */
export class OffsetsBufferBuilder extends DataBufferBuilder {
  constructor(data = new Int32Array(1)) {
    super(data, 1);
  }
  append(value) {
    return this.set(this.length - 1, value);
  }
  set(index, value) {
    const offset = this.length - 1;
    const buffer = this.reserve(index - offset + 1).buffer;
    if (offset < index++) {
      buffer.fill(buffer[offset], offset, index);
    }
    buffer[index] = buffer[index - 1] + value;
    return this;
  }
  flush(length = this.length - 1) {
    if (length > this.length) {
      this.set(length - 1, 0);
    }
    return super.flush(length + 1);
  }
}
/** @ignore */
export class WideBufferBuilder extends BufferBuilder {
  get ArrayType64() {
    return (
      this._ArrayType64 ||
      (this._ArrayType64 =
        this.buffer instanceof Int32Array ? BigInt64Array : BigUint64Array)
    );
  }
  set(index, value) {
    this.reserve(index - this.length + 1);
    switch (typeof value) {
      case "bigint":
        this.buffer64[index] = value;
        break;
      case "number":
        this.buffer[index * this.stride] = value;
        break;
      default:
        this.buffer.set(value, index * this.stride);
    }
    return this;
  }
  _resize(newLength) {
    const data = super._resize(newLength);
    const length = data.byteLength / (this.BYTES_PER_ELEMENT * this.stride);
    if (BigIntAvailable) {
      this.buffer64 = new this.ArrayType64(
        data.buffer,
        data.byteOffset,
        length
      );
    }
    return data;
  }
}

//# sourceMappingURL=buffer.mjs.map
