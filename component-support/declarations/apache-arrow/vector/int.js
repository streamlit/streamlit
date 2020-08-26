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
const data_1 = require("../data");
const vector_1 = require("../vector");
const base_1 = require("./base");
const index_1 = require("./index");
const compat_1 = require("../util/compat");
const buffer_1 = require("../util/buffer");
const type_1 = require("../type");
/** @ignore */
class IntVector extends base_1.BaseVector {
  /** @nocollapse */
  static from(...args) {
    let [input, is64bit = false] = args;
    let ArrowType = vectorTypeToDataType(this, is64bit);
    if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
      let InputType =
        arrayTypeToDataType(input.constructor, is64bit) || ArrowType;
      // Special case, infer the Arrow DataType from the input if calling the base
      // IntVector.from with a TypedArray, e.g. `IntVector.from(new Int32Array())`
      if (ArrowType === null) {
        ArrowType = InputType;
      }
      // If the DataType inferred from the Vector constructor matches the
      // DataType inferred from the input arguments, return zero-copy view
      if (ArrowType && ArrowType === InputType) {
        let type = new ArrowType();
        let length = input.byteLength / type.ArrayType.BYTES_PER_ELEMENT;
        // If the ArrowType is 64bit but the input type is 32bit pairs, update the logical length
        if (convert32To64Bit(ArrowType, input.constructor)) {
          length *= 0.5;
        }
        return vector_1.Vector.new(
          data_1.Data.Int(type, 0, length, 0, null, input)
        );
      }
    }
    if (ArrowType) {
      // If the DataType inferred from the Vector constructor is different than
      // the DataType inferred from the input TypedArray, or if input isn't a
      // TypedArray, use the Builders to construct the result Vector
      return index_1.vectorFromValuesWithType(() => new ArrowType(), input);
    }
    if (input instanceof DataView || input instanceof ArrayBuffer) {
      throw new TypeError(
        `Cannot infer integer type from instance of ${input.constructor.name}`
      );
    }
    throw new TypeError("Unrecognized IntVector input");
  }
}
exports.IntVector = IntVector;
/** @ignore */
class Int8Vector extends IntVector {}
exports.Int8Vector = Int8Vector;
/** @ignore */
class Int16Vector extends IntVector {}
exports.Int16Vector = Int16Vector;
/** @ignore */
class Int32Vector extends IntVector {}
exports.Int32Vector = Int32Vector;
/** @ignore */
class Int64Vector extends IntVector {
  toBigInt64Array() {
    return buffer_1.toBigInt64Array(this.values);
  }
  get values64() {
    return this._values64 || (this._values64 = this.toBigInt64Array());
  }
}
exports.Int64Vector = Int64Vector;
/** @ignore */
class Uint8Vector extends IntVector {}
exports.Uint8Vector = Uint8Vector;
/** @ignore */
class Uint16Vector extends IntVector {}
exports.Uint16Vector = Uint16Vector;
/** @ignore */
class Uint32Vector extends IntVector {}
exports.Uint32Vector = Uint32Vector;
/** @ignore */
class Uint64Vector extends IntVector {
  toBigUint64Array() {
    return buffer_1.toBigUint64Array(this.values);
  }
  get values64() {
    return this._values64 || (this._values64 = this.toBigUint64Array());
  }
}
exports.Uint64Vector = Uint64Vector;
const convert32To64Bit = (typeCtor, dataCtor) => {
  return (
    (typeCtor === type_1.Int64 || typeCtor === type_1.Uint64) &&
    (dataCtor === Int32Array || dataCtor === Uint32Array)
  );
};
/** @ignore */
const arrayTypeToDataType = (ctor, is64bit) => {
  switch (ctor) {
    case Int8Array:
      return type_1.Int8;
    case Int16Array:
      return type_1.Int16;
    case Int32Array:
      return is64bit ? type_1.Int64 : type_1.Int32;
    case compat_1.BigInt64Array:
      return type_1.Int64;
    case Uint8Array:
      return type_1.Uint8;
    case Uint16Array:
      return type_1.Uint16;
    case Uint32Array:
      return is64bit ? type_1.Uint64 : type_1.Uint32;
    case compat_1.BigUint64Array:
      return type_1.Uint64;
    default:
      return null;
  }
};
/** @ignore */
const vectorTypeToDataType = (ctor, is64bit) => {
  switch (ctor) {
    case Int8Vector:
      return type_1.Int8;
    case Int16Vector:
      return type_1.Int16;
    case Int32Vector:
      return is64bit ? type_1.Int64 : type_1.Int32;
    case Int64Vector:
      return type_1.Int64;
    case Uint8Vector:
      return type_1.Uint8;
    case Uint16Vector:
      return type_1.Uint16;
    case Uint32Vector:
      return is64bit ? type_1.Uint64 : type_1.Uint32;
    case Uint64Vector:
      return type_1.Uint64;
    default:
      return null;
  }
};

//# sourceMappingURL=int.js.map
