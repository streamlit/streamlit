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
const data_1 = require("../data")
const schema_1 = require("../schema")
const chunked_1 = require("../vector/chunked")
const recordbatch_1 = require("../recordbatch")
const noopBuf = new Uint8Array(0)
const nullBufs = bitmapLength => [
  noopBuf,
  noopBuf,
  new Uint8Array(bitmapLength),
  noopBuf,
]
/** @ignore */
function ensureSameLengthData(
  schema,
  chunks,
  batchLength = chunks.reduce((l, c) => Math.max(l, c.length), 0)
) {
  let data
  let field
  let i = -1,
    n = chunks.length
  const fields = [...schema.fields]
  const batchData = []
  const bitmapLength = ((batchLength + 63) & ~63) >> 3
  while (++i < n) {
    if ((data = chunks[i]) && data.length === batchLength) {
      batchData[i] = data
    } else {
      ;(field = fields[i]).nullable ||
        (fields[i] = fields[i].clone({ nullable: true }))
      batchData[i] = data
        ? data._changeLengthAndBackfillNullBitmap(batchLength)
        : data_1.Data.new(
            field.type,
            0,
            batchLength,
            batchLength,
            nullBufs(bitmapLength)
          )
    }
  }
  return [new schema_1.Schema(fields), batchLength, batchData]
}
exports.ensureSameLengthData = ensureSameLengthData
/** @ignore */
function distributeColumnsIntoRecordBatches(columns) {
  return distributeVectorsIntoRecordBatches(
    new schema_1.Schema(columns.map(({ field }) => field)),
    columns
  )
}
exports.distributeColumnsIntoRecordBatches = distributeColumnsIntoRecordBatches
/** @ignore */
function distributeVectorsIntoRecordBatches(schema, vecs) {
  return uniformlyDistributeChunksAcrossRecordBatches(
    schema,
    vecs.map(v =>
      v instanceof chunked_1.Chunked ? v.chunks.map(c => c.data) : [v.data]
    )
  )
}
exports.distributeVectorsIntoRecordBatches = distributeVectorsIntoRecordBatches
/** @ignore */
function uniformlyDistributeChunksAcrossRecordBatches(schema, columns) {
  const fields = [...schema.fields]
  const batchArgs = []
  const memo = {
    numBatches: columns.reduce((n, c) => Math.max(n, c.length), 0),
  }
  let numBatches = 0,
    batchLength = 0
  let i = -1,
    numColumns = columns.length
  let child,
    childData = []
  while (memo.numBatches-- > 0) {
    for (batchLength = Number.POSITIVE_INFINITY, i = -1; ++i < numColumns; ) {
      childData[i] = child = columns[i].shift()
      batchLength = Math.min(batchLength, child ? child.length : batchLength)
    }
    if (isFinite(batchLength)) {
      childData = distributeChildData(
        fields,
        batchLength,
        childData,
        columns,
        memo
      )
      if (batchLength > 0) {
        batchArgs[numBatches++] = [batchLength, childData.slice()]
      }
    }
  }
  return [
    (schema = new schema_1.Schema(fields, schema.metadata)),
    batchArgs.map(xs => new recordbatch_1.RecordBatch(schema, ...xs)),
  ]
}
/** @ignore */
function distributeChildData(fields, batchLength, childData, columns, memo) {
  let data
  let field
  let length = 0,
    i = -1,
    n = columns.length
  const bitmapLength = ((batchLength + 63) & ~63) >> 3
  while (++i < n) {
    if ((data = childData[i]) && (length = data.length) >= batchLength) {
      if (length === batchLength) {
        childData[i] = data
      } else {
        childData[i] = data.slice(0, batchLength)
        data = data.slice(batchLength, length - batchLength)
        memo.numBatches = Math.max(memo.numBatches, columns[i].unshift(data))
      }
    } else {
      ;(field = fields[i]).nullable ||
        (fields[i] = field.clone({ nullable: true }))
      childData[i] = data
        ? data._changeLengthAndBackfillNullBitmap(batchLength)
        : data_1.Data.new(
            field.type,
            0,
            batchLength,
            batchLength,
            nullBufs(bitmapLength)
          )
    }
  }
  return childData
}

//# sourceMappingURL=recordbatch.js.map
