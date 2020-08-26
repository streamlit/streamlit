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
const bn_1 = require("../util/bn");
const buffer_1 = require("./buffer");
const compat_1 = require("../util/compat");
const builder_1 = require("../builder");
/** @ignore */
class IntBuilder extends builder_1.FixedWidthBuilder {
  setValue(index, value) {
    this._values.set(index, value);
  }
}
exports.IntBuilder = IntBuilder;
/** @ignore */
class Int8Builder extends IntBuilder {}
exports.Int8Builder = Int8Builder;
/** @ignore */
class Int16Builder extends IntBuilder {}
exports.Int16Builder = Int16Builder;
/** @ignore */
class Int32Builder extends IntBuilder {}
exports.Int32Builder = Int32Builder;
/** @ignore */
class Int64Builder extends IntBuilder {
  constructor(options) {
    if (options["nullValues"]) {
      options["nullValues"] = options["nullValues"].map(toBigInt);
    }
    super(options);
    this._values = new buffer_1.WideBufferBuilder(new Int32Array(0), 2);
  }
  get values64() {
    return this._values.buffer64;
  }
  isValid(value) {
    return super.isValid(toBigInt(value));
  }
}
exports.Int64Builder = Int64Builder;
/** @ignore */
class Uint8Builder extends IntBuilder {}
exports.Uint8Builder = Uint8Builder;
/** @ignore */
class Uint16Builder extends IntBuilder {}
exports.Uint16Builder = Uint16Builder;
/** @ignore */
class Uint32Builder extends IntBuilder {}
exports.Uint32Builder = Uint32Builder;
/** @ignore */
class Uint64Builder extends IntBuilder {
  constructor(options) {
    if (options["nullValues"]) {
      options["nullValues"] = options["nullValues"].map(toBigInt);
    }
    super(options);
    this._values = new buffer_1.WideBufferBuilder(new Uint32Array(0), 2);
  }
  get values64() {
    return this._values.buffer64;
  }
  isValid(value) {
    return super.isValid(toBigInt(value));
  }
}
exports.Uint64Builder = Uint64Builder;
const toBigInt = (memo => value => {
  if (ArrayBuffer.isView(value)) {
    memo.buffer = value.buffer;
    memo.byteOffset = value.byteOffset;
    memo.byteLength = value.byteLength;
    value = bn_1.bignumToBigInt(memo);
    memo.buffer = null;
  }
  return value;
})({ BigIntArray: compat_1.BigInt64Array });

//# sourceMappingURL=int.js.map
