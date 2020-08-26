"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
/** @ignore */
function getBool(_data, _index, byte, bit) {
  return (byte & (1 << bit)) !== 0;
}
exports.getBool = getBool;
/** @ignore */
function getBit(_data, _index, byte, bit) {
  return (byte & (1 << bit)) >> bit;
}
exports.getBit = getBit;
/** @ignore */
function setBool(bytes, index, value) {
  return value
    ? !!(bytes[index >> 3] |= 1 << index % 8) || true
    : !(bytes[index >> 3] &= ~(1 << index % 8)) && false;
}
exports.setBool = setBool;
/** @ignore */
function truncateBitmap(offset, length, bitmap) {
  const alignedSize = (bitmap.byteLength + 7) & ~7;
  if (offset > 0 || bitmap.byteLength < alignedSize) {
    const bytes = new Uint8Array(alignedSize);
    // If the offset is a multiple of 8 bits, it's safe to slice the bitmap
    bytes.set(
      offset % 8 === 0
        ? bitmap.subarray(offset >> 3)
        : // Otherwise iterate each bit from the offset and return a new one
          packBools(
            iterateBits(bitmap, offset, length, null, getBool)
          ).subarray(0, alignedSize)
    );
    return bytes;
  }
  return bitmap;
}
exports.truncateBitmap = truncateBitmap;
/** @ignore */
function packBools(values) {
  let xs = [];
  let i = 0,
    bit = 0,
    byte = 0;
  for (const value of values) {
    value && (byte |= 1 << bit);
    if (++bit === 8) {
      xs[i++] = byte;
      byte = bit = 0;
    }
  }
  if (i === 0 || bit > 0) {
    xs[i++] = byte;
  }
  let b = new Uint8Array((xs.length + 7) & ~7);
  b.set(xs);
  return b;
}
exports.packBools = packBools;
/** @ignore */
function* iterateBits(bytes, begin, length, context, get) {
  let bit = begin % 8;
  let byteIndex = begin >> 3;
  let index = 0,
    remaining = length;
  for (; remaining > 0; bit = 0) {
    let byte = bytes[byteIndex++];
    do {
      yield get(context, index++, byte, bit);
    } while (--remaining > 0 && ++bit < 8);
  }
}
exports.iterateBits = iterateBits;
/**
 * Compute the population count (the number of bits set to 1) for a range of bits in a Uint8Array.
 * @param vector The Uint8Array of bits for which to compute the population count.
 * @param lhs The range's left-hand side (or start) bit
 * @param rhs The range's right-hand side (or end) bit
 */
/** @ignore */
function popcnt_bit_range(data, lhs, rhs) {
  if (rhs - lhs <= 0) {
    return 0;
  }
  // If the bit range is less than one byte, sum the 1 bits in the bit range
  if (rhs - lhs < 8) {
    let sum = 0;
    for (const bit of iterateBits(data, lhs, rhs - lhs, data, getBit)) {
      sum += bit;
    }
    return sum;
  }
  // Get the next lowest multiple of 8 from the right hand side
  const rhsInside = (rhs >> 3) << 3;
  // Get the next highest multiple of 8 from the left hand side
  const lhsInside = lhs + (lhs % 8 === 0 ? 0 : 8 - (lhs % 8));
  return (
    // Get the popcnt of bits between the left hand side, and the next highest multiple of 8
    popcnt_bit_range(data, lhs, lhsInside) +
    // Get the popcnt of bits between the right hand side, and the next lowest multiple of 8
    popcnt_bit_range(data, rhsInside, rhs) +
    // Get the popcnt of all bits between the left and right hand sides' multiples of 8
    popcnt_array(data, lhsInside >> 3, (rhsInside - lhsInside) >> 3)
  );
}
exports.popcnt_bit_range = popcnt_bit_range;
/** @ignore */
function popcnt_array(arr, byteOffset, byteLength) {
  let cnt = 0,
    pos = byteOffset | 0;
  const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  const len = byteLength === void 0 ? arr.byteLength : pos + byteLength;
  while (len - pos >= 4) {
    cnt += popcnt_uint32(view.getUint32(pos));
    pos += 4;
  }
  while (len - pos >= 2) {
    cnt += popcnt_uint32(view.getUint16(pos));
    pos += 2;
  }
  while (len - pos >= 1) {
    cnt += popcnt_uint32(view.getUint8(pos));
    pos += 1;
  }
  return cnt;
}
exports.popcnt_array = popcnt_array;
/** @ignore */
function popcnt_uint32(uint32) {
  let i = uint32 | 0;
  i = i - ((i >>> 1) & 0x55555555);
  i = (i & 0x33333333) + ((i >>> 2) & 0x33333333);
  return (((i + (i >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}
exports.popcnt_uint32 = popcnt_uint32;

//# sourceMappingURL=bit.js.map
