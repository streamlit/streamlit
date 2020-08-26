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
import { flatbuffers } from "flatbuffers";
import { encodeUtf8 } from "../util/utf8";
var ByteBuffer = flatbuffers.ByteBuffer;
import {
  isPromise,
  isIterable,
  isAsyncIterable,
  isIteratorResult,
  BigInt64Array,
  BigUint64Array
} from "./compat";
/** @ignore */
const SharedArrayBuf =
  typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : ArrayBuffer;
/** @ignore */
function collapseContiguousByteRanges(chunks) {
  let result = chunks[0] ? [chunks[0]] : [];
  let xOffset, yOffset, xLen, yLen;
  for (let x, y, i = 0, j = 0, n = chunks.length; ++i < n; ) {
    x = result[j];
    y = chunks[i];
    // continue if x and y don't share the same underlying ArrayBuffer, or if x isn't before y
    if (!x || !y || x.buffer !== y.buffer || y.byteOffset < x.byteOffset) {
      y && (result[++j] = y);
      continue;
    }
    ({ byteOffset: xOffset, byteLength: xLen } = x);
    ({ byteOffset: yOffset, byteLength: yLen } = y);
    // continue if the byte ranges of x and y aren't contiguous
    if (xOffset + xLen < yOffset || yOffset + yLen < xOffset) {
      y && (result[++j] = y);
      continue;
    }
    result[j] = new Uint8Array(x.buffer, xOffset, yOffset - xOffset + yLen);
  }
  return result;
}
/** @ignore */
export function memcpy(
  target,
  source,
  targetByteOffset = 0,
  sourceByteLength = source.byteLength
) {
  const targetByteLength = target.byteLength;
  const dst = new Uint8Array(
    target.buffer,
    target.byteOffset,
    targetByteLength
  );
  const src = new Uint8Array(
    source.buffer,
    source.byteOffset,
    Math.min(sourceByteLength, targetByteLength)
  );
  dst.set(src, targetByteOffset);
  return target;
}
/** @ignore */
export function joinUint8Arrays(chunks, size) {
  // collapse chunks that share the same underlying ArrayBuffer and whose byte ranges overlap,
  // to avoid unnecessarily copying the bytes to do this buffer join. This is a common case during
  // streaming, where we may be reading partial byte ranges out of the same underlying ArrayBuffer
  let result = collapseContiguousByteRanges(chunks);
  let byteLength = result.reduce((x, b) => x + b.byteLength, 0);
  let source, sliced, buffer;
  let offset = 0,
    index = -1,
    length = Math.min(size || Infinity, byteLength);
  for (let n = result.length; ++index < n; ) {
    source = result[index];
    sliced = source.subarray(0, Math.min(source.length, length - offset));
    if (length <= offset + sliced.length) {
      if (sliced.length < source.length) {
        result[index] = source.subarray(sliced.length);
      } else if (sliced.length === source.length) {
        index++;
      }
      buffer ? memcpy(buffer, sliced, offset) : (buffer = sliced);
      break;
    }
    memcpy(buffer || (buffer = new Uint8Array(length)), sliced, offset);
    offset += sliced.length;
  }
  return [
    buffer || new Uint8Array(0),
    result.slice(index),
    byteLength - (buffer ? buffer.byteLength : 0)
  ];
}
export function toArrayBufferView(ArrayBufferViewCtor, input) {
  let value = isIteratorResult(input) ? input.value : input;
  if (value instanceof ArrayBufferViewCtor) {
    if (ArrayBufferViewCtor === Uint8Array) {
      // Node's `Buffer` class passes the `instanceof Uint8Array` check, but we need
      // a real Uint8Array, since Buffer#slice isn't the same as Uint8Array#slice :/
      return new ArrayBufferViewCtor(
        value.buffer,
        value.byteOffset,
        value.byteLength
      );
    }
    return value;
  }
  if (!value) {
    return new ArrayBufferViewCtor(0);
  }
  if (typeof value === "string") {
    value = encodeUtf8(value);
  }
  if (value instanceof ArrayBuffer) {
    return new ArrayBufferViewCtor(value);
  }
  if (value instanceof SharedArrayBuf) {
    return new ArrayBufferViewCtor(value);
  }
  if (value instanceof ByteBuffer) {
    return toArrayBufferView(ArrayBufferViewCtor, value.bytes());
  }
  return !ArrayBuffer.isView(value)
    ? ArrayBufferViewCtor.from(value)
    : value.byteLength <= 0
    ? new ArrayBufferViewCtor(0)
    : new ArrayBufferViewCtor(
        value.buffer,
        value.byteOffset,
        value.byteLength / ArrayBufferViewCtor.BYTES_PER_ELEMENT
      );
}
/** @ignore */ export const toInt8Array = input =>
  toArrayBufferView(Int8Array, input);
/** @ignore */ export const toInt16Array = input =>
  toArrayBufferView(Int16Array, input);
/** @ignore */ export const toInt32Array = input =>
  toArrayBufferView(Int32Array, input);
/** @ignore */ export const toBigInt64Array = input =>
  toArrayBufferView(BigInt64Array, input);
/** @ignore */ export const toUint8Array = input =>
  toArrayBufferView(Uint8Array, input);
/** @ignore */ export const toUint16Array = input =>
  toArrayBufferView(Uint16Array, input);
/** @ignore */ export const toUint32Array = input =>
  toArrayBufferView(Uint32Array, input);
/** @ignore */ export const toBigUint64Array = input =>
  toArrayBufferView(BigUint64Array, input);
/** @ignore */ export const toFloat32Array = input =>
  toArrayBufferView(Float32Array, input);
/** @ignore */ export const toFloat64Array = input =>
  toArrayBufferView(Float64Array, input);
