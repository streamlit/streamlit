import { flatbuffers } from "flatbuffers";
import * as NS7624605610262437867 from "./Schema";
export declare namespace org.apache.arrow.flatbuf {
  export import Schema = NS7624605610262437867.org.apache.arrow.flatbuf.Schema;
}
/**
 * ----------------------------------------------------------------------
 * The root Message type
 * This union enables us to easily send different message types without
 * redundant storage, and in the future we can easily add new message types.
 *
 * Arrow implementations do not need to implement all of the message types,
 * which may include experimental metadata types. For maximum compatibility,
 * it is best to send data using RecordBatch
 *
 * @enum {number}
 */
export declare namespace org.apache.arrow.flatbuf {
  enum MessageHeader {
    NONE = 0,
    Schema = 1,
    DictionaryBatch = 2,
    RecordBatch = 3,
    Tensor = 4,
    SparseTensor = 5
  }
}
/**
 * ----------------------------------------------------------------------
 * Data structures for describing a table row batch (a collection of
 * equal-length Arrow arrays)
 * Metadata about a field at some level of a nested type tree (but not
 * its children).
 *
 * For example, a List<Int16> with values [[1, 2, 3], null, [4], [5, 6], null]
 * would have {length: 5, null_count: 2} for its List node, and {length: 6,
 * null_count: 0} for its Int16 node, as separate FieldNode structs
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class FieldNode {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns FieldNode
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): FieldNode;
    /**
     * The number of value slots in the Arrow array at this level of a nested
     * tree
     *
     * @returns flatbuffers.Long
     */
    length(): flatbuffers.Long;
    /**
     * The number of observed nulls. Fields with null_count == 0 may choose not
     * to write their physical validity bitmap out as a materialized buffer,
     * instead setting the length of the bitmap buffer to 0.
     *
     * @returns flatbuffers.Long
     */
    nullCount(): flatbuffers.Long;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Long length
     * @param flatbuffers.Long null_count
     * @returns flatbuffers.Offset
     */
    static createFieldNode(
      builder: flatbuffers.Builder,
      length: flatbuffers.Long,
      null_count: flatbuffers.Long
    ): flatbuffers.Offset;
  }
}
/**
 * A data header describing the shared memory layout of a "record" or "row"
 * batch. Some systems call this a "row batch" internally and others a "record
 * batch".
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class RecordBatch {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns RecordBatch
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): RecordBatch;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param RecordBatch= obj
     * @returns RecordBatch
     */
    static getRootAsRecordBatch(
      bb: flatbuffers.ByteBuffer,
      obj?: RecordBatch
    ): RecordBatch;
    /**
     * number of records / rows. The arrays in the batch should all have this
     * length
     *
     * @returns flatbuffers.Long
     */
    length(): flatbuffers.Long;
    /**
     * Nodes correspond to the pre-ordered flattened logical schema
     *
     * @param number index
     * @param org.apache.arrow.flatbuf.FieldNode= obj
     * @returns org.apache.arrow.flatbuf.FieldNode
     */
    nodes(
      index: number,
      obj?: org.apache.arrow.flatbuf.FieldNode
    ): org.apache.arrow.flatbuf.FieldNode | null;
    /**
     * @returns number
     */
    nodesLength(): number;
    /**
     * Buffers correspond to the pre-ordered flattened buffer tree
     *
     * The number of buffers appended to this list depends on the schema. For
     * example, most primitive arrays will have 2 buffers, 1 for the validity
     * bitmap and 1 for the values. For struct arrays, there will only be a
     * single buffer for the validity (nulls) bitmap
     *
     * @param number index
     * @param org.apache.arrow.flatbuf.Buffer= obj
     * @returns org.apache.arrow.flatbuf.Buffer
     */
    buffers(
      index: number,
      obj?: NS7624605610262437867.org.apache.arrow.flatbuf.Buffer
    ): NS7624605610262437867.org.apache.arrow.flatbuf.Buffer | null;
    /**
     * @returns number
     */
    buffersLength(): number;
    /**
     * @param flatbuffers.Builder builder
     */
    static startRecordBatch(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Long length
     */
    static addLength(
      builder: flatbuffers.Builder,
      length: flatbuffers.Long
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset nodesOffset
     */
    static addNodes(
      builder: flatbuffers.Builder,
      nodesOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param number numElems
     */
    static startNodesVector(
      builder: flatbuffers.Builder,
      numElems: number
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset buffersOffset
     */
    static addBuffers(
      builder: flatbuffers.Builder,
      buffersOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param number numElems
     */
    static startBuffersVector(
      builder: flatbuffers.Builder,
      numElems: number
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endRecordBatch(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createRecordBatch(
      builder: flatbuffers.Builder,
      length: flatbuffers.Long,
      nodesOffset: flatbuffers.Offset,
      buffersOffset: flatbuffers.Offset
    ): flatbuffers.Offset;
  }
}
/**
 * For sending dictionary encoding information. Any Field can be
 * dictionary-encoded, but in this case none of its children may be
 * dictionary-encoded.
 * There is one vector / column per dictionary, but that vector / column
 * may be spread across multiple dictionary batches by using the isDelta
 * flag
 *
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class DictionaryBatch {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns DictionaryBatch
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): DictionaryBatch;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param DictionaryBatch= obj
     * @returns DictionaryBatch
     */
    static getRootAsDictionaryBatch(
      bb: flatbuffers.ByteBuffer,
      obj?: DictionaryBatch
    ): DictionaryBatch;
    /**
     * @returns flatbuffers.Long
     */
    id(): flatbuffers.Long;
    /**
     * @param org.apache.arrow.flatbuf.RecordBatch= obj
     * @returns org.apache.arrow.flatbuf.RecordBatch|null
     */
    data(
      obj?: org.apache.arrow.flatbuf.RecordBatch
    ): org.apache.arrow.flatbuf.RecordBatch | null;
    /**
     * If isDelta is true the values in the dictionary are to be appended to a
     * dictionary with the indicated id
     *
     * @returns boolean
     */
    isDelta(): boolean;
    /**
     * @param flatbuffers.Builder builder
     */
    static startDictionaryBatch(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Long id
     */
    static addId(builder: flatbuffers.Builder, id: flatbuffers.Long): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset dataOffset
     */
    static addData(
      builder: flatbuffers.Builder,
      dataOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param boolean isDelta
     */
    static addIsDelta(builder: flatbuffers.Builder, isDelta: boolean): void;
    /**
     * @param flatbuffers.Builder builder
     * @returns flatbuffers.Offset
     */
    static endDictionaryBatch(
      builder: flatbuffers.Builder
    ): flatbuffers.Offset;
    static createDictionaryBatch(
      builder: flatbuffers.Builder,
      id: flatbuffers.Long,
      dataOffset: flatbuffers.Offset,
      isDelta: boolean
    ): flatbuffers.Offset;
  }
}
/**
 * @constructor
 */
export declare namespace org.apache.arrow.flatbuf {
  class Message {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    /**
     * @param number i
     * @param flatbuffers.ByteBuffer bb
     * @returns Message
     */
    __init(i: number, bb: flatbuffers.ByteBuffer): Message;
    /**
     * @param flatbuffers.ByteBuffer bb
     * @param Message= obj
     * @returns Message
     */
    static getRootAsMessage(
      bb: flatbuffers.ByteBuffer,
      obj?: Message
    ): Message;
    /**
     * @returns org.apache.arrow.flatbuf.MetadataVersion
     */
    version(): NS7624605610262437867.org.apache.arrow.flatbuf.MetadataVersion;
    /**
     * @returns org.apache.arrow.flatbuf.MessageHeader
     */
    headerType(): org.apache.arrow.flatbuf.MessageHeader;
    /**
     * @param flatbuffers.Table obj
     * @returns ?flatbuffers.Table
     */
    header<T extends flatbuffers.Table>(obj: T): T | null;
    /**
     * @returns flatbuffers.Long
     */
    bodyLength(): flatbuffers.Long;
    /**
     * @param number index
     * @param org.apache.arrow.flatbuf.KeyValue= obj
     * @returns org.apache.arrow.flatbuf.KeyValue
     */
    customMetadata(
      index: number,
      obj?: NS7624605610262437867.org.apache.arrow.flatbuf.KeyValue
    ): NS7624605610262437867.org.apache.arrow.flatbuf.KeyValue | null;
    /**
     * @returns number
     */
    customMetadataLength(): number;
    /**
     * @param flatbuffers.Builder builder
     */
    static startMessage(builder: flatbuffers.Builder): void;
    /**
     * @param flatbuffers.Builder builder
     * @param org.apache.arrow.flatbuf.MetadataVersion version
     */
    static addVersion(
      builder: flatbuffers.Builder,
      version: NS7624605610262437867.org.apache.arrow.flatbuf.MetadataVersion
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param org.apache.arrow.flatbuf.MessageHeader headerType
     */
    static addHeaderType(
      builder: flatbuffers.Builder,
      headerType: org.apache.arrow.flatbuf.MessageHeader
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset headerOffset
     */
    static addHeader(
      builder: flatbuffers.Builder,
      headerOffset: flatbuffers.Offset
    ): void;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Long bodyLength
     */
    static addBodyLength(
      builder: flatbuffers.Builder,
      bodyLength: flatbuffers.Long
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
    static endMessage(builder: flatbuffers.Builder): flatbuffers.Offset;
    /**
     * @param flatbuffers.Builder builder
     * @param flatbuffers.Offset offset
     */
    static finishMessageBuffer(
      builder: flatbuffers.Builder,
      offset: flatbuffers.Offset
    ): void;
    static createMessage(
      builder: flatbuffers.Builder,
      version: NS7624605610262437867.org.apache.arrow.flatbuf.MetadataVersion,
      headerType: org.apache.arrow.flatbuf.MessageHeader,
      headerOffset: flatbuffers.Offset,
      bodyLength: flatbuffers.Long,
      customMetadataOffset: flatbuffers.Offset
    ): flatbuffers.Offset;
  }
}
