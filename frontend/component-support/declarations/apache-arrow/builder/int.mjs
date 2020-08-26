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
import { bignumToBigInt } from "../util/bn"
import { WideBufferBuilder } from "./buffer"
import { BigInt64Array } from "../util/compat"
import { FixedWidthBuilder } from "../builder"
/** @ignore */
export class IntBuilder extends FixedWidthBuilder {
  setValue(index, value) {
    this._values.set(index, value)
  }
}
/** @ignore */
export class Int8Builder extends IntBuilder {}
/** @ignore */
export class Int16Builder extends IntBuilder {}
/** @ignore */
export class Int32Builder extends IntBuilder {}
/** @ignore */
export class Int64Builder extends IntBuilder {
  constructor(options) {
    if (options["nullValues"]) {
      options["nullValues"] = options["nullValues"].map(toBigInt)
    }
    super(options)
    this._values = new WideBufferBuilder(new Int32Array(0), 2)
  }
  get values64() {
    return this._values.buffer64
  }
  isValid(value) {
    return super.isValid(toBigInt(value))
  }
}
/** @ignore */
export class Uint8Builder extends IntBuilder {}
/** @ignore */
export class Uint16Builder extends IntBuilder {}
/** @ignore */
export class Uint32Builder extends IntBuilder {}
/** @ignore */
export class Uint64Builder extends IntBuilder {
  constructor(options) {
    if (options["nullValues"]) {
      options["nullValues"] = options["nullValues"].map(toBigInt)
    }
    super(options)
    this._values = new WideBufferBuilder(new Uint32Array(0), 2)
  }
  get values64() {
    return this._values.buffer64
  }
  isValid(value) {
    return super.isValid(toBigInt(value))
  }
}
const toBigInt = (memo => value => {
  if (ArrayBuffer.isView(value)) {
    memo.buffer = value.buffer
    memo.byteOffset = value.byteOffset
    memo.byteLength = value.byteLength
    value = bignumToBigInt(memo)
    memo.buffer = null
  }
  return value
})({ BigIntArray: BigInt64Array })

//# sourceMappingURL=int.mjs.map
