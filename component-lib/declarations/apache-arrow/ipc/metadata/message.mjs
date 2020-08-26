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
import { flatbuffers } from "flatbuffers";
import * as Schema_ from "../../fb/Schema";
import * as Message_ from "../../fb/Message";
import { Schema, Field } from "../../schema";
import { toUint8Array } from "../../util/buffer";
import { MessageHeader, MetadataVersion } from "../../enum";
import { instance as typeAssembler } from "../../visitor/typeassembler";
import {
  fieldFromJSON,
  schemaFromJSON,
  recordBatchFromJSON,
  dictionaryBatchFromJSON
} from "./json";
var Long = flatbuffers.Long;
var Builder = flatbuffers.Builder;
var ByteBuffer = flatbuffers.ByteBuffer;
var Type = Schema_.org.apache.arrow.flatbuf.Type;
var _Field = Schema_.org.apache.arrow.flatbuf.Field;
var _Schema = Schema_.org.apache.arrow.flatbuf.Schema;
var _Buffer = Schema_.org.apache.arrow.flatbuf.Buffer;
var _Message = Message_.org.apache.arrow.flatbuf.Message;
var _KeyValue = Schema_.org.apache.arrow.flatbuf.KeyValue;
var _FieldNode = Message_.org.apache.arrow.flatbuf.FieldNode;
var _Endianness = Schema_.org.apache.arrow.flatbuf.Endianness;
var _RecordBatch = Message_.org.apache.arrow.flatbuf.RecordBatch;
var _DictionaryBatch = Message_.org.apache.arrow.flatbuf.DictionaryBatch;
import {
  DataType,
  Dictionary,
  Utf8,
  Binary,
  Decimal,
  FixedSizeBinary,
  List,
  FixedSizeList,
  Map_,
  Struct,
  Union,
  Bool,
  Null,
  Int,
  Float,
  Date_,
  Time,
  Interval,
  Timestamp,
  Int32
} from "../../type";
/**
 * @ignore
 * @private
 **/
export class Message {
  constructor(bodyLength, version, headerType, header) {
    this._version = version;
    this._headerType = headerType;
    this.body = new Uint8Array(0);
    header && (this._createHeader = () => header);
    this._bodyLength =
      typeof bodyLength === "number" ? bodyLength : bodyLength.low;
  }
  /** @nocollapse */
  static fromJSON(msg, headerType) {
    const message = new Message(0, MetadataVersion.V4, headerType);
    message._createHeader = messageHeaderFromJSON(msg, headerType);
    return message;
  }
  /** @nocollapse */
  static decode(buf) {
    buf = new ByteBuffer(toUint8Array(buf));
    const _message = _Message.getRootAsMessage(buf);
    const bodyLength = _message.bodyLength();
    const version = _message.version();
    const headerType = _message.headerType();
    const message = new Message(bodyLength, version, headerType);
    message._createHeader = decodeMessageHeader(_message, headerType);
    return message;
  }
  /** @nocollapse */
  static encode(message) {
    let b = new Builder(),
      headerOffset = -1;
    if (message.isSchema()) {
      headerOffset = Schema.encode(b, message.header());
    } else if (message.isRecordBatch()) {
      headerOffset = RecordBatch.encode(b, message.header());
    } else if (message.isDictionaryBatch()) {
      headerOffset = DictionaryBatch.encode(b, message.header());
    }
    _Message.startMessage(b);
    _Message.addVersion(b, MetadataVersion.V4);
    _Message.addHeader(b, headerOffset);
    _Message.addHeaderType(b, message.headerType);
    _Message.addBodyLength(b, new Long(message.bodyLength, 0));
    _Message.finishMessageBuffer(b, _Message.endMessage(b));
    return b.asUint8Array();
  }
  /** @nocollapse */
  static from(header, bodyLength = 0) {
    if (header instanceof Schema) {
      return new Message(0, MetadataVersion.V4, MessageHeader.Schema, header);
    }
    if (header instanceof RecordBatch) {
      return new Message(
        bodyLength,
        MetadataVersion.V4,
        MessageHeader.RecordBatch,
        header
      );
    }
    if (header instanceof DictionaryBatch) {
      return new Message(
        bodyLength,
        MetadataVersion.V4,
        MessageHeader.DictionaryBatch,
        header
      );
    }
    throw new Error(`Unrecognized Message header: ${header}`);
  }
  get type() {
    return this.headerType;
  }
  get version() {
    return this._version;
  }
  get headerType() {
    return this._headerType;
  }
  get bodyLength() {
    return this._bodyLength;
  }
  header() {
    return this._createHeader();
  }
  isSchema() {
    return this.headerType === MessageHeader.Schema;
  }
  isRecordBatch() {
    return this.headerType === MessageHeader.RecordBatch;
  }
  isDictionaryBatch() {
    return this.headerType === MessageHeader.DictionaryBatch;
  }
}
/**
 * @ignore
 * @private
 **/
