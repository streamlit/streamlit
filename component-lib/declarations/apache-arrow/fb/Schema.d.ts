import { flatbuffers } from "flatbuffers";
/**
 * @enum {number}
 */
export declare namespace org.apache.arrow.flatbuf {
  enum MetadataVersion {
    /**
     * 0.1.0
     */
    V1 = 0,
    /**
     * 0.2.0
     */
    V2 = 1,
    /**
     * 0.3.0 -> 0.7.1
     */
    V3 = 2,
    /**
     * >= 0.8.0
     */
    V4 = 3
  }
}
/**
 * @enum {number}
 */
export declare namespace org.apache.arrow.flatbuf {
  enum UnionMode {
    Sparse = 0,
    Dense = 1
  }
}
/**
 * @enum {number}
 */
export declare namespace org.apache.arrow.flatbuf {
  enum Precision {
    HALF = 0,
    SINGLE = 1,
    DOUBLE = 2
  }
}
/**
 * @enum {number}
 */
export declare namespace org.apache.arrow.flatbuf {
  enum DateUnit {
    DAY = 0,
    MILLISECOND = 1
  }
}
/**
 * @enum {number}
 */
export declare namespace org.apache.arrow.flatbuf {
  enum TimeUnit {
    SECOND = 0,
    MILLISECOND = 1,
    MICROSECOND = 2,
    NANOSECOND = 3
  }
}
/**
 * @enum {number}
 */
export declare namespace org.apache.arrow.flatbuf {
  enum IntervalUnit {
    YEAR_MONTH = 0,
    DAY_TIME = 1
  }
}
/**
 * ----------------------------------------------------------------------
 * Top-level Type value, enabling extensible type-specific metadata. We can
 * add new logical types to Type without breaking backwards compatibility
 *
 * @enum {number}
 */
export declare namespace org.apache.arrow.flatbuf {
  enum Type {
    NONE = 0,
    Null = 1,
    Int = 2,
    FloatingPoint = 3,
    Binary = 4,
    Utf8 = 5,
    Bool = 6,
    Decimal = 7,
    Date = 8,
    Time = 9,
    Timestamp = 10,
    Interval = 11,
    List = 12,
    Struct_ = 13,
    Union = 14,
    FixedSizeBinary = 15,
    FixedSizeList = 16,
    Map = 17,
    Duration = 18,
    LargeBinary = 19,
    LargeUtf8 = 20,
    LargeList = 21
  }
}
/**
 * ----------------------------------------------------------------------
 * Endianness of the platform producing the data
 *
 * @enum {number}
 */
