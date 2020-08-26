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
const bit_1 = require("./util/bit")
const bit_2 = require("./util/bit")
const enum_1 = require("./enum")
const type_1 = require("./type")
const buffer_1 = require("./util/buffer")
/** @ignore */ exports.kUnknownNullCount = -1
/** @ignore */
class Data {
  constructor(
    type,
    offset,
    length,
    nullCount,
    buffers,
    childData,
    dictionary
  ) {
    this.type = type
    this.dictionary = dictionary
    this.offset = Math.floor(Math.max(offset || 0, 0))
    this.length = Math.floor(Math.max(length || 0, 0))
    this._nullCount = Math.floor(Math.max(nullCount || 0, -1))
    this.childData = (childData || []).map(x =>
      x instanceof Data ? x : x.data
    )
    let buffer
    if (buffers instanceof Data) {
      this.stride = buffers.stride
      this.values = buffers.values
      this.typeIds = buffers.typeIds
      this.nullBitmap = buffers.nullBitmap
      this.valueOffsets = buffers.valueOffsets
    } else {
      this.stride = type_1.strideForType(type)
      if (buffers) {
        ;(buffer = buffers[0]) && (this.valueOffsets = buffer)
        ;(buffer = buffers[1]) && (this.values = buffer)
        ;(buffer = buffers[2]) && (this.nullBitmap = buffer)
        ;(buffer = buffers[3]) && (this.typeIds = buffer)
      }
    }
  }
  get typeId() {
    return this.type.typeId
  }
  get ArrayType() {
    return this.type.ArrayType
  }
  get buffers() {
    return [this.valueOffsets, this.values, this.nullBitmap, this.typeIds]
  }
  get byteLength() {
    let byteLength = 0
    let { valueOffsets, values, nullBitmap, typeIds } = this
    valueOffsets && (byteLength += valueOffsets.byteLength)
    values && (byteLength += values.byteLength)
    nullBitmap && (byteLength += nullBitmap.byteLength)
    typeIds && (byteLength += typeIds.byteLength)
    return this.childData.reduce(
      (byteLength, child) => byteLength + child.byteLength,
      byteLength
    )
  }
  get nullCount() {
    let nullCount = this._nullCount
    let nullBitmap
    if (
      nullCount <= exports.kUnknownNullCount &&
      (nullBitmap = this.nullBitmap)
    ) {
      this._nullCount = nullCount =
        this.length -
        bit_2.popcnt_bit_range(
          nullBitmap,
          this.offset,
          this.offset + this.length
        )
    }
    return nullCount
  }
  clone(
    type,
    offset = this.offset,
    length = this.length,
    nullCount = this._nullCount,
    buffers = this,
    childData = this.childData
  ) {
    return new Data(
      type,
      offset,
      length,
      nullCount,
      buffers,
      childData,
      this.dictionary
    )
  }
  slice(offset, length) {
    const { stride, typeId, childData } = this
    // +true === 1, +false === 0, so this means
    // we keep nullCount at 0 if it's already 0,
    // otherwise set to the invalidated flag -1
    const nullCount = +(this._nullCount === 0) - 1
    const childStride = typeId === 16 /* FixedSizeList */ ? stride : 1
    const buffers = this._sliceBuffers(offset, length, stride, typeId)
    return this.clone(
      this.type,
      this.offset + offset,
      length,
      nullCount,
      buffers,
      // Don't slice children if we have value offsets (the variable-width types)
      !childData.length || this.valueOffsets
        ? childData
        : this._sliceChildren(
            childData,
            childStride * offset,
            childStride * length
          )
    )
  }
  _changeLengthAndBackfillNullBitmap(newLength) {
    if (this.typeId === enum_1.Type.Null) {
      return this.clone(this.type, 0, newLength, 0)
    }
    const { length, nullCount } = this
    // start initialized with 0s (nulls), then fill from 0 to length with 1s (not null)
    const bitmap = new Uint8Array(((newLength + 63) & ~63) >> 3).fill(
      255,
      0,
      length >> 3
    )
    // set all the bits in the last byte (up to bit `length - length % 8`) to 1 (not null)
    bitmap[length >> 3] = (1 << (length - (length & ~7))) - 1
    // if we have a nullBitmap, truncate + slice and set it over the pre-filled 1s
    if (nullCount > 0) {
      bitmap.set(bit_1.truncateBitmap(this.offset, length, this.nullBitmap), 0)
    }
    const buffers = this.buffers
    buffers[enum_1.BufferType.VALIDITY] = bitmap
    return this.clone(
      this.type,
      0,
      newLength,
      nullCount + (newLength - length),
      buffers
    )
  }
  _sliceBuffers(offset, length, stride, typeId) {
    let arr,
      { buffers } = this
    // If typeIds exist, slice the typeIds buffer
    ;(arr = buffers[enum_1.BufferType.TYPE]) &&
      (buffers[enum_1.BufferType.TYPE] = arr.subarray(offset, offset + length))
    // If offsets exist, only slice the offsets buffer
    ;((arr = buffers[enum_1.BufferType.OFFSET]) &&
      (buffers[enum_1.BufferType.OFFSET] = arr.subarray(
        offset,
        offset + length + 1
      ))) ||
      // Otherwise if no offsets, slice the data buffer. Don't slice the data vector for Booleans, since the offset goes by bits not bytes
      ((arr = buffers[enum_1.BufferType.DATA]) &&
        (buffers[enum_1.BufferType.DATA] =
          typeId === 6
            ? arr
            : arr.subarray(stride * offset, stride * (offset + length))))
    return buffers
  }
  _sliceChildren(childData, offset, length) {
    return childData.map(child => child.slice(offset, length))
  }
  //
  // Convenience methods for creating Data instances for each of the Arrow Vector types
  //
  /** @nocollapse */
  static new(type, offset, length, nullCount, buffers, childData, dictionary) {
    if (buffers instanceof Data) {
      buffers = buffers.buffers
    } else if (!buffers) {
      buffers = []
    }
    switch (type.typeId) {
      case enum_1.Type.Null:
        return Data.Null(type, offset, length)
      case enum_1.Type.Int:
        return Data.Int(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.DATA] || []
        )
      case enum_1.Type.Dictionary:
        return Data.Dictionary(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.DATA] || [],
          dictionary
        )
      case enum_1.Type.Float:
        return Data.Float(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.DATA] || []
        )
      case enum_1.Type.Bool:
        return Data.Bool(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.DATA] || []
        )
      case enum_1.Type.Decimal:
        return Data.Decimal(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.DATA] || []
        )
      case enum_1.Type.Date:
        return Data.Date(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.DATA] || []
        )
      case enum_1.Type.Time:
        return Data.Time(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.DATA] || []
        )
      case enum_1.Type.Timestamp:
        return Data.Timestamp(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.DATA] || []
        )
      case enum_1.Type.Interval:
        return Data.Interval(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.DATA] || []
        )
      case enum_1.Type.FixedSizeBinary:
        return Data.FixedSizeBinary(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.DATA] || []
        )
      case enum_1.Type.Binary:
        return Data.Binary(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.OFFSET] || [],
          buffers[enum_1.BufferType.DATA] || []
        )
      case enum_1.Type.Utf8:
        return Data.Utf8(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.OFFSET] || [],
          buffers[enum_1.BufferType.DATA] || []
        )
      case enum_1.Type.List:
        return Data.List(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.OFFSET] || [],
          (childData || [])[0]
        )
      case enum_1.Type.FixedSizeList:
        return Data.FixedSizeList(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          (childData || [])[0]
        )
      case enum_1.Type.Struct:
        return Data.Struct(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          childData || []
        )
      case enum_1.Type.Map:
        return Data.Map(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.OFFSET] || [],
          (childData || [])[0]
        )
      case enum_1.Type.Union:
        return Data.Union(
          type,
          offset,
          length,
          nullCount || 0,
          buffers[enum_1.BufferType.VALIDITY],
          buffers[enum_1.BufferType.TYPE] || [],
          buffers[enum_1.BufferType.OFFSET] || childData,
          childData
        )
    }
    throw new Error(`Unrecognized typeId ${type.typeId}`)
  }
  /** @nocollapse */
  static Null(type, offset, length) {
    return new Data(type, offset, length, 0)
  }
  /** @nocollapse */
  static Int(type, offset, length, nullCount, nullBitmap, data) {
    return new Data(type, offset, length, nullCount, [
      undefined,
      buffer_1.toArrayBufferView(type.ArrayType, data),
      buffer_1.toUint8Array(nullBitmap),
    ])
  }
  /** @nocollapse */
  static Dictionary(
    type,
    offset,
    length,
    nullCount,
    nullBitmap,
    data,
    dictionary
  ) {
    return new Data(
      type,
      offset,
      length,
      nullCount,
      [
        undefined,
        buffer_1.toArrayBufferView(type.indices.ArrayType, data),
        buffer_1.toUint8Array(nullBitmap),
      ],
      [],
      dictionary
    )
  }
  /** @nocollapse */
  static Float(type, offset, length, nullCount, nullBitmap, data) {
    return new Data(type, offset, length, nullCount, [
      undefined,
      buffer_1.toArrayBufferView(type.ArrayType, data),
      buffer_1.toUint8Array(nullBitmap),
    ])
  }
  /** @nocollapse */
  static Bool(type, offset, length, nullCount, nullBitmap, data) {
    return new Data(type, offset, length, nullCount, [
      undefined,
      buffer_1.toArrayBufferView(type.ArrayType, data),
      buffer_1.toUint8Array(nullBitmap),
    ])
  }
  /** @nocollapse */
  static Decimal(type, offset, length, nullCount, nullBitmap, data) {
    return new Data(type, offset, length, nullCount, [
      undefined,
      buffer_1.toArrayBufferView(type.ArrayType, data),
      buffer_1.toUint8Array(nullBitmap),
    ])
  }
  /** @nocollapse */
  static Date(type, offset, length, nullCount, nullBitmap, data) {
    return new Data(type, offset, length, nullCount, [
      undefined,
      buffer_1.toArrayBufferView(type.ArrayType, data),
      buffer_1.toUint8Array(nullBitmap),
    ])
  }
  /** @nocollapse */
  static Time(type, offset, length, nullCount, nullBitmap, data) {
    return new Data(type, offset, length, nullCount, [
      undefined,
      buffer_1.toArrayBufferView(type.ArrayType, data),
      buffer_1.toUint8Array(nullBitmap),
    ])
  }
  /** @nocollapse */
  static Timestamp(type, offset, length, nullCount, nullBitmap, data) {
    return new Data(type, offset, length, nullCount, [
      undefined,
      buffer_1.toArrayBufferView(type.ArrayType, data),
      buffer_1.toUint8Array(nullBitmap),
    ])
  }
  /** @nocollapse */
  static Interval(type, offset, length, nullCount, nullBitmap, data) {
    return new Data(type, offset, length, nullCount, [
      undefined,
      buffer_1.toArrayBufferView(type.ArrayType, data),
      buffer_1.toUint8Array(nullBitmap),
    ])
  }
  /** @nocollapse */
  static FixedSizeBinary(type, offset, length, nullCount, nullBitmap, data) {
    return new Data(type, offset, length, nullCount, [
      undefined,
      buffer_1.toArrayBufferView(type.ArrayType, data),
      buffer_1.toUint8Array(nullBitmap),
    ])
  }
  /** @nocollapse */
  static Binary(
    type,
    offset,
    length,
    nullCount,
    nullBitmap,
    valueOffsets,
    data
  ) {
    return new Data(type, offset, length, nullCount, [
      buffer_1.toInt32Array(valueOffsets),
      buffer_1.toUint8Array(data),
      buffer_1.toUint8Array(nullBitmap),
    ])
  }
  /** @nocollapse */
  static Utf8(
    type,
    offset,
    length,
    nullCount,
    nullBitmap,
    valueOffsets,
    data
  ) {
    return new Data(type, offset, length, nullCount, [
      buffer_1.toInt32Array(valueOffsets),
      buffer_1.toUint8Array(data),
      buffer_1.toUint8Array(nullBitmap),
    ])
  }
  /** @nocollapse */
  static List(
    type,
    offset,
    length,
    nullCount,
    nullBitmap,
    valueOffsets,
    child
  ) {
    return new Data(
      type,
      offset,
      length,
      nullCount,
      [
        buffer_1.toInt32Array(valueOffsets),
        undefined,
        buffer_1.toUint8Array(nullBitmap),
      ],
      [child]
    )
  }
  /** @nocollapse */
  static FixedSizeList(type, offset, length, nullCount, nullBitmap, child) {
    return new Data(
      type,
      offset,
      length,
      nullCount,
      [undefined, undefined, buffer_1.toUint8Array(nullBitmap)],
      [child]
    )
  }
  /** @nocollapse */
  static Struct(type, offset, length, nullCount, nullBitmap, children) {
    return new Data(
      type,
      offset,
      length,
      nullCount,
      [undefined, undefined, buffer_1.toUint8Array(nullBitmap)],
      children
    )
  }
  /** @nocollapse */
  static Map(
    type,
    offset,
    length,
    nullCount,
    nullBitmap,
    valueOffsets,
    child
  ) {
    return new Data(
      type,
      offset,
      length,
      nullCount,
      [
        buffer_1.toInt32Array(valueOffsets),
        undefined,
        buffer_1.toUint8Array(nullBitmap),
      ],
      [child]
    )
  }
  /** @nocollapse */
  static Union(
    type,
    offset,
    length,
    nullCount,
    nullBitmap,
    typeIds,
    valueOffsetsOrChildren,
    children
  ) {
    const buffers = [
      undefined,
      undefined,
      buffer_1.toUint8Array(nullBitmap),
      buffer_1.toArrayBufferView(type.ArrayType, typeIds),
    ]
    if (type.mode === enum_1.UnionMode.Sparse) {
      return new Data(
        type,
        offset,
        length,
        nullCount,
        buffers,
        valueOffsetsOrChildren
      )
    }
    buffers[enum_1.BufferType.OFFSET] = buffer_1.toInt32Array(
      valueOffsetsOrChildren
    )
    return new Data(type, offset, length, nullCount, buffers, children)
  }
}
exports.Data = Data
Data.prototype.childData = Object.freeze([])

//# sourceMappingURL=data.js.map
