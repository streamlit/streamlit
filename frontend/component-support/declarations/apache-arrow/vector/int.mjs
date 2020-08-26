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
import { Data } from "../data"
import { Vector } from "../vector"
import { BaseVector } from "./base"
import { vectorFromValuesWithType } from "./index"
import { BigInt64Array, BigUint64Array } from "../util/compat"
import { toBigInt64Array, toBigUint64Array } from "../util/buffer"
import {
  Uint8,
  Uint16,
  Uint32,
  Uint64,
  Int8,
  Int16,
  Int32,
  Int64,
} from "../type"
/** @ignore */
export class IntVector extends BaseVector {
  /** @nocollapse */
  static from(...args) {
    let [input, is64bit = false] = args
    let ArrowType = vectorTypeToDataType(this, is64bit)
    if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
      let InputType =
        arrayTypeToDataType(input.constructor, is64bit) || ArrowType
      // Special case, infer the Arrow DataType from the input if calling the base
      // IntVector.from with a TypedArray, e.g. `IntVector.from(new Int32Array())`
      if (ArrowType === null) {
        ArrowType = InputType
      }
      // If the DataType inferred from the Vector constructor matches the
      // DataType inferred from the input arguments, return zero-copy view
      if (ArrowType && ArrowType === InputType) {
        let type = new ArrowType()
        let length = input.byteLength / type.ArrayType.BYTES_PER_ELEMENT
        // If the ArrowType is 64bit but the input type is 32bit pairs, update the logical length
        if (convert32To64Bit(ArrowType, input.constructor)) {
          length *= 0.5
        }
        return Vector.new(Data.Int(type, 0, length, 0, null, input))
      }
    }
    if (ArrowType) {
      // If the DataType inferred from the Vector constructor is different than
      // the DataType inferred from the input TypedArray, or if input isn't a
      // TypedArray, use the Builders to construct the result Vector
      return vectorFromValuesWithType(() => new ArrowType(), input)
    }
    if (input instanceof DataView || input instanceof ArrayBuffer) {
      throw new TypeError(
        `Cannot infer integer type from instance of ${input.constructor.name}`
      )
    }
    throw new TypeError("Unrecognized IntVector input")
  }
}
/** @ignore */
export class Int8Vector extends IntVector {}
/** @ignore */
export class Int16Vector extends IntVector {}
/** @ignore */
export class Int32Vector extends IntVector {}
/** @ignore */
export class Int64Vector extends IntVector {
  toBigInt64Array() {
    return toBigInt64Array(this.values)
  }
  get values64() {
    return this._values64 || (this._values64 = this.toBigInt64Array())
  }
}
/** @ignore */
export class Uint8Vector extends IntVector {}
/** @ignore */
export class Uint16Vector extends IntVector {}
/** @ignore */
export class Uint32Vector extends IntVector {}
/** @ignore */
export class Uint64Vector extends IntVector {
  toBigUint64Array() {
    return toBigUint64Array(this.values)
  }
  get values64() {
    return this._values64 || (this._values64 = this.toBigUint64Array())
  }
}
const convert32To64Bit = (typeCtor, dataCtor) => {
  return (
    (typeCtor === Int64 || typeCtor === Uint64) &&
    (dataCtor === Int32Array || dataCtor === Uint32Array)
  )
}
/** @ignore */
const arrayTypeToDataType = (ctor, is64bit) => {
  switch (ctor) {
    case Int8Array:
      return Int8
    case Int16Array:
      return Int16
    case Int32Array:
      return is64bit ? Int64 : Int32
    case BigInt64Array:
      return Int64
    case Uint8Array:
      return Uint8
    case Uint16Array:
      return Uint16
    case Uint32Array:
      return is64bit ? Uint64 : Uint32
    case BigUint64Array:
      return Uint64
    default:
      return null
  }
}
/** @ignore */
const vectorTypeToDataType = (ctor, is64bit) => {
  switch (ctor) {
    case Int8Vector:
      return Int8
    case Int16Vector:
      return Int16
    case Int32Vector:
      return is64bit ? Int64 : Int32
    case Int64Vector:
      return Int64
    case Uint8Vector:
      return Uint8
    case Uint16Vector:
      return Uint16
    case Uint32Vector:
      return is64bit ? Uint64 : Uint32
    case Uint64Vector:
      return Uint64
    default:
      return null
  }
}

//# sourceMappingURL=int.mjs.map