export class RecordBatch {
  get nodes() {
    return this._nodes;
  }
  get length() {
    return this._length;
  }
  get buffers() {
    return this._buffers;
  }
  constructor(length, nodes, buffers) {
    this._nodes = nodes;
    this._buffers = buffers;
    this._length = typeof length === "number" ? length : length.low;
  }
}
/**
 * @ignore
 * @private
 **/
export class DictionaryBatch {
  get id() {
    return this._id;
  }
  get data() {
    return this._data;
  }
  get isDelta() {
    return this._isDelta;
  }
  get length() {
    return this.data.length;
  }
  get nodes() {
    return this.data.nodes;
  }
  get buffers() {
    return this.data.buffers;
  }
  constructor(data, id, isDelta = false) {
    this._data = data;
    this._isDelta = isDelta;
    this._id = typeof id === "number" ? id : id.low;
  }
}
/**
 * @ignore
 * @private
 **/
export class BufferRegion {
  constructor(offset, length) {
    this.offset = typeof offset === "number" ? offset : offset.low;
    this.length = typeof length === "number" ? length : length.low;
  }
}
/**
 * @ignore
 * @private
 **/
export class FieldNode {
  constructor(length, nullCount) {
    this.length = typeof length === "number" ? length : length.low;
    this.nullCount = typeof nullCount === "number" ? nullCount : nullCount.low;
  }
}
/** @ignore */
function messageHeaderFromJSON(message, type) {
  return () => {
    switch (type) {
      case MessageHeader.Schema:
        return Schema.fromJSON(message);
      case MessageHeader.RecordBatch:
        return RecordBatch.fromJSON(message);
      case MessageHeader.DictionaryBatch:
        return DictionaryBatch.fromJSON(message);
    }
    throw new Error(
      `Unrecognized Message type: { name: ${MessageHeader[type]}, type: ${type} }`
    );
  };
}
/** @ignore */
function decodeMessageHeader(message, type) {
  return () => {
    switch (type) {
      case MessageHeader.Schema:
        return Schema.decode(message.header(new _Schema()));
      case MessageHeader.RecordBatch:
        return RecordBatch.decode(
          message.header(new _RecordBatch()),
          message.version()
        );
      case MessageHeader.DictionaryBatch:
        return DictionaryBatch.decode(
          message.header(new _DictionaryBatch()),
          message.version()
        );
    }
    throw new Error(
      `Unrecognized Message type: { name: ${MessageHeader[type]}, type: ${type} }`
    );
  };
}
Field["encode"] = encodeField;
Field["decode"] = decodeField;
Field["fromJSON"] = fieldFromJSON;
Schema["encode"] = encodeSchema;
Schema["decode"] = decodeSchema;
Schema["fromJSON"] = schemaFromJSON;
RecordBatch["encode"] = encodeRecordBatch;
RecordBatch["decode"] = decodeRecordBatch;
RecordBatch["fromJSON"] = recordBatchFromJSON;
DictionaryBatch["encode"] = encodeDictionaryBatch;
DictionaryBatch["decode"] = decodeDictionaryBatch;
DictionaryBatch["fromJSON"] = dictionaryBatchFromJSON;
FieldNode["encode"] = encodeFieldNode;
FieldNode["decode"] = decodeFieldNode;
BufferRegion["encode"] = encodeBufferRegion;
BufferRegion["decode"] = decodeBufferRegion;
/** @ignore */
function decodeSchema(_schema, dictionaries = new Map()) {
  const fields = decodeSchemaFields(_schema, dictionaries);
  return new Schema(fields, decodeCustomMetadata(_schema), dictionaries);
}
/** @ignore */
function decodeRecordBatch(batch, version = MetadataVersion.V4) {
  return new RecordBatch(
    batch.length(),
    decodeFieldNodes(batch),
    decodeBuffers(batch, version)
  );
}
/** @ignore */
function decodeDictionaryBatch(batch, version = MetadataVersion.V4) {
  return new DictionaryBatch(
    RecordBatch.decode(batch.data(), version),
    batch.id(),
    batch.isDelta()
  );
}
/** @ignore */
function decodeBufferRegion(b) {
  return new BufferRegion(b.offset(), b.length());
}
/** @ignore */
function decodeFieldNode(f) {
  return new FieldNode(f.length(), f.nullCount());
}
/** @ignore */
function decodeFieldNodes(batch) {
  const nodes = [];
  for (let f, i = -1, j = -1, n = batch.nodesLength(); ++i < n; ) {
    if ((f = batch.nodes(i))) {
      nodes[++j] = FieldNode.decode(f);
    }
  }
  return nodes;
}
/** @ignore */
function decodeBuffers(batch, version) {
  const bufferRegions = [];
  for (let b, i = -1, j = -1, n = batch.buffersLength(); ++i < n; ) {
    if ((b = batch.buffers(i))) {
      // If this Arrow buffer was written before version 4,
      // advance the buffer's bb_pos 8 bytes to skip past
      // the now-removed page_id field
      if (version < MetadataVersion.V4) {
        b.bb_pos += 8 * (i + 1);
      }
      bufferRegions[++j] = BufferRegion.decode(b);
    }
  }
  return bufferRegions;
}
/** @ignore */
function decodeSchemaFields(schema, dictionaries) {
  const fields = [];
  for (let f, i = -1, j = -1, n = schema.fieldsLength(); ++i < n; ) {
    if ((f = schema.fields(i))) {
      fields[++j] = Field.decode(f, dictionaries);
    }
  }
  return fields;
}
/** @ignore */
function decodeFieldChildren(field, dictionaries) {
  const children = [];
  for (let f, i = -1, j = -1, n = field.childrenLength(); ++i < n; ) {
    if ((f = field.children(i))) {
      children[++j] = Field.decode(f, dictionaries);
    }
  }
  return children;
}
/** @ignore */
function decodeField(f, dictionaries) {
  let id;
  let field;
  let type;
  let keys;
  let dictType;
  let dictMeta;
  // If no dictionary encoding
  if (!dictionaries || !(dictMeta = f.dictionary())) {
    type = decodeFieldType(f, decodeFieldChildren(f, dictionaries));
    field = new Field(f.name(), type, f.nullable(), decodeCustomMetadata(f));
  }
  // tslint:disable
  // If dictionary encoded and the first time we've seen this dictionary id, decode
  // the data type and child fields, then wrap in a Dictionary type and insert the
  // data type into the dictionary types map.
  else if (!dictionaries.has((id = dictMeta.id().low))) {
    // a dictionary index defaults to signed 32 bit int if unspecified
    keys = (keys = dictMeta.indexType()) ? decodeIndexType(keys) : new Int32();
    dictionaries.set(
      id,
      (type = decodeFieldType(f, decodeFieldChildren(f, dictionaries)))
    );
    dictType = new Dictionary(type, keys, id, dictMeta.isOrdered());
    field = new Field(
      f.name(),
      dictType,
      f.nullable(),
      decodeCustomMetadata(f)
    );
  }
  // If dictionary encoded, and have already seen this dictionary Id in the schema, then reuse the
  // data type and wrap in a new Dictionary type and field.
  else {
    // a dictionary index defaults to signed 32 bit int if unspecified
    keys = (keys = dictMeta.indexType()) ? decodeIndexType(keys) : new Int32();
    dictType = new Dictionary(
      dictionaries.get(id),
      keys,
      id,
      dictMeta.isOrdered()
    );
    field = new Field(
      f.name(),
      dictType,
      f.nullable(),
      decodeCustomMetadata(f)
    );
  }
  return field || null;
}
/** @ignore */
function decodeCustomMetadata(parent) {
  const data = new Map();
  if (parent) {
    for (
      let entry, key, i = -1, n = parent.customMetadataLength() | 0;
      ++i < n;

    ) {
      if ((entry = parent.customMetadata(i)) && (key = entry.key()) != null) {
        data.set(key, entry.value());
      }
    }
  }
  return data;
}
/** @ignore */
function decodeIndexType(_type) {
  return new Int(_type.isSigned(), _type.bitWidth());
}
/** @ignore */
function decodeFieldType(f, children) {
  const typeId = f.typeType();
  switch (typeId) {
    case Type.NONE:
      return new Null();
    case Type.Null:
      return new Null();
    case Type.Binary:
      return new Binary();
    case Type.Utf8:
      return new Utf8();
    case Type.Bool:
      return new Bool();
    case Type.List:
      return new List((children || [])[0]);
    case Type.Struct_:
      return new Struct(children || []);
  }
  switch (typeId) {
    case Type.Int: {
      const t = f.type(new Schema_.org.apache.arrow.flatbuf.Int());
      return new Int(t.isSigned(), t.bitWidth());
    }
    case Type.FloatingPoint: {
      const t = f.type(new Schema_.org.apache.arrow.flatbuf.FloatingPoint());
      return new Float(t.precision());
    }
    case Type.Decimal: {
      const t = f.type(new Schema_.org.apache.arrow.flatbuf.Decimal());
      return new Decimal(t.scale(), t.precision());
    }
    case Type.Date: {
      const t = f.type(new Schema_.org.apache.arrow.flatbuf.Date());
      return new Date_(t.unit());
    }
    case Type.Time: {
      const t = f.type(new Schema_.org.apache.arrow.flatbuf.Time());
      return new Time(t.unit(), t.bitWidth());
    }
    case Type.Timestamp: {
      const t = f.type(new Schema_.org.apache.arrow.flatbuf.Timestamp());
      return new Timestamp(t.unit(), t.timezone());
    }
    case Type.Interval: {
      const t = f.type(new Schema_.org.apache.arrow.flatbuf.Interval());
      return new Interval(t.unit());
    }
    case Type.Union: {
      const t = f.type(new Schema_.org.apache.arrow.flatbuf.Union());
      return new Union(t.mode(), t.typeIdsArray() || [], children || []);
    }
    case Type.FixedSizeBinary: {
      const t = f.type(new Schema_.org.apache.arrow.flatbuf.FixedSizeBinary());
      return new FixedSizeBinary(t.byteWidth());
    }
    case Type.FixedSizeList: {
      const t = f.type(new Schema_.org.apache.arrow.flatbuf.FixedSizeList());
      return new FixedSizeList(t.listSize(), (children || [])[0]);
    }
    case Type.Map: {
      const t = f.type(new Schema_.org.apache.arrow.flatbuf.Map());
      return new Map_((children || [])[0], t.keysSorted());
    }
  }
  throw new Error(`Unrecognized type: "${Type[typeId]}" (${typeId})`);
}
/** @ignore */
function encodeSchema(b, schema) {
  const fieldOffsets = schema.fields.map(f => Field.encode(b, f));
  _Schema.startFieldsVector(b, fieldOffsets.length);
  const fieldsVectorOffset = _Schema.createFieldsVector(b, fieldOffsets);
  const metadataOffset = !(schema.metadata && schema.metadata.size > 0)
    ? -1
    : _Schema.createCustomMetadataVector(
        b,
        [...schema.metadata].map(([k, v]) => {
          const key = b.createString(`${k}`);
          const val = b.createString(`${v}`);
          _KeyValue.startKeyValue(b);
          _KeyValue.addKey(b, key);
          _KeyValue.addValue(b, val);
          return _KeyValue.endKeyValue(b);
        })
      );
  _Schema.startSchema(b);
  _Schema.addFields(b, fieldsVectorOffset);
  _Schema.addEndianness(
    b,
    platformIsLittleEndian ? _Endianness.Little : _Endianness.Big
  );
  if (metadataOffset !== -1) {
    _Schema.addCustomMetadata(b, metadataOffset);
  }
  return _Schema.endSchema(b);
}
/** @ignore */
function encodeField(b, field) {
  let nameOffset = -1;
  let typeOffset = -1;
  let dictionaryOffset = -1;
  let type = field.type;
  let typeId = field.typeId;
  if (!DataType.isDictionary(type)) {
    typeOffset = typeAssembler.visit(type, b);
  } else {
    typeId = type.dictionary.typeId;
    dictionaryOffset = typeAssembler.visit(type, b);
    typeOffset = typeAssembler.visit(type.dictionary, b);
  }
  const childOffsets = (type.children || []).map(f => Field.encode(b, f));
  const childrenVectorOffset = _Field.createChildrenVector(b, childOffsets);
  const metadataOffset = !(field.metadata && field.metadata.size > 0)
    ? -1
    : _Field.createCustomMetadataVector(
        b,
        [...field.metadata].map(([k, v]) => {
          const key = b.createString(`${k}`);
          const val = b.createString(`${v}`);
          _KeyValue.startKeyValue(b);
          _KeyValue.addKey(b, key);
          _KeyValue.addValue(b, val);
          return _KeyValue.endKeyValue(b);
        })
      );
  if (field.name) {
    nameOffset = b.createString(field.name);
  }
  _Field.startField(b);
  _Field.addType(b, typeOffset);
  _Field.addTypeType(b, typeId);
  _Field.addChildren(b, childrenVectorOffset);
  _Field.addNullable(b, !!field.nullable);
  if (nameOffset !== -1) {
    _Field.addName(b, nameOffset);
  }
  if (dictionaryOffset !== -1) {
    _Field.addDictionary(b, dictionaryOffset);
  }
  if (metadataOffset !== -1) {
    _Field.addCustomMetadata(b, metadataOffset);
  }
  return _Field.endField(b);
}
/** @ignore */
function encodeRecordBatch(b, recordBatch) {
  const nodes = recordBatch.nodes || [];
  const buffers = recordBatch.buffers || [];
  _RecordBatch.startNodesVector(b, nodes.length);
  nodes
    .slice()
    .reverse()
    .forEach(n => FieldNode.encode(b, n));
  const nodesVectorOffset = b.endVector();
  _RecordBatch.startBuffersVector(b, buffers.length);
  buffers
    .slice()
    .reverse()
    .forEach(b_ => BufferRegion.encode(b, b_));
  const buffersVectorOffset = b.endVector();
  _RecordBatch.startRecordBatch(b);
  _RecordBatch.addLength(b, new Long(recordBatch.length, 0));
  _RecordBatch.addNodes(b, nodesVectorOffset);
  _RecordBatch.addBuffers(b, buffersVectorOffset);
  return _RecordBatch.endRecordBatch(b);
}
/** @ignore */
function encodeDictionaryBatch(b, dictionaryBatch) {
  const dataOffset = RecordBatch.encode(b, dictionaryBatch.data);
  _DictionaryBatch.startDictionaryBatch(b);
  _DictionaryBatch.addId(b, new Long(dictionaryBatch.id, 0));
  _DictionaryBatch.addIsDelta(b, dictionaryBatch.isDelta);
  _DictionaryBatch.addData(b, dataOffset);
  return _DictionaryBatch.endDictionaryBatch(b);
}
/** @ignore */
function encodeFieldNode(b, node) {
  return _FieldNode.createFieldNode(
    b,
    new Long(node.length, 0),
    new Long(node.nullCount, 0)
  );
}
/** @ignore */
function encodeBufferRegion(b, node) {
  return _Buffer.createBuffer(
    b,
    new Long(node.offset, 0),
    new Long(node.length, 0)
  );
}
/** @ignore */
const platformIsLittleEndian = (function() {
  const buffer = new ArrayBuffer(2);
  new DataView(buffer).setInt16(0, 256, true /* littleEndian */);
  // Int16Array uses the platform's endianness.
  return new Int16Array(buffer)[0] === 256;
})();

//# sourceMappingURL=message.mjs.map
