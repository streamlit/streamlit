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
import { Schema, Field } from "../../schema"
import {
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
  Int32,
} from "../../type"
import {
  DictionaryBatch,
  RecordBatch,
  FieldNode,
  BufferRegion,
} from "./message"
import {
  TimeUnit,
  Precision,
  IntervalUnit,
  UnionMode,
  DateUnit,
} from "../../enum"
/** @ignore */
export function schemaFromJSON(_schema, dictionaries = new Map()) {
  return new Schema(
    schemaFieldsFromJSON(_schema, dictionaries),
    customMetadataFromJSON(_schema["customMetadata"]),
    dictionaries
  )
}
/** @ignore */
export function recordBatchFromJSON(b) {
  return new RecordBatch(
    b["count"],
    fieldNodesFromJSON(b["columns"]),
    buffersFromJSON(b["columns"])
  )
}
/** @ignore */
export function dictionaryBatchFromJSON(b) {
  return new DictionaryBatch(
    recordBatchFromJSON(b["data"]),
    b["id"],
    b["isDelta"]
  )
}
/** @ignore */
function schemaFieldsFromJSON(_schema, dictionaries) {
  return (_schema["fields"] || [])
    .filter(Boolean)
    .map(f => Field.fromJSON(f, dictionaries))
}
/** @ignore */
function fieldChildrenFromJSON(_field, dictionaries) {
  return (_field["children"] || [])
    .filter(Boolean)
    .map(f => Field.fromJSON(f, dictionaries))
}
/** @ignore */
function fieldNodesFromJSON(xs) {
  return (xs || []).reduce(
    (fieldNodes, column) => [
      ...fieldNodes,
      new FieldNode(column["count"], nullCountFromJSON(column["VALIDITY"])),
      ...fieldNodesFromJSON(column["children"]),
    ],
    []
  )
}
/** @ignore */
function buffersFromJSON(xs, buffers = []) {
  for (let i = -1, n = (xs || []).length; ++i < n; ) {
    const column = xs[i]
    column["VALIDITY"] &&
      buffers.push(new BufferRegion(buffers.length, column["VALIDITY"].length))
    column["TYPE"] &&
      buffers.push(new BufferRegion(buffers.length, column["TYPE"].length))
    column["OFFSET"] &&
      buffers.push(new BufferRegion(buffers.length, column["OFFSET"].length))
    column["DATA"] &&
      buffers.push(new BufferRegion(buffers.length, column["DATA"].length))
    buffers = buffersFromJSON(column["children"], buffers)
  }
  return buffers
}
/** @ignore */
function nullCountFromJSON(validity) {
  return (validity || []).reduce((sum, val) => sum + +(val === 0), 0)
}
/** @ignore */
export function fieldFromJSON(_field, dictionaries) {
  let id
  let keys
  let field
  let dictMeta
  let type
  let dictType
  // If no dictionary encoding
  if (!dictionaries || !(dictMeta = _field["dictionary"])) {
    type = typeFromJSON(_field, fieldChildrenFromJSON(_field, dictionaries))
    field = new Field(
      _field["name"],
      type,
      _field["nullable"],
      customMetadataFromJSON(_field["customMetadata"])
    )
  }
  // tslint:disable
  // If dictionary encoded and the first time we've seen this dictionary id, decode
  // the data type and child fields, then wrap in a Dictionary type and insert the
  // data type into the dictionary types map.
  else if (!dictionaries.has((id = dictMeta["id"]))) {
    // a dictionary index defaults to signed 32 bit int if unspecified
    keys = (keys = dictMeta["indexType"])
      ? indexTypeFromJSON(keys)
      : new Int32()
    dictionaries.set(
      id,
      (type = typeFromJSON(
        _field,
        fieldChildrenFromJSON(_field, dictionaries)
      ))
    )
    dictType = new Dictionary(type, keys, id, dictMeta["isOrdered"])
    field = new Field(
      _field["name"],
      dictType,
      _field["nullable"],
      customMetadataFromJSON(_field["customMetadata"])
    )
  }
  // If dictionary encoded, and have already seen this dictionary Id in the schema, then reuse the
  // data type and wrap in a new Dictionary type and field.
  else {
    // a dictionary index defaults to signed 32 bit int if unspecified
    keys = (keys = dictMeta["indexType"])
      ? indexTypeFromJSON(keys)
      : new Int32()
    dictType = new Dictionary(
      dictionaries.get(id),
      keys,
      id,
      dictMeta["isOrdered"]
    )
    field = new Field(
      _field["name"],
      dictType,
      _field["nullable"],
      customMetadataFromJSON(_field["customMetadata"])
    )
  }
  return field || null
}
/** @ignore */
function customMetadataFromJSON(_metadata) {
  return new Map(Object.entries(_metadata || {}))
}
/** @ignore */
function indexTypeFromJSON(_type) {
  return new Int(_type["isSigned"], _type["bitWidth"])
}
/** @ignore */
function typeFromJSON(f, children) {
  const typeId = f["type"]["name"]
  switch (typeId) {
    case "NONE":
      return new Null()
    case "null":
      return new Null()
    case "binary":
      return new Binary()
    case "utf8":
      return new Utf8()
    case "bool":
      return new Bool()
    case "list":
      return new List((children || [])[0])
    case "struct":
      return new Struct(children || [])
    case "struct_":
      return new Struct(children || [])
  }
  switch (typeId) {
    case "int": {
      const t = f["type"]
      return new Int(t["isSigned"], t["bitWidth"])
    }
    case "floatingpoint": {
      const t = f["type"]
      return new Float(Precision[t["precision"]])
    }
    case "decimal": {
      const t = f["type"]
      return new Decimal(t["scale"], t["precision"])
    }
    case "date": {
      const t = f["type"]
      return new Date_(DateUnit[t["unit"]])
    }
    case "time": {
      const t = f["type"]
      return new Time(TimeUnit[t["unit"]], t["bitWidth"])
    }
    case "timestamp": {
      const t = f["type"]
      return new Timestamp(TimeUnit[t["unit"]], t["timezone"])
    }
    case "interval": {
      const t = f["type"]
      return new Interval(IntervalUnit[t["unit"]])
    }
    case "union": {
      const t = f["type"]
      return new Union(
        UnionMode[t["mode"]],
        t["typeIds"] || [],
        children || []
      )
    }
    case "fixedsizebinary": {
      const t = f["type"]
      return new FixedSizeBinary(t["byteWidth"])
    }
    case "fixedsizelist": {
      const t = f["type"]
      return new FixedSizeList(t["listSize"], (children || [])[0])
    }
    case "map": {
      const t = f["type"]
      return new Map_((children || [])[0], t["keysSorted"])
    }
  }
  throw new Error(`Unrecognized type: "${typeId}"`)
}

//# sourceMappingURL=json.mjs.map
