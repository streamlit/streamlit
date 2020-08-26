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
const Schema_ = require("./fb/Schema")
const Message_ = require("./fb/Message")
exports.ArrowType = Schema_.org.apache.arrow.flatbuf.Type
exports.DateUnit = Schema_.org.apache.arrow.flatbuf.DateUnit
exports.TimeUnit = Schema_.org.apache.arrow.flatbuf.TimeUnit
exports.Precision = Schema_.org.apache.arrow.flatbuf.Precision
exports.UnionMode = Schema_.org.apache.arrow.flatbuf.UnionMode
exports.IntervalUnit = Schema_.org.apache.arrow.flatbuf.IntervalUnit
exports.MessageHeader = Message_.org.apache.arrow.flatbuf.MessageHeader
exports.MetadataVersion = Schema_.org.apache.arrow.flatbuf.MetadataVersion
/**
 * Main data type enumeration.
 *
 * Data types in this library are all *logical*. They can be expressed as
 * either a primitive physical type (bytes or bits of some fixed size), a
 * nested type consisting of other data types, or another data type (e.g. a
 * timestamp encoded as an int64).
 *
 * **Note**: Only enum values 0-17 (NONE through Map) are written to an Arrow
 * IPC payload.
 *
 * The rest of the values are specified here so TypeScript can narrow the type
 * signatures further beyond the base Arrow Types. The Arrow DataTypes include
 * metadata like `bitWidth` that impact the type signatures of the values we
 * accept and return.
 *
 * For example, the `Int8Vector` reads 1-byte numbers from an `Int8Array`, an
 * `Int32Vector` reads a 4-byte number from an `Int32Array`, and an `Int64Vector`
 * reads a pair of 4-byte lo, hi 32-bit integers as a zero-copy slice from the
 * underlying `Int32Array`.
 *
 * Library consumers benefit by knowing the narrowest type, since we can ensure
 * the types across all public methods are propagated, and never bail to `any`.
 * These values are _never_ used at runtime, and they will _never_ be written
 * to the flatbuffers metadata of serialized Arrow IPC payloads.
 */
var Type
;(function(Type) {
  /** The default placeholder type */
  Type[(Type["NONE"] = 0)] = "NONE"
  /** A NULL type having no physical storage */
  Type[(Type["Null"] = 1)] = "Null"
  /** Signed or unsigned 8, 16, 32, or 64-bit little-endian integer */
  Type[(Type["Int"] = 2)] = "Int"
  /** 2, 4, or 8-byte floating point value */
  Type[(Type["Float"] = 3)] = "Float"
  /** Variable-length bytes (no guarantee of UTF8-ness) */
  Type[(Type["Binary"] = 4)] = "Binary"
  /** UTF8 variable-length string as List<Char> */
  Type[(Type["Utf8"] = 5)] = "Utf8"
  /** Boolean as 1 bit, LSB bit-packed ordering */
  Type[(Type["Bool"] = 6)] = "Bool"
  /** Precision-and-scale-based decimal type. Storage type depends on the parameters. */
  Type[(Type["Decimal"] = 7)] = "Decimal"
  /** int32_t days or int64_t milliseconds since the UNIX epoch */
  Type[(Type["Date"] = 8)] = "Date"
  /** Time as signed 32 or 64-bit integer, representing either seconds, milliseconds, microseconds, or nanoseconds since midnight since midnight */
  Type[(Type["Time"] = 9)] = "Time"
  /** Exact timestamp encoded with int64 since UNIX epoch (Default unit millisecond) */
  Type[(Type["Timestamp"] = 10)] = "Timestamp"
  /** YEAR_MONTH or DAY_TIME interval in SQL style */
  Type[(Type["Interval"] = 11)] = "Interval"
  /** A list of some logical data type */
  Type[(Type["List"] = 12)] = "List"
  /** Struct of logical types */
  Type[(Type["Struct"] = 13)] = "Struct"
  /** Union of logical types */
  Type[(Type["Union"] = 14)] = "Union"
  /** Fixed-size binary. Each value occupies the same number of bytes */
  Type[(Type["FixedSizeBinary"] = 15)] = "FixedSizeBinary"
  /** Fixed-size list. Each value occupies the same number of bytes */
  Type[(Type["FixedSizeList"] = 16)] = "FixedSizeList"
  /** Map of named logical types */
  Type[(Type["Map"] = 17)] = "Map"
  /** Dictionary aka Category type */
  Type[(Type["Dictionary"] = -1)] = "Dictionary"
  Type[(Type["Int8"] = -2)] = "Int8"
  Type[(Type["Int16"] = -3)] = "Int16"
  Type[(Type["Int32"] = -4)] = "Int32"
  Type[(Type["Int64"] = -5)] = "Int64"
  Type[(Type["Uint8"] = -6)] = "Uint8"
  Type[(Type["Uint16"] = -7)] = "Uint16"
  Type[(Type["Uint32"] = -8)] = "Uint32"
  Type[(Type["Uint64"] = -9)] = "Uint64"
  Type[(Type["Float16"] = -10)] = "Float16"
  Type[(Type["Float32"] = -11)] = "Float32"
  Type[(Type["Float64"] = -12)] = "Float64"
  Type[(Type["DateDay"] = -13)] = "DateDay"
  Type[(Type["DateMillisecond"] = -14)] = "DateMillisecond"
  Type[(Type["TimestampSecond"] = -15)] = "TimestampSecond"
  Type[(Type["TimestampMillisecond"] = -16)] = "TimestampMillisecond"
  Type[(Type["TimestampMicrosecond"] = -17)] = "TimestampMicrosecond"
  Type[(Type["TimestampNanosecond"] = -18)] = "TimestampNanosecond"
  Type[(Type["TimeSecond"] = -19)] = "TimeSecond"
  Type[(Type["TimeMillisecond"] = -20)] = "TimeMillisecond"
  Type[(Type["TimeMicrosecond"] = -21)] = "TimeMicrosecond"
  Type[(Type["TimeNanosecond"] = -22)] = "TimeNanosecond"
  Type[(Type["DenseUnion"] = -23)] = "DenseUnion"
  Type[(Type["SparseUnion"] = -24)] = "SparseUnion"
  Type[(Type["IntervalDayTime"] = -25)] = "IntervalDayTime"
  Type[(Type["IntervalYearMonth"] = -26)] = "IntervalYearMonth"
})((Type = exports.Type || (exports.Type = {})))
var BufferType
;(function(BufferType) {
  /**
   * used in List type, Dense Union and variable length primitive types (String, Binary)
   */
  BufferType[(BufferType["OFFSET"] = 0)] = "OFFSET"
  /**
   * actual data, either wixed width primitive types in slots or variable width delimited by an OFFSET vector
   */
  BufferType[(BufferType["DATA"] = 1)] = "DATA"
  /**
   * Bit vector indicating if each value is null
   */
  BufferType[(BufferType["VALIDITY"] = 2)] = "VALIDITY"
  /**
   * Type vector used in Union type
   */
  BufferType[(BufferType["TYPE"] = 3)] = "TYPE"
})((BufferType = exports.BufferType || (exports.BufferType = {})))

//# sourceMappingURL=enum.js.map
