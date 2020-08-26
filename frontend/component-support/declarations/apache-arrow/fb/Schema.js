"use strict"
/* tslint:disable:class-name */
Object.defineProperty(exports, "__esModule", { value: true })
/**
 * @enum {number}
 */
var org
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        let MetadataVersion
        ;(function(MetadataVersion) {
          /**
           * 0.1.0
           */
          MetadataVersion[(MetadataVersion["V1"] = 0)] = "V1"
          /**
           * 0.2.0
           */
          MetadataVersion[(MetadataVersion["V2"] = 1)] = "V2"
          /**
           * 0.3.0 -> 0.7.1
           */
          MetadataVersion[(MetadataVersion["V3"] = 2)] = "V3"
          /**
           * >= 0.8.0
           */
          MetadataVersion[(MetadataVersion["V4"] = 3)] = "V4"
        })(
          (MetadataVersion =
            flatbuf.MetadataVersion || (flatbuf.MetadataVersion = {}))
        )
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @enum {number}
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        let UnionMode
        ;(function(UnionMode) {
          UnionMode[(UnionMode["Sparse"] = 0)] = "Sparse"
          UnionMode[(UnionMode["Dense"] = 1)] = "Dense"
        })((UnionMode = flatbuf.UnionMode || (flatbuf.UnionMode = {})))
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @enum {number}
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        let Precision
        ;(function(Precision) {
          Precision[(Precision["HALF"] = 0)] = "HALF"
          Precision[(Precision["SINGLE"] = 1)] = "SINGLE"
          Precision[(Precision["DOUBLE"] = 2)] = "DOUBLE"
        })((Precision = flatbuf.Precision || (flatbuf.Precision = {})))
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @enum {number}
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        let DateUnit
        ;(function(DateUnit) {
          DateUnit[(DateUnit["DAY"] = 0)] = "DAY"
          DateUnit[(DateUnit["MILLISECOND"] = 1)] = "MILLISECOND"
        })((DateUnit = flatbuf.DateUnit || (flatbuf.DateUnit = {})))
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @enum {number}
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        let TimeUnit
        ;(function(TimeUnit) {
          TimeUnit[(TimeUnit["SECOND"] = 0)] = "SECOND"
          TimeUnit[(TimeUnit["MILLISECOND"] = 1)] = "MILLISECOND"
          TimeUnit[(TimeUnit["MICROSECOND"] = 2)] = "MICROSECOND"
          TimeUnit[(TimeUnit["NANOSECOND"] = 3)] = "NANOSECOND"
        })((TimeUnit = flatbuf.TimeUnit || (flatbuf.TimeUnit = {})))
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @enum {number}
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        let IntervalUnit
        ;(function(IntervalUnit) {
          IntervalUnit[(IntervalUnit["YEAR_MONTH"] = 0)] = "YEAR_MONTH"
          IntervalUnit[(IntervalUnit["DAY_TIME"] = 1)] = "DAY_TIME"
        })(
          (IntervalUnit = flatbuf.IntervalUnit || (flatbuf.IntervalUnit = {}))
        )
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * ----------------------------------------------------------------------
 * Top-level Type value, enabling extensible type-specific metadata. We can
 * add new logical types to Type without breaking backwards compatibility
 *
 * @enum {number}
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        let Type
        ;(function(Type) {
          Type[(Type["NONE"] = 0)] = "NONE"
          Type[(Type["Null"] = 1)] = "Null"
          Type[(Type["Int"] = 2)] = "Int"
          Type[(Type["FloatingPoint"] = 3)] = "FloatingPoint"
          Type[(Type["Binary"] = 4)] = "Binary"
          Type[(Type["Utf8"] = 5)] = "Utf8"
          Type[(Type["Bool"] = 6)] = "Bool"
          Type[(Type["Decimal"] = 7)] = "Decimal"
          Type[(Type["Date"] = 8)] = "Date"
          Type[(Type["Time"] = 9)] = "Time"
          Type[(Type["Timestamp"] = 10)] = "Timestamp"
          Type[(Type["Interval"] = 11)] = "Interval"
          Type[(Type["List"] = 12)] = "List"
          Type[(Type["Struct_"] = 13)] = "Struct_"
          Type[(Type["Union"] = 14)] = "Union"
          Type[(Type["FixedSizeBinary"] = 15)] = "FixedSizeBinary"
          Type[(Type["FixedSizeList"] = 16)] = "FixedSizeList"
          Type[(Type["Map"] = 17)] = "Map"
          Type[(Type["Duration"] = 18)] = "Duration"
          Type[(Type["LargeBinary"] = 19)] = "LargeBinary"
          Type[(Type["LargeUtf8"] = 20)] = "LargeUtf8"
          Type[(Type["LargeList"] = 21)] = "LargeList"
        })((Type = flatbuf.Type || (flatbuf.Type = {})))
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * ----------------------------------------------------------------------
 * Endianness of the platform producing the data
 *
 * @enum {number}
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        let Endianness
        ;(function(Endianness) {
          Endianness[(Endianness["Little"] = 0)] = "Little"
          Endianness[(Endianness["Big"] = 1)] = "Big"
        })((Endianness = flatbuf.Endianness || (flatbuf.Endianness = {})))
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * These are stored in the flatbuffer in the Type union below
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Null {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Null
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Null= obj
           * @returns Null
           */
          static getRootAsNull(bb, obj) {
            return (obj || new Null()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startNull(builder) {
            builder.startObject(0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endNull(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createNull(builder) {
            Null.startNull(builder)
            return Null.endNull(builder)
          }
        }
        flatbuf.Null = Null
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * A Struct_ in the flatbuffer metadata is the same as an Arrow Struct
 * (according to the physical memory layout). We used Struct_ here as
 * Struct is a reserved word in Flatbuffers
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Struct_ {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Struct_
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Struct_= obj
           * @returns Struct_
           */
          static getRootAsStruct_(bb, obj) {
            return (obj || new Struct_()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startStruct_(builder) {
            builder.startObject(0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endStruct_(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createStruct_(builder) {
            Struct_.startStruct_(builder)
            return Struct_.endStruct_(builder)
          }
        }
        flatbuf.Struct_ = Struct_
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class List {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns List
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param List= obj
           * @returns List
           */
          static getRootAsList(bb, obj) {
            return (obj || new List()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startList(builder) {
            builder.startObject(0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endList(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createList(builder) {
            List.startList(builder)
            return List.endList(builder)
          }
        }
        flatbuf.List = List
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * Same as List, but with 64-bit offsets, allowing to represent
 * extremely large data values.
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class LargeList {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns LargeList
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param LargeList= obj
           * @returns LargeList
           */
          static getRootAsLargeList(bb, obj) {
            return (obj || new LargeList()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startLargeList(builder) {
            builder.startObject(0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endLargeList(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createLargeList(builder) {
            LargeList.startLargeList(builder)
            return LargeList.endLargeList(builder)
          }
        }
        flatbuf.LargeList = LargeList
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class FixedSizeList {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns FixedSizeList
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param FixedSizeList= obj
           * @returns FixedSizeList
           */
          static getRootAsFixedSizeList(bb, obj) {
            return (obj || new FixedSizeList()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * Number of list items per value
           *
           * @returns number
           */
          listSize() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset ? this.bb.readInt32(this.bb_pos + offset) : 0
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startFixedSizeList(builder) {
            builder.startObject(1)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param number listSize
           */
          static addListSize(builder, listSize) {
            builder.addFieldInt32(0, listSize, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endFixedSizeList(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createFixedSizeList(builder, listSize) {
            FixedSizeList.startFixedSizeList(builder)
            FixedSizeList.addListSize(builder, listSize)
            return FixedSizeList.endFixedSizeList(builder)
          }
        }
        flatbuf.FixedSizeList = FixedSizeList
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * A Map is a logical nested type that is represented as
 *
 * List<entry: Struct<key: K, value: V>>
 *
 * In this layout, the keys and values are each respectively contiguous. We do
 * not constrain the key and value types, so the application is responsible
 * for ensuring that the keys are hashable and unique. Whether the keys are sorted
 * may be set in the metadata for this field
 *
 * In a Field with Map type, the Field has a child Struct field, which then
 * has two children: key type and the second the value type. The names of the
 * child fields may be respectively "entry", "key", and "value", but this is
 * not enforced
 *
 * Map
 *   - child[0] entry: Struct
 *     - child[0] key: K
 *     - child[1] value: V
 *
 * Neither the "entry" field nor the "key" field may be nullable.
 *
 * The metadata is structured so that Arrow systems without special handling
 * for Map can make Map an alias for List. The "layout" attribute for the Map
 * field must have the same contents as a List.
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Map {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Map
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Map= obj
           * @returns Map
           */
          static getRootAsMap(bb, obj) {
            return (obj || new Map()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * Set to true if the keys within each value are sorted
           *
           * @returns boolean
           */
          keysSorted() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startMap(builder) {
            builder.startObject(1)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param boolean keysSorted
           */
          static addKeysSorted(builder, keysSorted) {
            builder.addFieldInt8(0, +keysSorted, +false)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endMap(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createMap(builder, keysSorted) {
            Map.startMap(builder)
            Map.addKeysSorted(builder, keysSorted)
            return Map.endMap(builder)
          }
        }
        flatbuf.Map = Map
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * A union is a complex type with children in Field
 * By default ids in the type vector refer to the offsets in the children
 * optionally typeIds provides an indirection between the child offset and the type id
 * for each child typeIds[offset] is the id used in the type vector
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Union {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Union
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Union= obj
           * @returns Union
           */
          static getRootAsUnion(bb, obj) {
            return (obj || new Union()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @returns org.apache.arrow.flatbuf.UnionMode
           */
          mode() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset
              ? /**  */ this.bb.readInt16(this.bb_pos + offset)
              : org.apache.arrow.flatbuf.UnionMode.Sparse
          }
          /**
           * @param number index
           * @returns number
           */
          typeIds(index) {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset
              ? this.bb.readInt32(
                  this.bb.__vector(this.bb_pos + offset) + index * 4
                )
              : 0
          }
          /**
           * @returns number
           */
          typeIdsLength() {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0
          }
          /**
           * @returns Int32Array
           */
          typeIdsArray() {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset
              ? new Int32Array(
                  this.bb.bytes().buffer,
                  this.bb.bytes().byteOffset +
                    this.bb.__vector(this.bb_pos + offset),
                  this.bb.__vector_len(this.bb_pos + offset)
                )
              : null
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startUnion(builder) {
            builder.startObject(2)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param org.apache.arrow.flatbuf.UnionMode mode
           */
          static addMode(builder, mode) {
            builder.addFieldInt16(
              0,
              mode,
              org.apache.arrow.flatbuf.UnionMode.Sparse
            )
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset typeIdsOffset
           */
          static addTypeIds(builder, typeIdsOffset) {
            builder.addFieldOffset(1, typeIdsOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param Array.<number> data
           * @returns flatbuffers.Offset
           */
          static createTypeIdsVector(builder, data) {
            builder.startVector(4, data.length, 4)
            for (let i = data.length - 1; i >= 0; i--) {
              builder.addInt32(data[i])
            }
            return builder.endVector()
          }
          /**
           * @param flatbuffers.Builder builder
           * @param number numElems
           */
          static startTypeIdsVector(builder, numElems) {
            builder.startVector(4, numElems, 4)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endUnion(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createUnion(builder, mode, typeIdsOffset) {
            Union.startUnion(builder)
            Union.addMode(builder, mode)
            Union.addTypeIds(builder, typeIdsOffset)
            return Union.endUnion(builder)
          }
        }
        flatbuf.Union = Union
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Int {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Int
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Int= obj
           * @returns Int
           */
          static getRootAsInt(bb, obj) {
            return (obj || new Int()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @returns number
           */
          bitWidth() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset ? this.bb.readInt32(this.bb_pos + offset) : 0
          }
          /**
           * @returns boolean
           */
          isSigned() {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startInt(builder) {
            builder.startObject(2)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param number bitWidth
           */
          static addBitWidth(builder, bitWidth) {
            builder.addFieldInt32(0, bitWidth, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param boolean isSigned
           */
          static addIsSigned(builder, isSigned) {
            builder.addFieldInt8(1, +isSigned, +false)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endInt(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createInt(builder, bitWidth, isSigned) {
            Int.startInt(builder)
            Int.addBitWidth(builder, bitWidth)
            Int.addIsSigned(builder, isSigned)
            return Int.endInt(builder)
          }
        }
        flatbuf.Int = Int
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class FloatingPoint {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns FloatingPoint
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param FloatingPoint= obj
           * @returns FloatingPoint
           */
          static getRootAsFloatingPoint(bb, obj) {
            return (obj || new FloatingPoint()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @returns org.apache.arrow.flatbuf.Precision
           */
          precision() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset
              ? /**  */ this.bb.readInt16(this.bb_pos + offset)
              : org.apache.arrow.flatbuf.Precision.HALF
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startFloatingPoint(builder) {
            builder.startObject(1)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param org.apache.arrow.flatbuf.Precision precision
           */
          static addPrecision(builder, precision) {
            builder.addFieldInt16(
              0,
              precision,
              org.apache.arrow.flatbuf.Precision.HALF
            )
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endFloatingPoint(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createFloatingPoint(builder, precision) {
            FloatingPoint.startFloatingPoint(builder)
            FloatingPoint.addPrecision(builder, precision)
            return FloatingPoint.endFloatingPoint(builder)
          }
        }
        flatbuf.FloatingPoint = FloatingPoint
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * Unicode with UTF-8 encoding
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Utf8 {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Utf8
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Utf8= obj
           * @returns Utf8
           */
          static getRootAsUtf8(bb, obj) {
            return (obj || new Utf8()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startUtf8(builder) {
            builder.startObject(0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endUtf8(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createUtf8(builder) {
            Utf8.startUtf8(builder)
            return Utf8.endUtf8(builder)
          }
        }
        flatbuf.Utf8 = Utf8
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * Opaque binary data
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Binary {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Binary
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Binary= obj
           * @returns Binary
           */
          static getRootAsBinary(bb, obj) {
            return (obj || new Binary()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startBinary(builder) {
            builder.startObject(0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endBinary(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createBinary(builder) {
            Binary.startBinary(builder)
            return Binary.endBinary(builder)
          }
        }
        flatbuf.Binary = Binary
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * Same as Utf8, but with 64-bit offsets, allowing to represent
 * extremely large data values.
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class LargeUtf8 {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns LargeUtf8
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param LargeUtf8= obj
           * @returns LargeUtf8
           */
          static getRootAsLargeUtf8(bb, obj) {
            return (obj || new LargeUtf8()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startLargeUtf8(builder) {
            builder.startObject(0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endLargeUtf8(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createLargeUtf8(builder) {
            LargeUtf8.startLargeUtf8(builder)
            return LargeUtf8.endLargeUtf8(builder)
          }
        }
        flatbuf.LargeUtf8 = LargeUtf8
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * Same as Binary, but with 64-bit offsets, allowing to represent
 * extremely large data values.
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class LargeBinary {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns LargeBinary
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param LargeBinary= obj
           * @returns LargeBinary
           */
          static getRootAsLargeBinary(bb, obj) {
            return (obj || new LargeBinary()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startLargeBinary(builder) {
            builder.startObject(0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endLargeBinary(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createLargeBinary(builder) {
            LargeBinary.startLargeBinary(builder)
            return LargeBinary.endLargeBinary(builder)
          }
        }
        flatbuf.LargeBinary = LargeBinary
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class FixedSizeBinary {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns FixedSizeBinary
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param FixedSizeBinary= obj
           * @returns FixedSizeBinary
           */
          static getRootAsFixedSizeBinary(bb, obj) {
            return (obj || new FixedSizeBinary()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * Number of bytes per value
           *
           * @returns number
           */
          byteWidth() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset ? this.bb.readInt32(this.bb_pos + offset) : 0
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startFixedSizeBinary(builder) {
            builder.startObject(1)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param number byteWidth
           */
          static addByteWidth(builder, byteWidth) {
            builder.addFieldInt32(0, byteWidth, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endFixedSizeBinary(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createFixedSizeBinary(builder, byteWidth) {
            FixedSizeBinary.startFixedSizeBinary(builder)
            FixedSizeBinary.addByteWidth(builder, byteWidth)
            return FixedSizeBinary.endFixedSizeBinary(builder)
          }
        }
        flatbuf.FixedSizeBinary = FixedSizeBinary
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Bool {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Bool
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Bool= obj
           * @returns Bool
           */
          static getRootAsBool(bb, obj) {
            return (obj || new Bool()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startBool(builder) {
            builder.startObject(0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endBool(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createBool(builder) {
            Bool.startBool(builder)
            return Bool.endBool(builder)
          }
        }
        flatbuf.Bool = Bool
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Decimal {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Decimal
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Decimal= obj
           * @returns Decimal
           */
          static getRootAsDecimal(bb, obj) {
            return (obj || new Decimal()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * Total number of decimal digits
           *
           * @returns number
           */
          precision() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset ? this.bb.readInt32(this.bb_pos + offset) : 0
          }
          /**
           * Number of digits after the decimal point "."
           *
           * @returns number
           */
          scale() {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset ? this.bb.readInt32(this.bb_pos + offset) : 0
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startDecimal(builder) {
            builder.startObject(2)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param number precision
           */
          static addPrecision(builder, precision) {
            builder.addFieldInt32(0, precision, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param number scale
           */
          static addScale(builder, scale) {
            builder.addFieldInt32(1, scale, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endDecimal(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createDecimal(builder, precision, scale) {
            Decimal.startDecimal(builder)
            Decimal.addPrecision(builder, precision)
            Decimal.addScale(builder, scale)
            return Decimal.endDecimal(builder)
          }
        }
        flatbuf.Decimal = Decimal
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * Date is either a 32-bit or 64-bit type representing elapsed time since UNIX
 * epoch (1970-01-01), stored in either of two units:
 *
 * * Milliseconds (64 bits) indicating UNIX time elapsed since the epoch (no
 *   leap seconds), where the values are evenly divisible by 86400000
 * * Days (32 bits) since the UNIX epoch
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Date {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Date
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Date= obj
           * @returns Date
           */
          static getRootAsDate(bb, obj) {
            return (obj || new Date()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @returns org.apache.arrow.flatbuf.DateUnit
           */
          unit() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset
              ? /**  */ this.bb.readInt16(this.bb_pos + offset)
              : org.apache.arrow.flatbuf.DateUnit.MILLISECOND
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startDate(builder) {
            builder.startObject(1)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param org.apache.arrow.flatbuf.DateUnit unit
           */
          static addUnit(builder, unit) {
            builder.addFieldInt16(
              0,
              unit,
              org.apache.arrow.flatbuf.DateUnit.MILLISECOND
            )
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endDate(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createDate(builder, unit) {
            Date.startDate(builder)
            Date.addUnit(builder, unit)
            return Date.endDate(builder)
          }
        }
        flatbuf.Date = Date
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * Time type. The physical storage type depends on the unit
 * - SECOND and MILLISECOND: 32 bits
 * - MICROSECOND and NANOSECOND: 64 bits
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Time {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Time
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Time= obj
           * @returns Time
           */
          static getRootAsTime(bb, obj) {
            return (obj || new Time()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @returns org.apache.arrow.flatbuf.TimeUnit
           */
          unit() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset
              ? /**  */ this.bb.readInt16(this.bb_pos + offset)
              : org.apache.arrow.flatbuf.TimeUnit.MILLISECOND
          }
          /**
           * @returns number
           */
          bitWidth() {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset ? this.bb.readInt32(this.bb_pos + offset) : 32
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startTime(builder) {
            builder.startObject(2)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param org.apache.arrow.flatbuf.TimeUnit unit
           */
          static addUnit(builder, unit) {
            builder.addFieldInt16(
              0,
              unit,
              org.apache.arrow.flatbuf.TimeUnit.MILLISECOND
            )
          }
          /**
           * @param flatbuffers.Builder builder
           * @param number bitWidth
           */
          static addBitWidth(builder, bitWidth) {
            builder.addFieldInt32(1, bitWidth, 32)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endTime(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createTime(builder, unit, bitWidth) {
            Time.startTime(builder)
            Time.addUnit(builder, unit)
            Time.addBitWidth(builder, bitWidth)
            return Time.endTime(builder)
          }
        }
        flatbuf.Time = Time
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * Time elapsed from the Unix epoch, 00:00:00.000 on 1 January 1970, excluding
 * leap seconds, as a 64-bit integer. Note that UNIX time does not include
 * leap seconds.
 *
 * The Timestamp metadata supports both "time zone naive" and "time zone
 * aware" timestamps. Read about the timezone attribute for more detail
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Timestamp {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Timestamp
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Timestamp= obj
           * @returns Timestamp
           */
          static getRootAsTimestamp(bb, obj) {
            return (obj || new Timestamp()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @returns org.apache.arrow.flatbuf.TimeUnit
           */
          unit() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset
              ? /**  */ this.bb.readInt16(this.bb_pos + offset)
              : org.apache.arrow.flatbuf.TimeUnit.SECOND
          }
          timezone(optionalEncoding) {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset
              ? this.bb.__string(this.bb_pos + offset, optionalEncoding)
              : null
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startTimestamp(builder) {
            builder.startObject(2)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param org.apache.arrow.flatbuf.TimeUnit unit
           */
          static addUnit(builder, unit) {
            builder.addFieldInt16(
              0,
              unit,
              org.apache.arrow.flatbuf.TimeUnit.SECOND
            )
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset timezoneOffset
           */
          static addTimezone(builder, timezoneOffset) {
            builder.addFieldOffset(1, timezoneOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endTimestamp(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createTimestamp(builder, unit, timezoneOffset) {
            Timestamp.startTimestamp(builder)
            Timestamp.addUnit(builder, unit)
            Timestamp.addTimezone(builder, timezoneOffset)
            return Timestamp.endTimestamp(builder)
          }
        }
        flatbuf.Timestamp = Timestamp
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Interval {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Interval
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Interval= obj
           * @returns Interval
           */
          static getRootAsInterval(bb, obj) {
            return (obj || new Interval()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @returns org.apache.arrow.flatbuf.IntervalUnit
           */
          unit() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset
              ? /**  */ this.bb.readInt16(this.bb_pos + offset)
              : org.apache.arrow.flatbuf.IntervalUnit.YEAR_MONTH
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startInterval(builder) {
            builder.startObject(1)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param org.apache.arrow.flatbuf.IntervalUnit unit
           */
          static addUnit(builder, unit) {
            builder.addFieldInt16(
              0,
              unit,
              org.apache.arrow.flatbuf.IntervalUnit.YEAR_MONTH
            )
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endInterval(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createInterval(builder, unit) {
            Interval.startInterval(builder)
            Interval.addUnit(builder, unit)
            return Interval.endInterval(builder)
          }
        }
        flatbuf.Interval = Interval
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Duration {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Duration
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Duration= obj
           * @returns Duration
           */
          static getRootAsDuration(bb, obj) {
            return (obj || new Duration()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * @returns org.apache.arrow.flatbuf.TimeUnit
           */
          unit() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset
              ? /**  */ this.bb.readInt16(this.bb_pos + offset)
              : org.apache.arrow.flatbuf.TimeUnit.MILLISECOND
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startDuration(builder) {
            builder.startObject(1)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param org.apache.arrow.flatbuf.TimeUnit unit
           */
          static addUnit(builder, unit) {
            builder.addFieldInt16(
              0,
              unit,
              org.apache.arrow.flatbuf.TimeUnit.MILLISECOND
            )
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endDuration(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createDuration(builder, unit) {
            Duration.startDuration(builder)
            Duration.addUnit(builder, unit)
            return Duration.endDuration(builder)
          }
        }
        flatbuf.Duration = Duration
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * ----------------------------------------------------------------------
 * user defined key value pairs to add custom metadata to arrow
 * key namespacing is the responsibility of the user
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class KeyValue {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns KeyValue
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param KeyValue= obj
           * @returns KeyValue
           */
          static getRootAsKeyValue(bb, obj) {
            return (obj || new KeyValue()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          key(optionalEncoding) {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset
              ? this.bb.__string(this.bb_pos + offset, optionalEncoding)
              : null
          }
          value(optionalEncoding) {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset
              ? this.bb.__string(this.bb_pos + offset, optionalEncoding)
              : null
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startKeyValue(builder) {
            builder.startObject(2)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset keyOffset
           */
          static addKey(builder, keyOffset) {
            builder.addFieldOffset(0, keyOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset valueOffset
           */
          static addValue(builder, valueOffset) {
            builder.addFieldOffset(1, valueOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endKeyValue(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createKeyValue(builder, keyOffset, valueOffset) {
            KeyValue.startKeyValue(builder)
            KeyValue.addKey(builder, keyOffset)
            KeyValue.addValue(builder, valueOffset)
            return KeyValue.endKeyValue(builder)
          }
        }
        flatbuf.KeyValue = KeyValue
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * ----------------------------------------------------------------------
 * Dictionary encoding metadata
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class DictionaryEncoding {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns DictionaryEncoding
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param DictionaryEncoding= obj
           * @returns DictionaryEncoding
           */
          static getRootAsDictionaryEncoding(bb, obj) {
            return (obj || new DictionaryEncoding()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * The known dictionary id in the application where this data is used. In
           * the file or streaming formats, the dictionary ids are found in the
           * DictionaryBatch messages
           *
           * @returns flatbuffers.Long
           */
          id() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset
              ? this.bb.readInt64(this.bb_pos + offset)
              : this.bb.createLong(0, 0)
          }
          /**
           * The dictionary indices are constrained to be positive integers. If this
           * field is null, the indices must be signed int32
           *
           * @param org.apache.arrow.flatbuf.Int= obj
           * @returns org.apache.arrow.flatbuf.Int|null
           */
          indexType(obj) {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset
              ? (obj || new org.apache.arrow.flatbuf.Int()).__init(
                  this.bb.__indirect(this.bb_pos + offset),
                  this.bb
                )
              : null
          }
          /**
           * By default, dictionaries are not ordered, or the order does not have
           * semantic meaning. In some statistical, applications, dictionary-encoding
           * is used to represent ordered categorical data, and we provide a way to
           * preserve that metadata here
           *
           * @returns boolean
           */
          isOrdered() {
            let offset = this.bb.__offset(this.bb_pos, 8)
            return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startDictionaryEncoding(builder) {
            builder.startObject(3)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Long id
           */
          static addId(builder, id) {
            builder.addFieldInt64(0, id, builder.createLong(0, 0))
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset indexTypeOffset
           */
          static addIndexType(builder, indexTypeOffset) {
            builder.addFieldOffset(1, indexTypeOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param boolean isOrdered
           */
          static addIsOrdered(builder, isOrdered) {
            builder.addFieldInt8(2, +isOrdered, +false)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endDictionaryEncoding(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createDictionaryEncoding(
            builder,
            id,
            indexTypeOffset,
            isOrdered
          ) {
            DictionaryEncoding.startDictionaryEncoding(builder)
            DictionaryEncoding.addId(builder, id)
            DictionaryEncoding.addIndexType(builder, indexTypeOffset)
            DictionaryEncoding.addIsOrdered(builder, isOrdered)
            return DictionaryEncoding.endDictionaryEncoding(builder)
          }
        }
        flatbuf.DictionaryEncoding = DictionaryEncoding
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * ----------------------------------------------------------------------
 * A field represents a named column in a record / row batch or child of a
 * nested type.
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Field {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Field
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Field= obj
           * @returns Field
           */
          static getRootAsField(bb, obj) {
            return (obj || new Field()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          name(optionalEncoding) {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset
              ? this.bb.__string(this.bb_pos + offset, optionalEncoding)
              : null
          }
          /**
           * Whether or not this field can contain nulls. Should be true in general.
           *
           * @returns boolean
           */
          nullable() {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false
          }
          /**
           * @returns org.apache.arrow.flatbuf.Type
           */
          typeType() {
            let offset = this.bb.__offset(this.bb_pos, 8)
            return offset
              ? /**  */ this.bb.readUint8(this.bb_pos + offset)
              : org.apache.arrow.flatbuf.Type.NONE
          }
          /**
           * This is the type of the decoded value if the field is dictionary encoded.
           *
           * @param flatbuffers.Table obj
           * @returns ?flatbuffers.Table
           */
          type(obj) {
            let offset = this.bb.__offset(this.bb_pos, 10)
            return offset ? this.bb.__union(obj, this.bb_pos + offset) : null
          }
          /**
           * Present only if the field is dictionary encoded.
           *
           * @param org.apache.arrow.flatbuf.DictionaryEncoding= obj
           * @returns org.apache.arrow.flatbuf.DictionaryEncoding|null
           */
          dictionary(obj) {
            let offset = this.bb.__offset(this.bb_pos, 12)
            return offset
              ? (
                  obj || new org.apache.arrow.flatbuf.DictionaryEncoding()
                ).__init(this.bb.__indirect(this.bb_pos + offset), this.bb)
              : null
          }
          /**
           * children apply only to nested data types like Struct, List and Union. For
           * primitive types children will have length 0.
           *
           * @param number index
           * @param org.apache.arrow.flatbuf.Field= obj
           * @returns org.apache.arrow.flatbuf.Field
           */
          children(index, obj) {
            let offset = this.bb.__offset(this.bb_pos, 14)
            return offset
              ? (obj || new org.apache.arrow.flatbuf.Field()).__init(
                  this.bb.__indirect(
                    this.bb.__vector(this.bb_pos + offset) + index * 4
                  ),
                  this.bb
                )
              : null
          }
          /**
           * @returns number
           */
          childrenLength() {
            let offset = this.bb.__offset(this.bb_pos, 14)
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0
          }
          /**
           * User-defined metadata
           *
           * @param number index
           * @param org.apache.arrow.flatbuf.KeyValue= obj
           * @returns org.apache.arrow.flatbuf.KeyValue
           */
          customMetadata(index, obj) {
            let offset = this.bb.__offset(this.bb_pos, 16)
            return offset
              ? (obj || new org.apache.arrow.flatbuf.KeyValue()).__init(
                  this.bb.__indirect(
                    this.bb.__vector(this.bb_pos + offset) + index * 4
                  ),
                  this.bb
                )
              : null
          }
          /**
           * @returns number
           */
          customMetadataLength() {
            let offset = this.bb.__offset(this.bb_pos, 16)
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startField(builder) {
            builder.startObject(7)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset nameOffset
           */
          static addName(builder, nameOffset) {
            builder.addFieldOffset(0, nameOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param boolean nullable
           */
          static addNullable(builder, nullable) {
            builder.addFieldInt8(1, +nullable, +false)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param org.apache.arrow.flatbuf.Type typeType
           */
          static addTypeType(builder, typeType) {
            builder.addFieldInt8(
              2,
              typeType,
              org.apache.arrow.flatbuf.Type.NONE
            )
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset typeOffset
           */
          static addType(builder, typeOffset) {
            builder.addFieldOffset(3, typeOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset dictionaryOffset
           */
          static addDictionary(builder, dictionaryOffset) {
            builder.addFieldOffset(4, dictionaryOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset childrenOffset
           */
          static addChildren(builder, childrenOffset) {
            builder.addFieldOffset(5, childrenOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param Array.<flatbuffers.Offset> data
           * @returns flatbuffers.Offset
           */
          static createChildrenVector(builder, data) {
            builder.startVector(4, data.length, 4)
            for (let i = data.length - 1; i >= 0; i--) {
              builder.addOffset(data[i])
            }
            return builder.endVector()
          }
          /**
           * @param flatbuffers.Builder builder
           * @param number numElems
           */
          static startChildrenVector(builder, numElems) {
            builder.startVector(4, numElems, 4)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset customMetadataOffset
           */
          static addCustomMetadata(builder, customMetadataOffset) {
            builder.addFieldOffset(6, customMetadataOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param Array.<flatbuffers.Offset> data
           * @returns flatbuffers.Offset
           */
          static createCustomMetadataVector(builder, data) {
            builder.startVector(4, data.length, 4)
            for (let i = data.length - 1; i >= 0; i--) {
              builder.addOffset(data[i])
            }
            return builder.endVector()
          }
          /**
           * @param flatbuffers.Builder builder
           * @param number numElems
           */
          static startCustomMetadataVector(builder, numElems) {
            builder.startVector(4, numElems, 4)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endField(builder) {
            let offset = builder.endObject()
            return offset
          }
          static createField(
            builder,
            nameOffset,
            nullable,
            typeType,
            typeOffset,
            dictionaryOffset,
            childrenOffset,
            customMetadataOffset
          ) {
            Field.startField(builder)
            Field.addName(builder, nameOffset)
            Field.addNullable(builder, nullable)
            Field.addTypeType(builder, typeType)
            Field.addType(builder, typeOffset)
            Field.addDictionary(builder, dictionaryOffset)
            Field.addChildren(builder, childrenOffset)
            Field.addCustomMetadata(builder, customMetadataOffset)
            return Field.endField(builder)
          }
        }
        flatbuf.Field = Field
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * ----------------------------------------------------------------------
 * A Buffer represents a single contiguous memory segment
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Buffer {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Buffer
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * The relative offset into the shared memory page where the bytes for this
           * buffer starts
           *
           * @returns flatbuffers.Long
           */
          offset() {
            return this.bb.readInt64(this.bb_pos)
          }
          /**
           * The absolute length (in bytes) of the memory buffer. The memory is found
           * from offset (inclusive) to offset + length (non-inclusive).
           *
           * @returns flatbuffers.Long
           */
          length() {
            return this.bb.readInt64(this.bb_pos + 8)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Long offset
           * @param flatbuffers.Long length
           * @returns flatbuffers.Offset
           */
          static createBuffer(builder, offset, length) {
            builder.prep(8, 16)
            builder.writeInt64(length)
            builder.writeInt64(offset)
            return builder.offset()
          }
        }
        flatbuf.Buffer = Buffer
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))
/**
 * ----------------------------------------------------------------------
 * A Schema describes the columns in a row batch
 *
 * @constructor
 */
;(function(org) {
  var apache
  ;(function(apache) {
    var arrow
    ;(function(arrow) {
      var flatbuf
      ;(function(flatbuf) {
        class Schema {
          constructor() {
            this.bb = null
            this.bb_pos = 0
          }
          /**
           * @param number i
           * @param flatbuffers.ByteBuffer bb
           * @returns Schema
           */
          __init(i, bb) {
            this.bb_pos = i
            this.bb = bb
            return this
          }
          /**
           * @param flatbuffers.ByteBuffer bb
           * @param Schema= obj
           * @returns Schema
           */
          static getRootAsSchema(bb, obj) {
            return (obj || new Schema()).__init(
              bb.readInt32(bb.position()) + bb.position(),
              bb
            )
          }
          /**
           * endianness of the buffer
           * it is Little Endian by default
           * if endianness doesn't match the underlying system then the vectors need to be converted
           *
           * @returns org.apache.arrow.flatbuf.Endianness
           */
          endianness() {
            let offset = this.bb.__offset(this.bb_pos, 4)
            return offset
              ? /**  */ this.bb.readInt16(this.bb_pos + offset)
              : org.apache.arrow.flatbuf.Endianness.Little
          }
          /**
           * @param number index
           * @param org.apache.arrow.flatbuf.Field= obj
           * @returns org.apache.arrow.flatbuf.Field
           */
          fields(index, obj) {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset
              ? (obj || new org.apache.arrow.flatbuf.Field()).__init(
                  this.bb.__indirect(
                    this.bb.__vector(this.bb_pos + offset) + index * 4
                  ),
                  this.bb
                )
              : null
          }
          /**
           * @returns number
           */
          fieldsLength() {
            let offset = this.bb.__offset(this.bb_pos, 6)
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0
          }
          /**
           * @param number index
           * @param org.apache.arrow.flatbuf.KeyValue= obj
           * @returns org.apache.arrow.flatbuf.KeyValue
           */
          customMetadata(index, obj) {
            let offset = this.bb.__offset(this.bb_pos, 8)
            return offset
              ? (obj || new org.apache.arrow.flatbuf.KeyValue()).__init(
                  this.bb.__indirect(
                    this.bb.__vector(this.bb_pos + offset) + index * 4
                  ),
                  this.bb
                )
              : null
          }
          /**
           * @returns number
           */
          customMetadataLength() {
            let offset = this.bb.__offset(this.bb_pos, 8)
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0
          }
          /**
           * @param flatbuffers.Builder builder
           */
          static startSchema(builder) {
            builder.startObject(3)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param org.apache.arrow.flatbuf.Endianness endianness
           */
          static addEndianness(builder, endianness) {
            builder.addFieldInt16(
              0,
              endianness,
              org.apache.arrow.flatbuf.Endianness.Little
            )
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset fieldsOffset
           */
          static addFields(builder, fieldsOffset) {
            builder.addFieldOffset(1, fieldsOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param Array.<flatbuffers.Offset> data
           * @returns flatbuffers.Offset
           */
          static createFieldsVector(builder, data) {
            builder.startVector(4, data.length, 4)
            for (let i = data.length - 1; i >= 0; i--) {
              builder.addOffset(data[i])
            }
            return builder.endVector()
          }
          /**
           * @param flatbuffers.Builder builder
           * @param number numElems
           */
          static startFieldsVector(builder, numElems) {
            builder.startVector(4, numElems, 4)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset customMetadataOffset
           */
          static addCustomMetadata(builder, customMetadataOffset) {
            builder.addFieldOffset(2, customMetadataOffset, 0)
          }
          /**
           * @param flatbuffers.Builder builder
           * @param Array.<flatbuffers.Offset> data
           * @returns flatbuffers.Offset
           */
          static createCustomMetadataVector(builder, data) {
            builder.startVector(4, data.length, 4)
            for (let i = data.length - 1; i >= 0; i--) {
              builder.addOffset(data[i])
            }
            return builder.endVector()
          }
          /**
           * @param flatbuffers.Builder builder
           * @param number numElems
           */
          static startCustomMetadataVector(builder, numElems) {
            builder.startVector(4, numElems, 4)
          }
          /**
           * @param flatbuffers.Builder builder
           * @returns flatbuffers.Offset
           */
          static endSchema(builder) {
            let offset = builder.endObject()
            return offset
          }
          /**
           * @param flatbuffers.Builder builder
           * @param flatbuffers.Offset offset
           */
          static finishSchemaBuffer(builder, offset) {
            builder.finish(offset)
          }
          static createSchema(
            builder,
            endianness,
            fieldsOffset,
            customMetadataOffset
          ) {
            Schema.startSchema(builder)
            Schema.addEndianness(builder, endianness)
            Schema.addFields(builder, fieldsOffset)
            Schema.addCustomMetadata(builder, customMetadataOffset)
            return Schema.endSchema(builder)
          }
        }
        flatbuf.Schema = Schema
      })((flatbuf = arrow.flatbuf || (arrow.flatbuf = {})))
    })((arrow = apache.arrow || (apache.arrow = {})))
  })((apache = org.apache || (org.apache = {})))
})((org = exports.org || (exports.org = {})))

//# sourceMappingURL=Schema.js.map
