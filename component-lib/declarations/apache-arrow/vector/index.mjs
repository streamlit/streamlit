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
export { Vector } from "../vector";
export { BaseVector } from "./base";
export { BinaryVector } from "./binary";
export { BoolVector } from "./bool";
export { Chunked } from "./chunked";
export { DateVector, DateDayVector, DateMillisecondVector } from "./date";
export { DecimalVector } from "./decimal";
export { DictionaryVector } from "./dictionary";
export { FixedSizeBinaryVector } from "./fixedsizebinary";
export { FixedSizeListVector } from "./fixedsizelist";
export {
  FloatVector,
  Float16Vector,
  Float32Vector,
  Float64Vector
} from "./float";
export {
  IntervalVector,
  IntervalDayTimeVector,
  IntervalYearMonthVector
} from "./interval";
export {
  IntVector,
  Int8Vector,
  Int16Vector,
  Int32Vector,
  Int64Vector,
  Uint8Vector,
  Uint16Vector,
  Uint32Vector,
  Uint64Vector
} from "./int";
export { ListVector } from "./list";
export { MapVector } from "./map";
export { NullVector } from "./null";
export { StructVector } from "./struct";
export {
  TimestampVector,
  TimestampSecondVector,
  TimestampMillisecondVector,
  TimestampMicrosecondVector,
  TimestampNanosecondVector
} from "./timestamp";
export {
  TimeVector,
  TimeSecondVector,
  TimeMillisecondVector,
  TimeMicrosecondVector,
  TimeNanosecondVector
} from "./time";
export { UnionVector, DenseUnionVector, SparseUnionVector } from "./union";
export { Utf8Vector } from "./utf8";
export { MapRow, StructRow } from "./row";
import * as fn from "../util/fn";
import { Type } from "../enum";
import { Vector } from "../vector";
import { Chunked } from "./chunked";
import { BaseVector } from "./base";
import { setBool } from "../util/bit";
import { isIterable, isAsyncIterable } from "../util/compat";
import { Builder } from "../builder";
import { instance as getVisitor } from "../visitor/get";
import { instance as setVisitor } from "../visitor/set";
import { instance as indexOfVisitor } from "../visitor/indexof";
import { instance as toArrayVisitor } from "../visitor/toarray";
import { instance as iteratorVisitor } from "../visitor/iterator";
import { instance as byteWidthVisitor } from "../visitor/bytewidth";
import { instance as getVectorConstructor } from "../visitor/vectorctor";
/** @nocollapse */
Vector.new = newVector;
/** @nocollapse */
Vector.from = vectorFrom;
/** @ignore */
function newVector(data, ...args) {
  return new (getVectorConstructor.getVisitFn(data)())(data, ...args);
}
/** @ignore */
export function vectorFromValuesWithType(newDataType, input) {
  if (isIterable(input)) {
    return Vector.from({
      nullValues: [null, undefined],
      type: newDataType(),
      values: input
    });
  } else if (isAsyncIterable(input)) {
    return Vector.from({
      nullValues: [null, undefined],
      type: newDataType(),
      values: input
    });
  }
  const {
    values: values = [],
    type: type = newDataType(),
    nullValues: nullValues = [null, undefined]
  } = { ...input };
  return isIterable(values)
    ? Vector.from({ nullValues, ...input, type })
    : Vector.from({ nullValues, ...input, type });
}
function vectorFrom(input) {
  const { values: values = [], ...options } = {
    nullValues: [null, undefined],
    ...input
  };
  if (isIterable(values)) {
    const chunks = [...Builder.throughIterable(options)(values)];
    return chunks.length === 1 ? chunks[0] : Chunked.concat(chunks);
  }
  return (async chunks => {
    const transform = Builder.throughAsyncIterable(options);
    for await (const chunk of transform(values)) {
      chunks.push(chunk);
    }
    return chunks.length === 1 ? chunks[0] : Chunked.concat(chunks);
  })([]);
}
//
// We provide the following method implementations for code navigability purposes only.
// They're overridden at runtime below with the specific Visitor implementation for each type,
// short-circuiting the usual Visitor traversal and reducing intermediate lookups and calls.
// This comment is here to remind you to not set breakpoints in these function bodies, or to inform
// you why the breakpoints you have already set are not being triggered. Have a great day!
//
BaseVector.prototype.get = function baseVectorGet(index) {
  return getVisitor.visit(this, index);
};
BaseVector.prototype.set = function baseVectorSet(index, value) {
  return setVisitor.visit(this, index, value);
};
BaseVector.prototype.indexOf = function baseVectorIndexOf(value, fromIndex) {
  return indexOfVisitor.visit(this, value, fromIndex);
};
BaseVector.prototype.toArray = function baseVectorToArray() {
  return toArrayVisitor.visit(this);
};
BaseVector.prototype.getByteWidth = function baseVectorGetByteWidth() {
  return byteWidthVisitor.visit(this.type);
};
BaseVector.prototype[Symbol.iterator] = function baseVectorSymbolIterator() {
  return iteratorVisitor.visit(this);
};
BaseVector.prototype._bindDataAccessors = bindBaseVectorDataAccessors;
// Perf: bind and assign the operator Visitor methods to each of the Vector subclasses for each Type
Object.keys(Type)
  .map(T => Type[T])
  .filter(T => typeof T === "number")
  .filter(typeId => typeId !== Type.NONE)
  .forEach(typeId => {
    const VectorCtor = getVectorConstructor.visit(typeId);
    VectorCtor.prototype["get"] = fn.partial1(getVisitor.getVisitFn(typeId));
    VectorCtor.prototype["set"] = fn.partial2(setVisitor.getVisitFn(typeId));
    VectorCtor.prototype["indexOf"] = fn.partial2(
      indexOfVisitor.getVisitFn(typeId)
    );
    VectorCtor.prototype["toArray"] = fn.partial0(
      toArrayVisitor.getVisitFn(typeId)
    );
    VectorCtor.prototype["getByteWidth"] = partialType0(
      byteWidthVisitor.getVisitFn(typeId)
    );
    VectorCtor.prototype[Symbol.iterator] = fn.partial0(
      iteratorVisitor.getVisitFn(typeId)
    );
  });
/** @ignore */
function partialType0(visit) {
  return function() {
    return visit(this.type);
  };
}
/** @ignore */
function wrapNullableGet(fn) {
  return function(i) {
    return this.isValid(i) ? fn.call(this, i) : null;
  };
}
/** @ignore */
function wrapNullableSet(fn) {
  return function(i, a) {
    if (
      setBool(
        this.nullBitmap,
        this.offset + i,
        !(a === null || a === undefined)
      )
    ) {
      fn.call(this, i, a);
    }
  };
}
/** @ignore */
function bindBaseVectorDataAccessors() {
  const nullBitmap = this.nullBitmap;
  if (nullBitmap && nullBitmap.byteLength > 0) {
    this.get = wrapNullableGet(this.get);
    this.set = wrapNullableSet(this.set);
  }
}

//# sourceMappingURL=index.mjs.map
