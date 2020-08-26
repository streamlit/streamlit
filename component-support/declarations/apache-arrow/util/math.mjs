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
const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
/**
 * Convert uint16 (logically a float16) to a JS float64. Inspired by numpy's `npy_half_to_double`:
 * https://github.com/numpy/numpy/blob/5a5987291dc95376bb098be8d8e5391e89e77a2c/numpy/core/src/npymath/halffloat.c#L29
 * @param h {number} the uint16 to convert
 * @private
 * @ignore
 */
export function uint16ToFloat64(h) {
  let expo = (h & 0x7c00) >> 10;
  let sigf = (h & 0x03ff) / 1024;
  let sign = (-1) ** ((h & 0x8000) >> 15);
  switch (expo) {
    case 0x1f:
      return sign * (sigf ? NaN : 1 / 0);
    case 0x00:
      return sign * (sigf ? 6.103515625e-5 * sigf : 0);
  }
  return sign * 2 ** (expo - 15) * (1 + sigf);
}
/**
 * Convert a float64 to uint16 (assuming the float64 is logically a float16). Inspired by numpy's `npy_double_to_half`:
 * https://github.com/numpy/numpy/blob/5a5987291dc95376bb098be8d8e5391e89e77a2c/numpy/core/src/npymath/halffloat.c#L43
 * @param d {number} The float64 to convert
 * @private
 * @ignore
 */
export function float64ToUint16(d) {
  if (d !== d) {
    return 0x7e00;
  } // NaN
  f64[0] = d;
  // Magic numbers:
  // 0x80000000 = 10000000 00000000 00000000 00000000 -- masks the 32nd bit
  // 0x7ff00000 = 01111111 11110000 00000000 00000000 -- masks the 21st-31st bits
  // 0x000fffff = 00000000 00001111 11111111 11111111 -- masks the 1st-20th bit
  let sign = ((u32[1] & 0x80000000) >> 16) & 0xffff;
  let expo = u32[1] & 0x7ff00000,
    sigf = 0x0000;
  if (expo >= 0x40f00000) {
    //
    // If exponent overflowed, the float16 is either NaN or Infinity.
    // Rules to propagate the sign bit: mantissa > 0 ? NaN : +/-Infinity
    //
    // Magic numbers:
    // 0x40F00000 = 01000000 11110000 00000000 00000000 -- 6-bit exponent overflow
    // 0x7C000000 = 01111100 00000000 00000000 00000000 -- masks the 27th-31st bits
    //
    // returns:
    // qNaN, aka 32256 decimal, 0x7E00 hex, or 01111110 00000000 binary
    // sNaN, aka 32000 decimal, 0x7D00 hex, or 01111101 00000000 binary
    // +inf, aka 31744 decimal, 0x7C00 hex, or 01111100 00000000 binary
    // -inf, aka 64512 decimal, 0xFC00 hex, or 11111100 00000000 binary
    //
    // If mantissa is greater than 23 bits, set to +Infinity like numpy
    if (u32[0] > 0) {
      expo = 0x7c00;
    } else {
      expo = (expo & 0x7c000000) >> 16;
      sigf = (u32[1] & 0x000fffff) >> 10;
    }
  } else if (expo <= 0x3f000000) {
    //
    // If exponent underflowed, the float is either signed zero or subnormal.
    //
    // Magic numbers:
    // 0x3F000000 = 00111111 00000000 00000000 00000000 -- 6-bit exponent underflow
    //
    sigf = 0x100000 + (u32[1] & 0x000fffff);
    sigf = (0x100000 + (sigf << ((expo >> 20) - 998))) >> 21;
    expo = 0;
  } else {
    //
    // No overflow or underflow, rebase the exponent and round the mantissa
    // Magic numbers:
    // 0x200 = 00000010 00000000 -- masks off the 10th bit
    //
    // Ensure the first mantissa bit (the 10th one) is 1 and round
    expo = (expo - 0x3f000000) >> 10;
    sigf = ((u32[1] & 0x000fffff) + 0x200) >> 10;
  }
  return sign | expo | (sigf & 0xffff);
}

//# sourceMappingURL=math.mjs.map
