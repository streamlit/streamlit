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
import { instance as comparer } from "./visitor/typecomparator";
import {
  Type,
  Precision,
  UnionMode,
  DateUnit,
  TimeUnit,
  IntervalUnit
} from "./enum";
/**
 * An abstract base class for classes that encapsulate metadata about each of
 * the logical types that Arrow can represent.
 */
export class DataType {
  /** @nocollapse */ static isNull(x) {
    return x && x.typeId === Type.Null;
  }
  /** @nocollapse */ static isInt(x) {
    return x && x.typeId === Type.Int;
  }
  /** @nocollapse */ static isFloat(x) {
    return x && x.typeId === Type.Float;
  }
  /** @nocollapse */ static isBinary(x) {
    return x && x.typeId === Type.Binary;
  }
  /** @nocollapse */ static isUtf8(x) {
    return x && x.typeId === Type.Utf8;
  }
  /** @nocollapse */ static isBool(x) {
    return x && x.typeId === Type.Bool;
  }
  /** @nocollapse */ static isDecimal(x) {
    return x && x.typeId === Type.Decimal;
  }
  /** @nocollapse */ static isDate(x) {
    return x && x.typeId === Type.Date;
  }
  /** @nocollapse */ static isTime(x) {
    return x && x.typeId === Type.Time;
  }
  /** @nocollapse */ static isTimestamp(x) {
    return x && x.typeId === Type.Timestamp;
  }
  /** @nocollapse */ static isInterval(x) {
    return x && x.typeId === Type.Interval;
  }
  /** @nocollapse */ static isList(x) {
    return x && x.typeId === Type.List;
  }
  /** @nocollapse */ static isStruct(x) {
    return x && x.typeId === Type.Struct;
  }
  /** @nocollapse */ static isUnion(x) {
    return x && x.typeId === Type.Union;
  }
  /** @nocollapse */ static isFixedSizeBinary(x) {
    return x && x.typeId === Type.FixedSizeBinary;
  }
  /** @nocollapse */ static isFixedSizeList(x) {
    return x && x.typeId === Type.FixedSizeList;
  }
  /** @nocollapse */ static isMap(x) {
    return x && x.typeId === Type.Map;
  }
  /** @nocollapse */ static isDictionary(x) {
    return x && x.typeId === Type.Dictionary;
  }
  get typeId() {
    return Type.NONE;
  }
  compareTo(other) {
    return comparer.visit(this, other);
  }
}
DataType[Symbol.toStringTag] = (proto => {
  proto.children = null;
  proto.ArrayType = Array;
  return (proto[Symbol.toStringTag] = "DataType");
})(DataType.prototype);
/** @ignore */
export class Null extends DataType {
  toString() {
    return `Null`;
  }
  get typeId() {
    return Type.Null;
  }
}
Null[Symbol.toStringTag] = (proto => {
  return (proto[Symbol.toStringTag] = "Null");
})(Null.prototype);
/** @ignore */
class Int_ extends DataType {
  constructor(isSigned, bitWidth) {
    super();
    this.isSigned = isSigned;
    this.bitWidth = bitWidth;
  }
  get typeId() {
    return Type.Int;
  }
  get ArrayType() {
    switch (this.bitWidth) {
      case 8:
        return this.isSigned ? Int8Array : Uint8Array;
      case 16:
        return this.isSigned ? Int16Array : Uint16Array;
      case 32:
        return this.isSigned ? Int32Array : Uint32Array;
      case 64:
        return this.isSigned ? Int32Array : Uint32Array;
    }
    throw new Error(`Unrecognized ${this[Symbol.toStringTag]} type`);
  }
  toString() {
    return `${this.isSigned ? `I` : `Ui`}nt${this.bitWidth}`;
  }
}
Int_[Symbol.toStringTag] = (proto => {
  proto.isSigned = null;
  proto.bitWidth = null;
  return (proto[Symbol.toStringTag] = "Int");
})(Int_.prototype);
export { Int_ as Int };
/** @ignore */
export class Int8 extends Int_ {
  constructor() {
    super(true, 8);
  }
}
/** @ignore */
export class Int16 extends Int_ {
  constructor() {
    super(true, 16);
  }
}
/** @ignore */
export class Int32 extends Int_ {
  constructor() {
    super(true, 32);
  }
}
/** @ignore */
export class Int64 extends Int_ {
  constructor() {
    super(true, 64);
  }
}
/** @ignore */
export class Uint8 extends Int_ {
  constructor() {
    super(false, 8);
  }
}
/** @ignore */
export class Uint16 extends Int_ {
  constructor() {
    super(false, 16);
  }
}
/** @ignore */
export class Uint32 extends Int_ {
  constructor() {
    super(false, 32);
  }
}
/** @ignore */
export class Uint64 extends Int_ {
  constructor() {
    super(false, 64);
  }
}
Object.defineProperty(Int8.prototype, "ArrayType", { value: Int8Array });
Object.defineProperty(Int16.prototype, "ArrayType", { value: Int16Array });
Object.defineProperty(Int32.prototype, "ArrayType", { value: Int32Array });
Object.defineProperty(Int64.prototype, "ArrayType", { value: Int32Array });
Object.defineProperty(Uint8.prototype, "ArrayType", { value: Uint8Array });
Object.defineProperty(Uint16.prototype, "ArrayType", { value: Uint16Array });
Object.defineProperty(Uint32.prototype, "ArrayType", { value: Uint32Array });
Object.defineProperty(Uint64.prototype, "ArrayType", { value: Uint32Array });
/** @ignore */
export class Float extends DataType {
  constructor(precision) {
    super();
    this.precision = precision;
  }
  get typeId() {
    return Type.Float;
  }
  get ArrayType() {
    switch (this.precision) {
      case Precision.HALF:
        return Uint16Array;
      case Precision.SINGLE:
        return Float32Array;
      case Precision.DOUBLE:
        return Float64Array;
    }
    throw new Error(`Unrecognized ${this[Symbol.toStringTag]} type`);
  }
  toString() {
    return `Float${this.precision << 5 || 16}`;
  }
}
Float[Symbol.toStringTag] = (proto => {
  proto.precision = null;
  return (proto[Symbol.toStringTag] = "Float");
})(Float.prototype);
/** @ignore */
export class Float16 extends Float {
  constructor() {
    super(Precision.HALF);
  }
}
/** @ignore */
export class Float32 extends Float {
  constructor() {
    super(Precision.SINGLE);
  }
}
/** @ignore */
export class Float64 extends Float {
  constructor() {
    super(Precision.DOUBLE);
  }
}
Object.defineProperty(Float16.prototype, "ArrayType", { value: Uint16Array });
Object.defineProperty(Float32.prototype, "ArrayType", { value: Float32Array });
Object.defineProperty(Float64.prototype, "ArrayType", { value: Float64Array });
/** @ignore */
export class Binary extends DataType {
  constructor() {
    super();
  }
  get typeId() {
    return Type.Binary;
  }
  toString() {
    return `Binary`;
  }
}
Binary[Symbol.toStringTag] = (proto => {
  proto.ArrayType = Uint8Array;
  return (proto[Symbol.toStringTag] = "Binary");
})(Binary.prototype);
/** @ignore */
export class Utf8 extends DataType {
  constructor() {
    super();
  }
  get typeId() {
    return Type.Utf8;
  }
  toString() {
    return `Utf8`;
  }
}
Utf8[Symbol.toStringTag] = (proto => {
  proto.ArrayType = Uint8Array;
  return (proto[Symbol.toStringTag] = "Utf8");
})(Utf8.prototype);
/** @ignore */
export class Bool extends DataType {
  constructor() {
    super();
  }
  get typeId() {
    return Type.Bool;
  }
  toString() {
    return `Bool`;
  }
}
Bool[Symbol.toStringTag] = (proto => {
  proto.ArrayType = Uint8Array;
  return (proto[Symbol.toStringTag] = "Bool");
})(Bool.prototype);
/** @ignore */
export class Decimal extends DataType {
  constructor(scale, precision) {
    super();
    this.scale = scale;
    this.precision = precision;
  }
  get typeId() {
    return Type.Decimal;
  }
  toString() {
    return `Decimal[${this.precision}e${this.scale > 0 ? `+` : ``}${
      this.scale
    }]`;
  }
}
Decimal[Symbol.toStringTag] = (proto => {
  proto.scale = null;
  proto.precision = null;
  proto.ArrayType = Uint32Array;
  return (proto[Symbol.toStringTag] = "Decimal");
})(Decimal.prototype);
/** @ignore */
export class Date_ extends DataType {
  constructor(unit) {
    super();
    this.unit = unit;
  }
  get typeId() {
    return Type.Date;
  }
  toString() {
    return `Date${(this.unit + 1) * 32}<${DateUnit[this.unit]}>`;
  }
}
Date_[Symbol.toStringTag] = (proto => {
  proto.unit = null;
  proto.ArrayType = Int32Array;
  return (proto[Symbol.toStringTag] = "Date");
})(Date_.prototype);
/** @ignore */
export class DateDay extends Date_ {
  constructor() {
    super(DateUnit.DAY);
  }
}
/** @ignore */
export class DateMillisecond extends Date_ {
  constructor() {
    super(DateUnit.MILLISECOND);
  }
}
/** @ignore */
class Time_ extends DataType {
  constructor(unit, bitWidth) {
    super();
    this.unit = unit;
    this.bitWidth = bitWidth;
  }
  get typeId() {
    return Type.Time;
  }
  toString() {
    return `Time${this.bitWidth}<${TimeUnit[this.unit]}>`;
  }
}
Time_[Symbol.toStringTag] = (proto => {
  proto.unit = null;
  proto.bitWidth = null;
  proto.ArrayType = Int32Array;
  return (proto[Symbol.toStringTag] = "Time");
})(Time_.prototype);
export { Time_ as Time };
/** @ignore */
export class TimeSecond extends Time_ {
  constructor() {
    super(TimeUnit.SECOND, 32);
  }
}
/** @ignore */
export class TimeMillisecond extends Time_ {
  constructor() {
    super(TimeUnit.MILLISECOND, 32);
  }
}
/** @ignore */
export class TimeMicrosecond extends Time_ {
  constructor() {
    super(TimeUnit.MICROSECOND, 64);
  }
}
/** @ignore */
export class TimeNanosecond extends Time_ {
  constructor() {
    super(TimeUnit.NANOSECOND, 64);
  }
}
/** @ignore */
class Timestamp_ extends DataType {
  constructor(unit, timezone) {
    super();
    this.unit = unit;
    this.timezone = timezone;
  }
  get typeId() {
    return Type.Timestamp;
  }
  toString() {
    return `Timestamp<${TimeUnit[this.unit]}${
      this.timezone ? `, ${this.timezone}` : ``
    }>`;
  }
}
Timestamp_[Symbol.toStringTag] = (proto => {
  proto.unit = null;
  proto.timezone = null;
  proto.ArrayType = Int32Array;
  return (proto[Symbol.toStringTag] = "Timestamp");
})(Timestamp_.prototype);
export { Timestamp_ as Timestamp };
/** @ignore */
export class TimestampSecond extends Timestamp_ {
  constructor(timezone) {
    super(TimeUnit.SECOND, timezone);
  }
}
/** @ignore */
export class TimestampMillisecond extends Timestamp_ {
  constructor(timezone) {
    super(TimeUnit.MILLISECOND, timezone);
  }
}
/** @ignore */
export class TimestampMicrosecond extends Timestamp_ {
  constructor(timezone) {
    super(TimeUnit.MICROSECOND, timezone);
  }
}
/** @ignore */
export class TimestampNanosecond extends Timestamp_ {
  constructor(timezone) {
    super(TimeUnit.NANOSECOND, timezone);
  }
}
/** @ignore */
class Interval_ extends DataType {
  constructor(unit) {
    super();
    this.unit = unit;
  }
  get typeId() {
    return Type.Interval;
  }
  toString() {
    return `Interval<${IntervalUnit[this.unit]}>`;
  }
}
Interval_[Symbol.toStringTag] = (proto => {
  proto.unit = null;
  proto.ArrayType = Int32Array;
  return (proto[Symbol.toStringTag] = "Interval");
})(Interval_.prototype);
export { Interval_ as Interval };
/** @ignore */
export class IntervalDayTime extends Interval_ {
  constructor() {
    super(IntervalUnit.DAY_TIME);
  }
}
/** @ignore */
export class IntervalYearMonth extends Interval_ {
  constructor() {
    super(IntervalUnit.YEAR_MONTH);
  }
}
/** @ignore */
export class List extends DataType {
  constructor(child) {
    super();
    this.children = [child];
  }
  get typeId() {
    return Type.List;
  }
  toString() {
    return `List<${this.valueType}>`;
  }
  get valueType() {
    return this.children[0].type;
  }
  get valueField() {
    return this.children[0];
  }
  get ArrayType() {
    return this.valueType.ArrayType;
  }
}
List[Symbol.toStringTag] = (proto => {
  proto.children = null;
  return (proto[Symbol.toStringTag] = "List");
})(List.prototype);
/** @ignore */
export class Struct extends DataType {
  constructor(children) {
    super();
    this.children = children;
  }
  get typeId() {
    return Type.Struct;
  }
  toString() {
    return `Struct<{${this.children
      .map(f => `${f.name}:${f.type}`)
      .join(`, `)}}>`;
  }
}
Struct[Symbol.toStringTag] = (proto => {
  proto.children = null;
  return (proto[Symbol.toStringTag] = "Struct");
})(Struct.prototype);
/** @ignore */
class Union_ extends DataType {
  constructor(mode, typeIds, children) {
    super();
    this.mode = mode;
    this.children = children;
    this.typeIds = typeIds = Int32Array.from(typeIds);
    this.typeIdToChildIndex = typeIds.reduce(
      (typeIdToChildIndex, typeId, idx) => {
        return (
          ((typeIdToChildIndex[typeId] = idx) && typeIdToChildIndex) ||
          typeIdToChildIndex
        );
      },
      Object.create(null)
    );
  }
  get typeId() {
    return Type.Union;
  }
  toString() {
    return `${this[Symbol.toStringTag]}<${this.children
      .map(x => `${x.type}`)
      .join(` | `)}>`;
  }
}
Union_[Symbol.toStringTag] = (proto => {
  proto.mode = null;
  proto.typeIds = null;
  proto.children = null;
  proto.typeIdToChildIndex = null;
  proto.ArrayType = Int8Array;
  return (proto[Symbol.toStringTag] = "Union");
})(Union_.prototype);
export { Union_ as Union };
/** @ignore */
export class DenseUnion extends Union_ {
  constructor(typeIds, children) {
    super(UnionMode.Dense, typeIds, children);
  }
}
/** @ignore */
export class SparseUnion extends Union_ {
  constructor(typeIds, children) {
    super(UnionMode.Sparse, typeIds, children);
  }
}
/** @ignore */
export class FixedSizeBinary extends DataType {
  constructor(byteWidth) {
    super();
    this.byteWidth = byteWidth;
  }
  get typeId() {
    return Type.FixedSizeBinary;
  }
  toString() {
    return `FixedSizeBinary[${this.byteWidth}]`;
  }
}
FixedSizeBinary[Symbol.toStringTag] = (proto => {
  proto.byteWidth = null;
  proto.ArrayType = Uint8Array;
  return (proto[Symbol.toStringTag] = "FixedSizeBinary");
})(FixedSizeBinary.prototype);
/** @ignore */
export class FixedSizeList extends DataType {
  constructor(listSize, child) {
    super();
    this.listSize = listSize;
    this.children = [child];
  }
  get typeId() {
    return Type.FixedSizeList;
  }
  get valueType() {
    return this.children[0].type;
  }
  get valueField() {
    return this.children[0];
  }
  get ArrayType() {
    return this.valueType.ArrayType;
  }
  toString() {
    return `FixedSizeList[${this.listSize}]<${this.valueType}>`;
  }
}
FixedSizeList[Symbol.toStringTag] = (proto => {
  proto.children = null;
  proto.listSize = null;
  return (proto[Symbol.toStringTag] = "FixedSizeList");
})(FixedSizeList.prototype);
/** @ignore */
export class Map_ extends DataType {
  constructor(child, keysSorted = false) {
    super();
    this.children = [child];
    this.keysSorted = keysSorted;
  }
  get typeId() {
    return Type.Map;
  }
  get keyType() {
    return this.children[0].type.children[0].type;
  }
  get valueType() {
    return this.children[0].type.children[1].type;
  }
  toString() {
    return `Map<{${this.children[0].type.children
      .map(f => `${f.name}:${f.type}`)
      .join(`, `)}}>`;
  }
}
Map_[Symbol.toStringTag] = (proto => {
  proto.children = null;
  proto.keysSorted = null;
  return (proto[Symbol.toStringTag] = "Map_");
})(Map_.prototype);
/** @ignore */
const getId = (atomicDictionaryId => () => ++atomicDictionaryId)(-1);
/** @ignore */
export class Dictionary extends DataType {
  constructor(dictionary, indices, id, isOrdered) {
    super();
    this.indices = indices;
    this.dictionary = dictionary;
    this.isOrdered = isOrdered || false;
    this.id = id == null ? getId() : typeof id === "number" ? id : id.low;
  }
  get typeId() {
    return Type.Dictionary;
  }
  get children() {
    return this.dictionary.children;
  }
  get valueType() {
    return this.dictionary;
  }
  get ArrayType() {
    return this.dictionary.ArrayType;
  }
  toString() {
    return `Dictionary<${this.indices}, ${this.dictionary}>`;
  }
}
Dictionary[Symbol.toStringTag] = (proto => {
  proto.id = null;
  proto.indices = null;
  proto.isOrdered = null;
  proto.dictionary = null;
  return (proto[Symbol.toStringTag] = "Dictionary");
})(Dictionary.prototype);
/** @ignore */
export function strideForType(type) {
  let t = type;
  switch (type.typeId) {
    case Type.Decimal:
      return 4;
    case Type.Timestamp:
      return 2;
    case Type.Date:
      return 1 + t.unit;
    case Type.Interval:
      return 1 + t.unit;
    case Type.Int:
      return 1 + +(t.bitWidth > 32);
    case Type.Time:
      return 1 + +(t.bitWidth > 32);
    case Type.FixedSizeList:
      return t.listSize;
    case Type.FixedSizeBinary:
      return t.byteWidth;
    default:
      return 1;
  }
}

//# sourceMappingURL=type.mjs.map
