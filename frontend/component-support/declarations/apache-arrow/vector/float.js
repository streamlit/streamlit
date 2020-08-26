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
const data_1 = require("../data")
const vector_1 = require("../vector")
const base_1 = require("./base")
const index_1 = require("./index")
const type_1 = require("../type")
/** @ignore */
class FloatVector extends base_1.BaseVector {
  /** @nocollapse */
  static from(input) {
    let ArrowType = vectorTypeToDataType(this)
    if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
      let InputType = arrayTypeToDataType(input.constructor) || ArrowType
      // Special case, infer the Arrow DataType from the input if calling the base
      // FloatVector.from with a TypedArray, e.g. `FloatVector.from(new Float32Array())`
      if (ArrowType === null) {
        ArrowType = InputType
      }
      // If the DataType inferred from the Vector constructor matches the
      // DataType inferred from the input arguments, return zero-copy view
      if (ArrowType && ArrowType === InputType) {
        let type = new ArrowType()
        let length = input.byteLength / type.ArrayType.BYTES_PER_ELEMENT
        // If the ArrowType is Float16 but the input type isn't a Uint16Array,
        // let the Float16Builder handle casting the input values to Uint16s.
        if (!convertTo16Bit(ArrowType, input.constructor)) {
          return vector_1.Vector.new(
            data_1.Data.Float(type, 0, length, 0, null, input)
          )
        }
      }
    }
    if (ArrowType) {
      // If the DataType inferred from the Vector constructor is different than
      // the DataType inferred from the input TypedArray, or if input isn't a
      // TypedArray, use the Builders to construct the result Vector
      return index_1.vectorFromValuesWithType(() => new ArrowType(), input)
    }
    if (input instanceof DataView || input instanceof ArrayBuffer) {
      throw new TypeError(
        `Cannot infer float type from instance of ${input.constructor.name}`
      )
    }
    throw new TypeError("Unrecognized FloatVector input")
  }
}
exports.FloatVector = FloatVector
/** @ignore */
class Float16Vector extends FloatVector {
  // Since JS doesn't have half floats, `toArray()` returns a zero-copy slice
  // of the underlying Uint16Array data. This behavior ensures we don't incur
  // extra compute or copies if you're calling `toArray()` in order to create
  // a buffer for something like WebGL. Buf if you're using JS and want typed
  // arrays of 4-to-8-byte precision, these methods will enumerate the values
  // and clamp to the desired byte lengths.
  toFloat32Array() {
    return new Float32Array(this)
  }
  toFloat64Array() {
    return new Float64Array(this)
  }
}
exports.Float16Vector = Float16Vector
/** @ignore */
class Float32Vector extends FloatVector {}
exports.Float32Vector = Float32Vector
/** @ignore */
class Float64Vector extends FloatVector {}
exports.Float64Vector = Float64Vector
const convertTo16Bit = (typeCtor, dataCtor) => {
  return typeCtor === type_1.Float16 && dataCtor !== Uint16Array
}
/** @ignore */
const arrayTypeToDataType = ctor => {
  switch (ctor) {
    case Uint16Array:
      return type_1.Float16
    case Float32Array:
      return type_1.Float32
    case Float64Array:
      return type_1.Float64
    default:
      return null
  }
}
/** @ignore */
const vectorTypeToDataType = ctor => {
  switch (ctor) {
    case Float16Vector:
      return type_1.Float16
    case Float32Vector:
      return type_1.Float32
    case Float64Vector:
      return type_1.Float64
    default:
      return null
  }
}

//# sourceMappingURL=float.js.map
