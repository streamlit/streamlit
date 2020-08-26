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
import { toArrayBufferView } from "./buffer";
import { BigIntAvailable, BigInt64Array, BigUint64Array } from "./compat";
/** @ignore */
export const isArrowBigNumSymbol = Symbol.for("isArrowBigNum");
/** @ignore */
function BigNum(x, ...xs) {
  if (xs.length === 0) {
    return Object.setPrototypeOf(
      toArrayBufferView(this["TypedArray"], x),
      this.constructor.prototype
    );
  }
  return Object.setPrototypeOf(
    new this["TypedArray"](x, ...xs),
    this.constructor.prototype
  );
}
BigNum.prototype[isArrowBigNumSymbol] = true;
BigNum.prototype.toJSON = function() {
  return `"${bignumToString(this)}"`;
};
BigNum.prototype.valueOf = function() {
  return bignumToNumber(this);
};
BigNum.prototype.toString = function() {
  return bignumToString(this);
};
BigNum.prototype[Symbol.toPrimitive] = function(hint = "default") {
  switch (hint) {
    case "number":
      return bignumToNumber(this);
    case "string":
      return bignumToString(this);
    case "default":
      return bignumToBigInt(this);
  }
  return bignumToString(this);
};
/** @ignore */
function SignedBigNum(...args) {
  return BigNum.apply(this, args);
}
/** @ignore */
function UnsignedBigNum(...args) {
  return BigNum.apply(this, args);
}
/** @ignore */
function DecimalBigNum(...args) {
  return BigNum.apply(this, args);
}
Object.setPrototypeOf(
  SignedBigNum.prototype,
  Object.create(Int32Array.prototype)
);
Object.setPrototypeOf(
  UnsignedBigNum.prototype,
  Object.create(Uint32Array.prototype)
);
Object.setPrototypeOf(
  DecimalBigNum.prototype,
  Object.create(Uint32Array.prototype)
);
Object.assign(SignedBigNum.prototype, BigNum.prototype, {
  constructor: SignedBigNum,
  signed: true,
  TypedArray: Int32Array,
  BigIntArray: BigInt64Array
});
Object.assign(UnsignedBigNum.prototype, BigNum.prototype, {
  constructor: UnsignedBigNum,
  signed: false,
  TypedArray: Uint32Array,
  BigIntArray: BigUint64Array
});
Object.assign(DecimalBigNum.prototype, BigNum.prototype, {
  constructor: DecimalBigNum,
  signed: true,
  TypedArray: Uint32Array,
  BigIntArray: BigUint64Array
});
/** @ignore */
function bignumToNumber(bn) {
  let { buffer, byteOffset, length, signed: signed } = bn;
  let words = new Int32Array(buffer, byteOffset, length);
  let number = 0,
    i = 0,
    n = words.length,
    hi,
    lo;
  while (i < n) {
    lo = words[i++];
    hi = words[i++];
    signed || (hi = hi >>> 0);
    number += (lo >>> 0) + hi * i ** 32;
  }
  return number;
}
/** @ignore */
export let bignumToString;
/** @ignore */
export let bignumToBigInt;
if (!BigIntAvailable) {
  bignumToString = decimalToString;
  bignumToBigInt = bignumToString;
} else {
  bignumToBigInt = a =>
    a.byteLength === 8
      ? new a["BigIntArray"](a.buffer, a.byteOffset, 1)[0]
      : decimalToString(a);
  bignumToString = a =>
    a.byteLength === 8
      ? `${new a["BigIntArray"](a.buffer, a.byteOffset, 1)[0]}`
      : decimalToString(a);
}
/** @ignore */
function decimalToString(a) {
  let digits = "";
  let base64 = new Uint32Array(2);
  let base32 = new Uint16Array(a.buffer, a.byteOffset, a.byteLength / 2);
  let checks = new Uint32Array(
    (base32 = new Uint16Array(base32).reverse()).buffer
  );
  let i = -1,
    n = base32.length - 1;
  do {
    for (base64[0] = base32[(i = 0)]; i < n; ) {
      base32[i++] = base64[1] = base64[0] / 10;
      base64[0] = ((base64[0] - base64[1] * 10) << 16) + base32[i];
    }
    base32[i] = base64[1] = base64[0] / 10;
    base64[0] = base64[0] - base64[1] * 10;
    digits = `${base64[0]}${digits}`;
  } while (checks[0] || checks[1] || checks[2] || checks[3]);
  return digits ? digits : `0`;
}
/** @ignore */
export class BN {
  constructor(num, isSigned) {
    return BN.new(num, isSigned);
  }
  /** @nocollapse */
  static new(num, isSigned) {
    switch (isSigned) {
      case true:
        return new SignedBigNum(num);
      case false:
        return new UnsignedBigNum(num);
    }
    switch (num.constructor) {
      case Int8Array:
      case Int16Array:
      case Int32Array:
      case BigInt64Array:
        return new SignedBigNum(num);
    }
    if (num.byteLength === 16) {
      return new DecimalBigNum(num);
    }
    return new UnsignedBigNum(num);
  }
  /** @nocollapse */
  static signed(num) {
    return new SignedBigNum(num);
  }
  /** @nocollapse */
  static unsigned(num) {
    return new UnsignedBigNum(num);
  }
  /** @nocollapse */
  static decimal(num) {
    return new DecimalBigNum(num);
  }
}

//# sourceMappingURL=bn.mjs.map