/** @ignore */ export const toUint8ClampedArray = input =>
  toArrayBufferView(Uint8ClampedArray, input);
/** @ignore */
const pump = iterator => {
  iterator.next();
  return iterator;
};
/** @ignore */
export function* toArrayBufferViewIterator(ArrayCtor, source) {
  const wrap = function*(x) {
    yield x;
  };
  const buffers =
    typeof source === "string"
      ? wrap(source)
      : ArrayBuffer.isView(source)
      ? wrap(source)
      : source instanceof ArrayBuffer
      ? wrap(source)
      : source instanceof SharedArrayBuf
      ? wrap(source)
      : !isIterable(source)
      ? wrap(source)
      : source;
  yield* pump(
    (function*(it) {
      let r = null;
      do {
        r = it.next(yield toArrayBufferView(ArrayCtor, r));
      } while (!r.done);
    })(buffers[Symbol.iterator]())
  );
}
/** @ignore */ export const toInt8ArrayIterator = input =>
  toArrayBufferViewIterator(Int8Array, input);
/** @ignore */ export const toInt16ArrayIterator = input =>
  toArrayBufferViewIterator(Int16Array, input);
/** @ignore */ export const toInt32ArrayIterator = input =>
  toArrayBufferViewIterator(Int32Array, input);
/** @ignore */ export const toUint8ArrayIterator = input =>
  toArrayBufferViewIterator(Uint8Array, input);
/** @ignore */ export const toUint16ArrayIterator = input =>
  toArrayBufferViewIterator(Uint16Array, input);
/** @ignore */ export const toUint32ArrayIterator = input =>
  toArrayBufferViewIterator(Uint32Array, input);
/** @ignore */ export const toFloat32ArrayIterator = input =>
  toArrayBufferViewIterator(Float32Array, input);
/** @ignore */ export const toFloat64ArrayIterator = input =>
  toArrayBufferViewIterator(Float64Array, input);
/** @ignore */ export const toUint8ClampedArrayIterator = input =>
  toArrayBufferViewIterator(Uint8ClampedArray, input);
/** @ignore */
export async function* toArrayBufferViewAsyncIterator(ArrayCtor, source) {
  // if a Promise, unwrap the Promise and iterate the resolved value
  if (isPromise(source)) {
    return yield* toArrayBufferViewAsyncIterator(ArrayCtor, await source);
  }
  const wrap = async function*(x) {
    yield await x;
  };
  const emit = async function*(source) {
    yield* pump(
      (function*(it) {
        let r = null;
        do {
          r = it.next(yield r && r.value);
        } while (!r.done);
      })(source[Symbol.iterator]())
    );
  };
  const buffers =
    typeof source === "string"
      ? wrap(source) // if string, wrap in an AsyncIterableIterator
      : ArrayBuffer.isView(source)
      ? wrap(source) // if TypedArray, wrap in an AsyncIterableIterator
      : source instanceof ArrayBuffer
      ? wrap(source) // if ArrayBuffer, wrap in an AsyncIterableIterator
      : source instanceof SharedArrayBuf
      ? wrap(source) // if SharedArrayBuffer, wrap in an AsyncIterableIterator
      : isIterable(source)
      ? emit(source) // If Iterable, wrap in an AsyncIterableIterator and compose the `next` values
      : !isAsyncIterable(source)
      ? wrap(source) // If not an AsyncIterable, treat as a sentinel and wrap in an AsyncIterableIterator
      : source; // otherwise if AsyncIterable, use it
  yield* pump(
    (async function*(it) {
      let r = null;
      do {
        r = await it.next(yield toArrayBufferView(ArrayCtor, r));
      } while (!r.done);
    })(buffers[Symbol.asyncIterator]())
  );
}
/** @ignore */ export const toInt8ArrayAsyncIterator = input =>
  toArrayBufferViewAsyncIterator(Int8Array, input);
/** @ignore */ export const toInt16ArrayAsyncIterator = input =>
  toArrayBufferViewAsyncIterator(Int16Array, input);
/** @ignore */ export const toInt32ArrayAsyncIterator = input =>
  toArrayBufferViewAsyncIterator(Int32Array, input);
/** @ignore */ export const toUint8ArrayAsyncIterator = input =>
  toArrayBufferViewAsyncIterator(Uint8Array, input);
/** @ignore */ export const toUint16ArrayAsyncIterator = input =>
  toArrayBufferViewAsyncIterator(Uint16Array, input);
/** @ignore */ export const toUint32ArrayAsyncIterator = input =>
  toArrayBufferViewAsyncIterator(Uint32Array, input);
/** @ignore */ export const toFloat32ArrayAsyncIterator = input =>
  toArrayBufferViewAsyncIterator(Float32Array, input);
/** @ignore */ export const toFloat64ArrayAsyncIterator = input =>
  toArrayBufferViewAsyncIterator(Float64Array, input);
/** @ignore */ export const toUint8ClampedArrayAsyncIterator = input =>
  toArrayBufferViewAsyncIterator(Uint8ClampedArray, input);
/** @ignore */
export function rebaseValueOffsets(offset, length, valueOffsets) {
  // If we have a non-zero offset, create a new offsets array with the values
  // shifted by the start offset, such that the new start offset is 0
  if (offset !== 0) {
    valueOffsets = valueOffsets.slice(0, length + 1);
    for (let i = -1; ++i <= length; ) {
      valueOffsets[i] += offset;
    }
  }
  return valueOffsets;
}
/** @ignore */
export function compareArrayLike(a, b) {
  let i = 0,
    n = a.length;
  if (n !== b.length) {
    return false;
  }
  if (n > 0) {
    do {
      if (a[i] !== b[i]) {
        return false;
      }
    } while (++i < n);
  }
  return true;
}

//# sourceMappingURL=buffer.mjs.map
