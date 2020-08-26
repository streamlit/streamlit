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
const schema_1 = require("../../schema")
const type_1 = require("../../type")
const message_1 = require("./message")
const enum_1 = require("../../enum")
/** @ignore */
function schemaFromJSON(_schema, dictionaries = new Map()) {
  return new schema_1.Schema(
    schemaFieldsFromJSON(_schema, dictionaries),
    customMetadataFromJSON(_schema["customMetadata"]),
    dictionaries
  )
}
exports.schemaFromJSON = schemaFromJSON
/** @ignore */
function recordBatchFromJSON(b) {
  return new message_1.RecordBatch(
    b["count"],
    fieldNodesFromJSON(b["columns"]),
    buffersFromJSON(b["columns"])
  )
}
exports.recordBatchFromJSON = recordBatchFromJSON
/** @ignore */
function dictionaryBatchFromJSON(b) {
  return new message_1.DictionaryBatch(
    recordBatchFromJSON(b["data"]),
    b["id"],
    b["isDelta"]
  )
}
exports.dictionaryBatchFromJSON = dictionaryBatchFromJSON
/** @ignore */
function schemaFieldsFromJSON(_schema, dictionaries) {
  return (_schema["fields"] || [])
    .filter(Boolean)
    .map(f => schema_1.Field.fromJSON(f, dictionaries))
}
/** @ignore */
function fieldChildrenFromJSON(_field, dictionaries) {
  return (_field["children"] || [])
    .filter(Boolean)
    .map(f => schema_1.Field.fromJSON(f, dictionaries))
}
/** @ignore */
function fieldNodesFromJSON(xs) {
  return (xs || []).reduce(
    (fieldNodes, column) => [
      ...fieldNodes,
      new message_1.FieldNode(
        column["count"],
        nullCountFromJSON(column["VALIDITY"])
      ),
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
      buffers.push(
        new message_1.BufferRegion(buffers.length, column["VALIDITY"].length)
      )
    column["TYPE"] &&
      buffers.push(
        new message_1.BufferRegion(buffers.length, column["TYPE"].length)
      )
    column["OFFSET"] &&
      buffers.push(
        new message_1.BufferRegion(buffers.length, column["OFFSET"].length)
      )
    column["DATA"] &&
      buffers.push(
        new message_1.BufferRegion(buffers.length, column["DATA"].length)
      )
    buffers = buffersFromJSON(column["children"], buffers)
  }
  return buffers
}
/** @ignore */
function nullCountFromJSON(validity) {
  return (validity || []).reduce((sum, val) => sum + +(val === 0), 0)
}
/** @ignore */
function fieldFromJSON(_field, dictionaries) {
  let id
  let keys
  let field
  let dictMeta
  let type
  let dictType
  // If no dictionary encoding
  if (!dictionaries || !(dictMeta = _field["dictionary"])) {
    type = typeFromJSON(_field, fieldChildrenFromJSON(_field, dictionaries))
    field = new schema_1.Field(
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
      : new type_1.Int32()
    dictionaries.set(
      id,
      (type = typeFromJSON(
        _field,
        fieldChildrenFromJSON(_field, dictionaries)
      ))
    )
    dictType = new type_1.Dictionary(type, keys, id, dictMeta["isOrdered"])
    field = new schema_1.Field(
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
      : new type_1.Int32()
    dictType = new type_1.Dictionary(
      dictionaries.get(id),
      keys,
      id,
      dictMeta["isOrdered"]
    )
    field = new schema_1.Field(
      _field["name"],
      dictType,
      _field["nullable"],
      customMetadataFromJSON(_field["customMetadata"])
    )
  }
  return field || null
}
exports.fieldFromJSON = fieldFromJSON
/** @ignore */
function customMetadataFromJSON(_metadata) {
  return new Map(Object.entries(_metadata || {}))
}
/** @ignore */
function indexTypeFromJSON(_type) {
  return new type_1.Int(_type["isSigned"], _type["bitWidth"])
}
/** @ignore */
function typeFromJSON(f, children) {
  const typeId = f["type"]["name"]
  switch (typeId) {
    case "NONE":
      return new type_1.Null()
    case "null":
      return new type_1.Null()
    case "binary":
      return new type_1.Binary()
    case "utf8":
      return new type_1.Utf8()
    case "bool":
      return new type_1.Bool()
    case "list":
      return new type_1.List((children || [])[0])
    case "struct":
      return new type_1.Struct(children || [])
    case "struct_":
      return new type_1.Struct(children || [])
  }
  switch (typeId) {
    case "int": {
      const t = f["type"]
      return new type_1.Int(t["isSigned"], t["bitWidth"])
    }
    case "floatingpoint": {
      const t = f["type"]
      return new type_1.Float(enum_1.Precision[t["precision"]])
    }
    case "decimal": {
      const t = f["type"]
      return new type_1.Decimal(t["scale"], t["precision"])
    }
    case "date": {
      const t = f["type"]
      return new type_1.Date_(enum_1.DateUnit[t["unit"]])
    }
    case "time": {
      const t = f["type"]
      return new type_1.Time(enum_1.TimeUnit[t["unit"]], t["bitWidth"])
    }
    case "timestamp": {
      const t = f["type"]
      return new type_1.Timestamp(enum_1.TimeUnit[t["unit"]], t["timezone"])
    }
    case "interval": {
      const t = f["type"]
      return new type_1.Interval(enum_1.IntervalUnit[t["unit"]])
    }
    case "union": {
      const t = f["type"]
      return new type_1.Union(
        enum_1.UnionMode[t["mode"]],
        t["typeIds"] || [],
        children || []
      )
    }
    case "fixedsizebinary": {
      const t = f["type"]
      return new type_1.FixedSizeBinary(t["byteWidth"])
    }
    case "fixedsizelist": {
      const t = f["type"]
      return new type_1.FixedSizeList(t["listSize"], (children || [])[0])
    }
    case "map": {
      const t = f["type"]
      return new type_1.Map_((children || [])[0], t["keysSorted"])
    }
  }
  throw new Error(`Unrecognized type: "${typeId}"`)
}

//# sourceMappingURL=json.js.map
