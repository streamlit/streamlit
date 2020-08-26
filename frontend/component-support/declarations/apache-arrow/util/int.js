"use strict"
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
Object.defineProperty(exports, "__esModule", { value: true })
/** @ignore */
const carryBit16 = 1 << 16
/** @ignore */
function intAsHex(value) {
  if (value < 0) {
    value = 0xffffffff + value + 1
  }
  return `0x${value.toString(16)}`
}
/** @ignore */
const kInt32DecimalDigits = 8
/** @ignore */
const kPowersOfTen = [
  1,
  10,
  100,
  1000,
  10000,
  100000,
  1000000,
  10000000,
  100000000,
]
/** @ignore */
class BaseInt64 {
  constructor(buffer) {
    this.buffer = buffer
  }
  high() {
    return this.buffer[1]
  }
  low() {
    return this.buffer[0]
  }
  _times(other) {
    // Break the left and right numbers into 16 bit chunks
    // so that we can multiply them without overflow.
    const L = new Uint32Array([
      this.buffer[1] >>> 16,
      this.buffer[1] & 0xffff,
      this.buffer[0] >>> 16,
      this.buffer[0] & 0xffff,
    ])
    const R = new Uint32Array([
      other.buffer[1] >>> 16,
      other.buffer[1] & 0xffff,
      other.buffer[0] >>> 16,
      other.buffer[0] & 0xffff,
    ])
    let product = L[3] * R[3]
    this.buffer[0] = product & 0xffff
    let sum = product >>> 16
    product = L[2] * R[3]
    sum += product
    product = (L[3] * R[2]) >>> 0
    sum += product
    this.buffer[0] += sum << 16
    this.buffer[1] = sum >>> 0 < product ? carryBit16 : 0
    this.buffer[1] += sum >>> 16
    this.buffer[1] += L[1] * R[3] + L[2] * R[2] + L[3] * R[1]
    this.buffer[1] +=
      (L[0] * R[3] + L[1] * R[2] + L[2] * R[1] + L[3] * R[0]) << 16
    return this
  }
  _plus(other) {
    const sum = (this.buffer[0] + other.buffer[0]) >>> 0
    this.buffer[1] += other.buffer[1]
    if (sum < this.buffer[0] >>> 0) {
      ++this.buffer[1]
    }
    this.buffer[0] = sum
  }
  lessThan(other) {
    return (
      this.buffer[1] < other.buffer[1] ||
      (this.buffer[1] === other.buffer[1] && this.buffer[0] < other.buffer[0])
    )
  }
  equals(other) {
    return (
      this.buffer[1] === other.buffer[1] && this.buffer[0] == other.buffer[0]
    )
  }
  greaterThan(other) {
    return other.lessThan(this)
  }
  hex() {
    return `${intAsHex(this.buffer[1])} ${intAsHex(this.buffer[0])}`
  }
}
exports.BaseInt64 = BaseInt64
/** @ignore */
class Uint64 extends BaseInt64 {
  times(other) {
    this._times(other)
    return this
  }
  plus(other) {
    this._plus(other)
    return this
  }
  /** @nocollapse */
  static from(val, out_buffer = new Uint32Array(2)) {
    return Uint64.fromString(
      typeof val === "string" ? val : val.toString(),
      out_buffer
    )
  }
  /** @nocollapse */
  static fromNumber(num, out_buffer = new Uint32Array(2)) {
    // Always parse numbers as strings - pulling out high and low bits
    // directly seems to lose precision sometimes
    // For example:
    //     > -4613034156400212000 >>> 0
    //     721782784
    // The correct lower 32-bits are 721782752
    return Uint64.fromString(num.toString(), out_buffer)
  }
  /** @nocollapse */
  static fromString(str, out_buffer = new Uint32Array(2)) {
    const length = str.length
    let out = new Uint64(out_buffer)
    for (let posn = 0; posn < length; ) {
      const group =
        kInt32DecimalDigits < length - posn
          ? kInt32DecimalDigits
          : length - posn
      const chunk = new Uint64(
        new Uint32Array([parseInt(str.substr(posn, group), 10), 0])
      )
      const multiple = new Uint64(new Uint32Array([kPowersOfTen[group], 0]))
      out.times(multiple)
      out.plus(chunk)
      posn += group
    }
    return out
  }
  /** @nocollapse */
  static convertArray(values) {
    const data = new Uint32Array(values.length * 2)
    for (let i = -1, n = values.length; ++i < n; ) {
      Uint64.from(
        values[i],
        new Uint32Array(data.buffer, data.byteOffset + 2 * i * 4, 2)
      )
    }
    return data
  }
  /** @nocollapse */
  static multiply(left, right) {
    let rtrn = new Uint64(new Uint32Array(left.buffer))
    return rtrn.times(right)
  }
  /** @nocollapse */
  static add(left, right) {
    let rtrn = new Uint64(new Uint32Array(left.buffer))
    return rtrn.plus(right)
  }
}
exports.Uint64 = Uint64
/** @ignore */
class Int64 extends BaseInt64 {
  negate() {
    this.buffer[0] = ~this.buffer[0] + 1
    this.buffer[1] = ~this.buffer[1]
    if (this.buffer[0] == 0) {
      ++this.buffer[1]
    }
    return this
  }
  times(other) {
    this._times(other)
    return this
  }
  plus(other) {
    this._plus(other)
    return this
  }
  lessThan(other) {
    // force high bytes to be signed
    const this_high = this.buffer[1] << 0
    const other_high = other.buffer[1] << 0
    return (
      this_high < other_high ||
      (this_high === other_high && this.buffer[0] < other.buffer[0])
    )
  }
  /** @nocollapse */
  static from(val, out_buffer = new Uint32Array(2)) {
    return Int64.fromString(
      typeof val === "string" ? val : val.toString(),
      out_buffer
    )
  }
  /** @nocollapse */
  static fromNumber(num, out_buffer = new Uint32Array(2)) {
    // Always parse numbers as strings - pulling out high and low bits
    // directly seems to lose precision sometimes
    // For example:
    //     > -4613034156400212000 >>> 0
    //     721782784
    // The correct lower 32-bits are 721782752
    return Int64.fromString(num.toString(), out_buffer)
  }
  /** @nocollapse */
  static fromString(str, out_buffer = new Uint32Array(2)) {
    // TODO: Assert that out_buffer is 0 and length = 2
    const negate = str.startsWith("-")
    const length = str.length
    let out = new Int64(out_buffer)
    for (let posn = negate ? 1 : 0; posn < length; ) {
      const group =
        kInt32DecimalDigits < length - posn
          ? kInt32DecimalDigits
          : length - posn
      const chunk = new Int64(
        new Uint32Array([parseInt(str.substr(posn, group), 10), 0])
      )
      const multiple = new Int64(new Uint32Array([kPowersOfTen[group], 0]))
      out.times(multiple)
      out.plus(chunk)
      posn += group
    }
    return negate ? out.negate() : out
  }
  /** @nocollapse */
  static convertArray(values) {
    const data = new Uint32Array(values.length * 2)
    for (let i = -1, n = values.length; ++i < n; ) {
      Int64.from(
        values[i],
        new Uint32Array(data.buffer, data.byteOffset + 2 * i * 4, 2)
      )
    }
    return data
  }
  /** @nocollapse */
  static multiply(left, right) {
    let rtrn = new Int64(new Uint32Array(left.buffer))
    return rtrn.times(right)
  }
  /** @nocollapse */
  static add(left, right) {
    let rtrn = new Int64(new Uint32Array(left.buffer))
    return rtrn.plus(right)
  }
}
exports.Int64 = Int64
/** @ignore */
class Int128 {
  constructor(buffer) {
    this.buffer = buffer
    // buffer[3] MSB (high)
    // buffer[2]
    // buffer[1]
    // buffer[0] LSB (low)
  }
  high() {
    return new Int64(
      new Uint32Array(this.buffer.buffer, this.buffer.byteOffset + 8, 2)
    )
  }
  low() {
    return new Int64(
      new Uint32Array(this.buffer.buffer, this.buffer.byteOffset, 2)
    )
  }
  negate() {
    this.buffer[0] = ~this.buffer[0] + 1
    this.buffer[1] = ~this.buffer[1]
    this.buffer[2] = ~this.buffer[2]
    this.buffer[3] = ~this.buffer[3]
    if (this.buffer[0] == 0) {
      ++this.buffer[1]
    }
    if (this.buffer[1] == 0) {
      ++this.buffer[2]
    }
    if (this.buffer[2] == 0) {
      ++this.buffer[3]
    }
    return this
  }
  times(other) {
    // Break the left and right numbers into 32 bit chunks
    // so that we can multiply them without overflow.
    const L0 = new Uint64(new Uint32Array([this.buffer[3], 0]))
    const L1 = new Uint64(new Uint32Array([this.buffer[2], 0]))
    const L2 = new Uint64(new Uint32Array([this.buffer[1], 0]))
    const L3 = new Uint64(new Uint32Array([this.buffer[0], 0]))
    const R0 = new Uint64(new Uint32Array([other.buffer[3], 0]))
    const R1 = new Uint64(new Uint32Array([other.buffer[2], 0]))
    const R2 = new Uint64(new Uint32Array([other.buffer[1], 0]))
    const R3 = new Uint64(new Uint32Array([other.buffer[0], 0]))
    let product = Uint64.multiply(L3, R3)
    this.buffer[0] = product.low()
    let sum = new Uint64(new Uint32Array([product.high(), 0]))
    product = Uint64.multiply(L2, R3)
    sum.plus(product)
    product = Uint64.multiply(L3, R2)
    sum.plus(product)
    this.buffer[1] = sum.low()
    this.buffer[3] = sum.lessThan(product) ? 1 : 0
    this.buffer[2] = sum.high()
    let high = new Uint64(
      new Uint32Array(this.buffer.buffer, this.buffer.byteOffset + 8, 2)
    )
    high
      .plus(Uint64.multiply(L1, R3))
      .plus(Uint64.multiply(L2, R2))
      .plus(Uint64.multiply(L3, R1))
    this.buffer[3] += Uint64.multiply(L0, R3)
      .plus(Uint64.multiply(L1, R2))
      .plus(Uint64.multiply(L2, R1))
      .plus(Uint64.multiply(L3, R0))
      .low()
    return this
  }
  plus(other) {
    let sums = new Uint32Array(4)
    sums[3] = (this.buffer[3] + other.buffer[3]) >>> 0
    sums[2] = (this.buffer[2] + other.buffer[2]) >>> 0
    sums[1] = (this.buffer[1] + other.buffer[1]) >>> 0
    sums[0] = (this.buffer[0] + other.buffer[0]) >>> 0
    if (sums[0] < this.buffer[0] >>> 0) {
      ++sums[1]
    }
    if (sums[1] < this.buffer[1] >>> 0) {
      ++sums[2]
    }
    if (sums[2] < this.buffer[2] >>> 0) {
      ++sums[3]
    }
    this.buffer[3] = sums[3]
    this.buffer[2] = sums[2]
    this.buffer[1] = sums[1]
    this.buffer[0] = sums[0]
    return this
  }
  hex() {
    return `${intAsHex(this.buffer[3])} ${intAsHex(this.buffer[2])} ${intAsHex(
      this.buffer[1]
    )} ${intAsHex(this.buffer[0])}`
  }
  /** @nocollapse */
  static multiply(left, right) {
    let rtrn = new Int128(new Uint32Array(left.buffer))
    return rtrn.times(right)
  }
  /** @nocollapse */
  static add(left, right) {
    let rtrn = new Int128(new Uint32Array(left.buffer))
    return rtrn.plus(right)
  }
  /** @nocollapse */
  static from(val, out_buffer = new Uint32Array(4)) {
    return Int128.fromString(
      typeof val === "string" ? val : val.toString(),
      out_buffer
    )
  }
  /** @nocollapse */
  static fromNumber(num, out_buffer = new Uint32Array(4)) {
    // Always parse numbers as strings - pulling out high and low bits
    // directly seems to lose precision sometimes
    // For example:
    //     > -4613034156400212000 >>> 0
    //     721782784
    // The correct lower 32-bits are 721782752
    return Int128.fromString(num.toString(), out_buffer)
  }
  /** @nocollapse */
  static fromString(str, out_buffer = new Uint32Array(4)) {
    // TODO: Assert that out_buffer is 0 and length = 4
    const negate = str.startsWith("-")
    const length = str.length
    let out = new Int128(out_buffer)
    for (let posn = negate ? 1 : 0; posn < length; ) {
      const group =
        kInt32DecimalDigits < length - posn
          ? kInt32DecimalDigits
          : length - posn
      const chunk = new Int128(
        new Uint32Array([parseInt(str.substr(posn, group), 10), 0, 0, 0])
      )
      const multiple = new Int128(
        new Uint32Array([kPowersOfTen[group], 0, 0, 0])
      )
      out.times(multiple)
      out.plus(chunk)
      posn += group
    }
    return negate ? out.negate() : out
  }
  /** @nocollapse */
  static convertArray(values) {
    // TODO: Distinguish between string and number at compile-time
    const data = new Uint32Array(values.length * 4)
    for (let i = -1, n = values.length; ++i < n; ) {
      Int128.from(
        values[i],
        new Uint32Array(data.buffer, data.byteOffset + 4 * 4 * i, 4)
      )
    }
    return data
  }
}
exports.Int128 = Int128

//# sourceMappingURL=int.js.map