export declare namespace org.apache.arrow.flatbuf {
  enum Endianness {
    Little = 0,
    Big = 1
  }
}
/**
 * These are stored in the flatbuffer in the Type union below
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Null {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Null
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Null;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Null= obj
     * @returns Null
     */
    static getRootAsNull(bb: flatbuffers.ByteBuffer, obj?: Null): Null;
    /**
     * @param flatbuffers.Builder builder
     */
    static startNull(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endNull(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createNull(builder: flatbuffers.Builder): flatbuffers.Offset;
  }
}
/**
 * A Struct_ in the flatbuffer metadata is the same as an Arrow Struct
 * (according to the physical memory layout). We used Struct_ here as
 * Struct is a reserved word in Flatbuffers
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Struct_ {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Struct_
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Struct_;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Struct_= obj
     * @returns Struct_
     */
    static getRootAsStruct_(
      bb: flatbuffers.ByteBuffer,
      obj?: Struct_
    ): Struct_;
    /**
     * @param flatbuffers.Builder builder
     */
    static startStruct_(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endStruct_(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createStruct_(builder: flatbuffers.Builder): flatbuffers.Offset;
  }
}
/**
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class List {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns List
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): List;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param List= obj
     * @returns List
     */
    static getRootAsList(bb: flatbuffers.ByteBuffer, obj?: List): List;
    /**
     * @param flatbuffers.Builder builder
     */
    static startList(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endList(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createList(builder: flatbuffers.Builder): flatbuffers.Offset;
  }
}
/**
 * Same as List, but with 64-bit offsets, allowing to represent
 * extremely large data values.
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class LargeList {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns LargeList
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): LargeList;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param LargeList= obj
     * @returns LargeList
     */
    static getRootAsLargeList(
      bb: flatbuffers.ByteBuffer,
      obj?: LargeList
    ): LargeList;
    /**
     * @param flatbuffers.Builder builder
     */
    static startLargeList(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endLargeList(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createLargeList(builder: flatbuffers.Builder): flatbuffers.Offset;
  }
}
/**
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class FixedSizeList {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns FixedSizeList
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): FixedSizeList;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param FixedSizeList= obj
     * @returns FixedSizeList
     */
    static getRootAsFixedSizeList(
      bb: flatbuffers.ByteBuffer,
      obj?: FixedSizeList
    ): FixedSizeList;
    /**
     * Number of list items per value
     *
     * @returns number
     */
    listSize(): number;
    /**
     * @param flatbuffers.Builder builder
     */
    static startFixedSizeList(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param number listSize
     */
    static addListSize(builder: flatbuffers.Builder, listSize: number): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endFixedSizeList(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createFixedSizeList(
      builder: flatbuffers.Builder,
      listSize: number
    ): flatbuffers.Offset;
  }
}
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
export declare namespace org.apache.arrow.flatbuf {
  class Map {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Map
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Map;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Map= obj
     * @returns Map
     */
    static getRootAsMap(bb: flatbuffers.ByteBuffer, obj?: Map): Map;
    /**
     * Set to true if the keys within each value are sorted
     *
     * @returns boolean
     */
    keysSorted(): boolean;
    /**
     * @param flatbuffers.Builder builder
     */
    static startMap(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param boolean keysSorted
     */
    static addKeysSorted(
      builder: flatbuffers.Builder,
      keysSorted: boolean
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endMap(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createMap(
      builder: flatbuffers.Builder,
      keysSorted: boolean
    ): flatbuffers.Offset;
  }
}
/**
 * A union is a complex type with children in Field
 * By default ids in the type vector refer to the offsets in the children
 * optionally typeIds provides an indirection between the child offset and the type id
 * for each child typeIds[offset] is the id used in the type vector
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Union {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Union
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Union;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Union= obj
     * @returns Union
     */
    static getRootAsUnion(bb: flatbuffers.ByteBuffer, obj?: Union): Union;
    /**
     * @returns org.apache.arrow.flatbuf.UnionMode
     */
    mode(): org.apache.arrow.flatbuf.UnionMode;
    /**
     * @param number index
     * @returns number
     */
    typeIds(index: number): number | null;
    /**
     * @returns number
     */
    typeIdsLength(): number;
    /**
     * @returns Int32Array
     */
    typeIdsArray(): Int32Array | null;
    /**
     * @param flatbuffers.Builder builder
     */
    static startUnion(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param org.apache.arrow.flatbuf.UnionMode mode
     */
    static addMode(
      builder: flatbuffers.Builder,
      mode: org.apache.arrow.flatbuf.UnionMode
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset typeIdsOffset
     */
    static addTypeIds(
      builder: flatbuffers.Builder,
      typeIdsOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param Array.<number> data
     * @returns flatbuffers.Offset
     */
    static createTypeIdsVector(
      builder: flatbuffers.Builder,
      data: number[] | Int32Array
    ): flatbuffers.Offset;
    /**
     * @param flatbuffers.Builder builder
     * @param number numElems
     */
    static startTypeIdsVector(
      builder: flatbuffers.Builder,
      numElems: number
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endUnion(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createUnion(
      builder: flatbuffers.Builder,
      mode: org.apache.arrow.flatbuf.UnionMode,
      typeIdsOffset: flatbuffers.Offset
    ): flatbuffers.Offset;
  }
}
/**
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Int {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Int
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Int;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Int= obj
     * @returns Int
     */
    static getRootAsInt(bb: flatbuffers.ByteBuffer, obj?: Int): Int;
    /**
     * @returns number
     */
    bitWidth(): number;
    /**
     * @returns boolean
     */
    isSigned(): boolean;
    /**
     * @param flatbuffers.Builder builder
     */
    static startInt(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param number bitWidth
     */
    static addBitWidth(builder: flatbuffers.Builder, bitWidth: number): void;
    /**
     * @param flatbuffers.Builder builder
     * @param boolean isSigned
     */
    static addIsSigned(builder: flatbuffers.Builder, isSigned: boolean): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endInt(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createInt(
      builder: flatbuffers.Builder,
      bitWidth: number,
      isSigned: boolean
    ): flatbuffers.Offset;
  }
}
/**
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class FloatingPoint {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns FloatingPoint
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): FloatingPoint;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param FloatingPoint= obj
     * @returns FloatingPoint
     */
    static getRootAsFloatingPoint(
      bb: flatbuffers.ByteBuffer,
      obj?: FloatingPoint
    ): FloatingPoint;
    /**
     * @returns org.apache.arrow.flatbuf.Precision
     */
    precision(): org.apache.arrow.flatbuf.Precision;
    /**
     * @param flatbuffers.Builder builder
     */
    static startFloatingPoint(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param org.apache.arrow.flatbuf.Precision precision
     */
    static addPrecision(
      builder: flatbuffers.Builder,
      precision: org.apache.arrow.flatbuf.Precision
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endFloatingPoint(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createFloatingPoint(
      builder: flatbuffers.Builder,
      precision: org.apache.arrow.flatbuf.Precision
    ): flatbuffers.Offset;
  }
}
/**
 * Unicode with UTF-8 encoding
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Utf8 {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Utf8
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Utf8;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Utf8= obj
     * @returns Utf8
     */
    static getRootAsUtf8(bb: flatbuffers.ByteBuffer, obj?: Utf8): Utf8;
    /**
     * @param flatbuffers.Builder builder
     */
    static startUtf8(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endUtf8(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createUtf8(builder: flatbuffers.Builder): flatbuffers.Offset;
  }
}
/**
 * Opaque binary data
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Binary {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Binary
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Binary;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Binary= obj
     * @returns Binary
     */
    static getRootAsBinary(bb: flatbuffers.ByteBuffer, obj?: Binary): Binary;
    /**
     * @param flatbuffers.Builder builder
     */
    static startBinary(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endBinary(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createBinary(builder: flatbuffers.Builder): flatbuffers.Offset;
  }
}
/**
 * Same as Utf8, but with 64-bit offsets, allowing to represent
 * extremely large data values.
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class LargeUtf8 {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns LargeUtf8
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): LargeUtf8;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param LargeUtf8= obj
     * @returns LargeUtf8
     */
    static getRootAsLargeUtf8(
      bb: flatbuffers.ByteBuffer,
      obj?: LargeUtf8
    ): LargeUtf8;
    /**
     * @param flatbuffers.Builder builder
     */
    static startLargeUtf8(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endLargeUtf8(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createLargeUtf8(builder: flatbuffers.Builder): flatbuffers.Offset;
  }
}
/**
 * Same as Binary, but with 64-bit offsets, allowing to represent
 * extremely large data values.
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class LargeBinary {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns LargeBinary
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): LargeBinary;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param LargeBinary= obj
     * @returns LargeBinary
     */
    static getRootAsLargeBinary(
      bb: flatbuffers.ByteBuffer,
      obj?: LargeBinary
    ): LargeBinary;
    /**
     * @param flatbuffers.Builder builder
     */
    static startLargeBinary(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endLargeBinary(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createLargeBinary(builder: flatbuffers.Builder): flatbuffers.Offset;
  }
}
/**
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class FixedSizeBinary {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns FixedSizeBinary
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): FixedSizeBinary;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param FixedSizeBinary= obj
     * @returns FixedSizeBinary
     */
    static getRootAsFixedSizeBinary(
      bb: flatbuffers.ByteBuffer,
      obj?: FixedSizeBinary
    ): FixedSizeBinary;
    /**
     * Number of bytes per value
     *
     * @returns number
     */
    byteWidth(): number;
    /**
     * @param flatbuffers.Builder builder
     */
    static startFixedSizeBinary(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param number byteWidth
     */
    static addByteWidth(builder: flatbuffers.Builder, byteWidth: number): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endFixedSizeBinary(
      builder: flatbuffers.Builder
    ): flatbuffers.Offset;
    static createFixedSizeBinary(
      builder: flatbuffers.Builder,
      byteWidth: number
    ): flatbuffers.Offset;
  }
}
/**
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Bool {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Bool
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Bool;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Bool= obj
     * @returns Bool
     */
    static getRootAsBool(bb: flatbuffers.ByteBuffer, obj?: Bool): Bool;
    /**
     * @param flatbuffers.Builder builder
     */
    static startBool(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endBool(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createBool(builder: flatbuffers.Builder): flatbuffers.Offset;
  }
}
/**
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Decimal {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Decimal
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Decimal;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Decimal= obj
     * @returns Decimal
     */
    static getRootAsDecimal(
      bb: flatbuffers.ByteBuffer,
      obj?: Decimal
    ): Decimal;
    /**
     * Total number of decimal digits
     *
     * @returns number
     */
    precision(): number;
    /**
     * Number of digits after the decimal point "."
     *
     * @returns number
     */
    scale(): number;
    /**
     * @param flatbuffers.Builder builder
     */
    static startDecimal(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param number precision
     */
    static addPrecision(builder: flatbuffers.Builder, precision: number): void;
    /**
     * @param flatbuffers.Builder builder
     * @param number scale
     */
    static addScale(builder: flatbuffers.Builder, scale: number): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endDecimal(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createDecimal(
      builder: flatbuffers.Builder,
      precision: number,
      scale: number
    ): flatbuffers.Offset;
  }
}
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
export declare namespace org.apache.arrow.flatbuf {
  class Date {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Date
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Date;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Date= obj
     * @returns Date
     */
    static getRootAsDate(bb: flatbuffers.ByteBuffer, obj?: Date): Date;
    /**
     * @returns org.apache.arrow.flatbuf.DateUnit
     */
    unit(): org.apache.arrow.flatbuf.DateUnit;
    /**
     * @param flatbuffers.Builder builder
     */
    static startDate(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param org.apache.arrow.flatbuf.DateUnit unit
     */
    static addUnit(
      builder: flatbuffers.Builder,
      unit: org.apache.arrow.flatbuf.DateUnit
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endDate(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createDate(
      builder: flatbuffers.Builder,
      unit: org.apache.arrow.flatbuf.DateUnit
    ): flatbuffers.Offset;
  }
}
/**
 * Time type. The physical storage type depends on the unit
 * - SECOND and MILLISECOND: 32 bits
 * - MICROSECOND and NANOSECOND: 64 bits
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Time {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Time
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Time;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Time= obj
     * @returns Time
     */
    static getRootAsTime(bb: flatbuffers.ByteBuffer, obj?: Time): Time;
    /**
     * @returns org.apache.arrow.flatbuf.TimeUnit
     */
    unit(): org.apache.arrow.flatbuf.TimeUnit;
    /**
     * @returns number
     */
    bitWidth(): number;
    /**
     * @param flatbuffers.Builder builder
     */
    static startTime(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param org.apache.arrow.flatbuf.TimeUnit unit
     */
    static addUnit(
      builder: flatbuffers.Builder,
      unit: org.apache.arrow.flatbuf.TimeUnit
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param number bitWidth
     */
    static addBitWidth(builder: flatbuffers.Builder, bitWidth: number): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endTime(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createTime(
      builder: flatbuffers.Builder,
      unit: org.apache.arrow.flatbuf.TimeUnit,
      bitWidth: number
    ): flatbuffers.Offset;
  }
}
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
export declare namespace org.apache.arrow.flatbuf {
  class Timestamp {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Timestamp
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Timestamp;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Timestamp= obj
     * @returns Timestamp
     */
    static getRootAsTimestamp(
      bb: flatbuffers.ByteBuffer,
      obj?: Timestamp
    ): Timestamp;
    /**
     * @returns org.apache.arrow.flatbuf.TimeUnit
     */
    unit(): org.apache.arrow.flatbuf.TimeUnit;
    /**
     * The time zone is a string indicating the name of a time zone, one of:
     *
     * * As used in the Olson time zone database (the "tz database" or
     *   "tzdata"), such as "America/New_York"
     * * An absolute time zone offset of the form +XX:XX or -XX:XX, such as +07:30
     *
     * Whether a timezone string is present indicates different semantics about
     * the data:
     *
     * * If the time zone is null or equal to an empty string, the data is "time
     *   zone naive" and shall be displayed *as is* to the user, not localized
     *   to the locale of the user. This data can be though of as UTC but
     *   without having "UTC" as the time zone, it is not considered to be
     *   localized to any time zone
     *
     * * If the time zone is set to a valid value, values can be displayed as
     *   "localized" to that time zone, even though the underlying 64-bit
     *   integers are identical to the same data stored in UTC. Converting
     *   between time zones is a metadata-only operation and does not change the
     *   underlying values
     *
     * @param flatbuffers.Encoding= optionalEncoding
     * @returns string|Uint8Array|null
     */
    timezone(): string | null;
    timezone(
      optionalEncoding: flatbuffers.Encoding
    ): string | Uint8Array | null;
    /**
     * @param flatbuffers.Builder builder
     */
    static startTimestamp(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param org.apache.arrow.flatbuf.TimeUnit unit
     */
    static addUnit(
      builder: flatbuffers.Builder,
      unit: org.apache.arrow.flatbuf.TimeUnit
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset timezoneOffset
     */
    static addTimezone(
      builder: flatbuffers.Builder,
      timezoneOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endTimestamp(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createTimestamp(
      builder: flatbuffers.Builder,
      unit: org.apache.arrow.flatbuf.TimeUnit,
      timezoneOffset: flatbuffers.Offset
    ): flatbuffers.Offset;
  }
}
/**
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Interval {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Interval
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Interval;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Interval= obj
     * @returns Interval
     */
    static getRootAsInterval(
      bb: flatbuffers.ByteBuffer,
      obj?: Interval
    ): Interval;
    /**
     * @returns org.apache.arrow.flatbuf.IntervalUnit
     */
    unit(): org.apache.arrow.flatbuf.IntervalUnit;
    /**
     * @param flatbuffers.Builder builder
     */
    static startInterval(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param org.apache.arrow.flatbuf.IntervalUnit unit
     */
    static addUnit(
      builder: flatbuffers.Builder,
      unit: org.apache.arrow.flatbuf.IntervalUnit
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endInterval(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createInterval(
      builder: flatbuffers.Builder,
      unit: org.apache.arrow.flatbuf.IntervalUnit
    ): flatbuffers.Offset;
  }
}
/**
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Duration {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Duration
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Duration;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Duration= obj
     * @returns Duration
     */
    static getRootAsDuration(
      bb: flatbuffers.ByteBuffer,
      obj?: Duration
    ): Duration;
    /**
     * @returns org.apache.arrow.flatbuf.TimeUnit
     */
    unit(): org.apache.arrow.flatbuf.TimeUnit;
    /**
     * @param flatbuffers.Builder builder
     */
    static startDuration(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param org.apache.arrow.flatbuf.TimeUnit unit
     */
    static addUnit(
      builder: flatbuffers.Builder,
      unit: org.apache.arrow.flatbuf.TimeUnit
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endDuration(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createDuration(
      builder: flatbuffers.Builder,
      unit: org.apache.arrow.flatbuf.TimeUnit
    ): flatbuffers.Offset;
  }
}
/**
 * ----------------------------------------------------------------------
 * user defined key value pairs to add custom metadata to arrow
 * key namespacing is the responsibility of the user
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class KeyValue {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns KeyValue
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): KeyValue;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param KeyValue= obj
     * @returns KeyValue
     */
    static getRootAsKeyValue(
      bb: flatbuffers.ByteBuffer,
      obj?: KeyValue
    ): KeyValue;
    /**
     * @param flatbuffers.Encoding= optionalEncoding
     * @returns string|Uint8Array|null
     */
    key(): string | null;
    key(optionalEncoding: flatbuffers.Encoding): string | Uint8Array | null;
    /**
     * @param flatbuffers.Encoding= optionalEncoding
     * @returns string|Uint8Array|null
     */
    value(): string | null;
    value(optionalEncoding: flatbuffers.Encoding): string | Uint8Array | null;
    /**
     * @param flatbuffers.Builder builder
     */
    static startKeyValue(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset keyOffset
     */
    static addKey(
      builder: flatbuffers.Builder,
      keyOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset valueOffset
     */
    static addValue(
      builder: flatbuffers.Builder,
      valueOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endKeyValue(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createKeyValue(
      builder: flatbuffers.Builder,
      keyOffset: flatbuffers.Offset,
      valueOffset: flatbuffers.Offset
    ): flatbuffers.Offset;
  }
}
/**
 * ----------------------------------------------------------------------
 * Dictionary encoding metadata
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class DictionaryEncoding {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns DictionaryEncoding
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): DictionaryEncoding;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param DictionaryEncoding= obj
     * @returns DictionaryEncoding
     */
    static getRootAsDictionaryEncoding(
      bb: flatbuffers.ByteBuffer,
      obj?: DictionaryEncoding
    ): DictionaryEncoding;
    /**
     * The known dictionary id in the application where this data is used. In
     * the file or streaming formats, the dictionary ids are found in the
     * DictionaryBatch messages
     *
     * @returns flatbuffers.Long
     */
    id(): flatbuffers.Long;
    /**
     * The dictionary indices are constrained to be positive integers. If this
     * field is null, the indices must be signed int32
     *
     * @param org.apache.arrow.flatbuf.Int= obj
     * @returns org.apache.arrow.flatbuf.Int|null
     */
    indexType(
      obj?: org.apache.arrow.flatbuf.Int
    ): org.apache.arrow.flatbuf.Int | null;
    /**
     * By default, dictionaries are not ordered, or the order does not have
     * semantic meaning. In some statistical, applications, dictionary-encoding
     * is used to represent ordered categorical data, and we provide a way to
     * preserve that metadata here
     *
     * @returns boolean
     */
    isOrdered(): boolean;
    /**
     * @param flatbuffers.Builder builder
     */
    static startDictionaryEncoding(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Long id
     */
    static addId(builder: flatbuffers.Builder, id: flatbuffers.Long): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset indexTypeOffset
     */
    static addIndexType(
      builder: flatbuffers.Builder,
      indexTypeOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param boolean isOrdered
     */
    static addIsOrdered(
      builder: flatbuffers.Builder,
      isOrdered: boolean
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endDictionaryEncoding(
      builder: flatbuffers.Builder
    ): flatbuffers.Offset;
    static createDictionaryEncoding(
      builder: flatbuffers.Builder,
      id: flatbuffers.Long,
      indexTypeOffset: flatbuffers.Offset,
      isOrdered: boolean
    ): flatbuffers.Offset;
  }
}
/**
 * ----------------------------------------------------------------------
 * A field represents a named column in a record / row batch or child of a
 * nested type.
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Field {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Field
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Field;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Field= obj
     * @returns Field
     */
    static getRootAsField(bb: flatbuffers.ByteBuffer, obj?: Field): Field;
    /**
     * Name is not required, in i.e. a List
     *
     * @param flatbuffers.Encoding= optionalEncoding
     * @returns string|Uint8Array|null
     */
    name(): string | null;
    name(optionalEncoding: flatbuffers.Encoding): string | Uint8Array | null;
    /**
     * Whether or not this field can contain nulls. Should be true in general.
     *
     * @returns boolean
     */
    nullable(): boolean;
    /**
     * @returns org.apache.arrow.flatbuf.Type
     */
    typeType(): org.apache.arrow.flatbuf.Type;
    /**
     * This is the type of the decoded value if the field is dictionary encoded.
     *
     * @param flatbuffers.Table obj
     * @returns ?flatbuffers.Table
     */
    type<T extends flatbuffers.Table>(obj: T): T | null;
    /**
     * Present only if the field is dictionary encoded.
     *
     * @param org.apache.arrow.flatbuf.DictionaryEncoding= obj
     * @returns org.apache.arrow.flatbuf.DictionaryEncoding|null
     */
    dictionary(
      obj?: org.apache.arrow.flatbuf.DictionaryEncoding
    ): org.apache.arrow.flatbuf.DictionaryEncoding | null;
    /**
     * children apply only to nested data types like Struct, List and Union. For
     * primitive types children will have length 0.
     *
     * @param number index
     * @param org.apache.arrow.flatbuf.Field= obj
     * @returns org.apache.arrow.flatbuf.Field
     */
    children(
      index: number,
      obj?: org.apache.arrow.flatbuf.Field
    ): org.apache.arrow.flatbuf.Field | null;
    /**
     * @returns number
     */
    childrenLength(): number;
    /**
     * User-defined metadata
     *
     * @param number index
     * @param org.apache.arrow.flatbuf.KeyValue= obj
     * @returns org.apache.arrow.flatbuf.KeyValue
     */
    customMetadata(
      index: number,
      obj?: org.apache.arrow.flatbuf.KeyValue
    ): org.apache.arrow.flatbuf.KeyValue | null;
    /**
     * @returns number
     */
    customMetadataLength(): number;
    /**
     * @param flatbuffers.Builder builder
     */
    static startField(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset nameOffset
     */
    static addName(
      builder: flatbuffers.Builder,
      nameOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param boolean nullable
     */
    static addNullable(builder: flatbuffers.Builder, nullable: boolean): void;
    /**
     * @param flatbuffers.Builder builder
     * @param org.apache.arrow.flatbuf.Type typeType
     */
    static addTypeType(
      builder: flatbuffers.Builder,
      typeType: org.apache.arrow.flatbuf.Type
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset typeOffset
     */
    static addType(
      builder: flatbuffers.Builder,
      typeOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset dictionaryOffset
     */
    static addDictionary(
      builder: flatbuffers.Builder,
      dictionaryOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset childrenOffset
     */
    static addChildren(
      builder: flatbuffers.Builder,
      childrenOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param Array.<flatbuffers.Offset> data
     * @returns flatbuffers.Offset
     */
    static createChildrenVector(
      builder: flatbuffers.Builder,
      data: flatbuffers.Offset[]
    ): flatbuffers.Offset;
    /**
     * @param flatbuffers.Builder builder
     * @param number numElems
     */
    static startChildrenVector(
      builder: flatbuffers.Builder,
      numElems: number
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset customMetadataOffset
     */
    static addCustomMetadata(
      builder: flatbuffers.Builder,
      customMetadataOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param Array.<flatbuffers.Offset> data
     * @returns flatbuffers.Offset
     */
    static createCustomMetadataVector(
      builder: flatbuffers.Builder,
      data: flatbuffers.Offset[]
    ): flatbuffers.Offset;
    /**
     * @param flatbuffers.Builder builder
     * @param number numElems
     */
    static startCustomMetadataVector(
      builder: flatbuffers.Builder,
      numElems: number
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endField(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createField(
      builder: flatbuffers.Builder,
      nameOffset: flatbuffers.Offset,
      nullable: boolean,
      typeType: org.apache.arrow.flatbuf.Type,
      typeOffset: flatbuffers.Offset,
      dictionaryOffset: flatbuffers.Offset,
      childrenOffset: flatbuffers.Offset,
      customMetadataOffset: flatbuffers.Offset
    ): flatbuffers.Offset;
  }
}
/**
 * ----------------------------------------------------------------------
 * A Buffer represents a single contiguous memory segment
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Buffer {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Buffer
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Buffer;
    /**
     * The relative offset into the shared memory page where the bytes for this
     * buffer starts
     *
     * @returns flatbuffers.Long
     */
    offset(): flatbuffers.Long;
    /**
     * The absolute length (in bytes) of the memory buffer. The memory is found
     * from offset (inclusive) to offset + length (non-inclusive).
     *
     * @returns flatbuffers.Long
     */
    length(): flatbuffers.Long;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Long offset
     * @param flatbuffers.Long length
     * @returns flatbuffers.Offset
     */
    static createBuffer(
      builder: flatbuffers.Builder,
      offset: flatbuffers.Long,
      length: flatbuffers.Long
    ): flatbuffers.Offset;
  }
}
/**
 * ----------------------------------------------------------------------
 * A Schema describes the columns in a row batch
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Schema {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Schema
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Schema;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Schema= obj
     * @returns Schema
     */
    static getRootAsSchema(bb: flatbuffers.ByteBuffer, obj?: Schema): Schema;
    /**
     * endianness of the buffer
     * it is Little Endian by default
     * if endianness doesn't match the underlying system then the vectors need to be converted
     *
     * @returns org.apache.arrow.flatbuf.Endianness
     */
    endianness(): org.apache.arrow.flatbuf.Endianness;
    /**
     * @param number index
     * @param org.apache.arrow.flatbuf.Field= obj
     * @returns org.apache.arrow.flatbuf.Field
     */
    fields(
      index: number,
      obj?: org.apache.arrow.flatbuf.Field
    ): org.apache.arrow.flatbuf.Field | null;
    /**
     * @returns number
     */
    fieldsLength(): number;
    /**
     * @param number index
     * @param org.apache.arrow.flatbuf.KeyValue= obj
     * @returns org.apache.arrow.flatbuf.KeyValue
     */
    customMetadata(
      index: number,
      obj?: org.apache.arrow.flatbuf.KeyValue
    ): org.apache.arrow.flatbuf.KeyValue | null;
    /**
     * @returns number
     */
    customMetadataLength(): number;
    /**
     * @param flatbuffers.Builder builder
     */
    static startSchema(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param org.apache.arrow.flatbuf.Endianness endianness
     */
    static addEndianness(
      builder: flatbuffers.Builder,
      endianness: org.apache.arrow.flatbuf.Endianness
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset fieldsOffset
     */
    static addFields(
      builder: flatbuffers.Builder,
      fieldsOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param Array.<flatbuffers.Offset> data
     * @returns flatbuffers.Offset
     */
    static createFieldsVector(
      builder: flatbuffers.Builder,
      data: flatbuffers.Offset[]
    ): flatbuffers.Offset;
    /**
     * @param flatbuffers.Builder builder
     * @param number numElems
     */
    static startFieldsVector(
      builder: flatbuffers.Builder,
      numElems: number
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset customMetadataOffset
     */
    static addCustomMetadata(
      builder: flatbuffers.Builder,
      customMetadataOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param Array.<flatbuffers.Offset> data
     * @returns flatbuffers.Offset
     */
    static createCustomMetadataVector(
      builder: flatbuffers.Builder,
      data: flatbuffers.Offset[]
    ): flatbuffers.Offset;
    /**
     * @param flatbuffers.Builder builder
     * @param number numElems
     */
    static startCustomMetadataVector(
      builder: flatbuffers.Builder,
      numElems: number
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endSchema(builder: flatbuffers.Builder): flatbuffers.Offset;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset offset
     */
    static finishSchemaBuffer(
      builder: flatbuffers.Builder,
      offset: flatbuffers.Offset
    ): void;
    static createSchema(
      builder: flatbuffers.Builder,
      endianness: org.apache.arrow.flatbuf.Endianness,
      fieldsOffset: flatbuffers.Offset,
      customMetadataOffset: flatbuffers.Offset
    ): flatbuffers.Offset;
  }
}
