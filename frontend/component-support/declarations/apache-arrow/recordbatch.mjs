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
import { Data } from "./data"
import { Table } from "./table"
import { Vector } from "./vector"
import { Visitor } from "./visitor"
import { Schema } from "./schema"
import { isIterable } from "./util/compat"
import { Chunked } from "./vector/chunked"
import { selectFieldArgs } from "./util/args"
import { DataType, Struct } from "./type"
import { ensureSameLengthData } from "./util/recordbatch"
import { StructVector } from "./vector/index"
export class RecordBatch extends StructVector {
  constructor(...args) {
    let data
    let schema = args[0]
    let children
    if (args[1] instanceof Data) {
      ;[, data, children] = args
    } else {
      const fields = schema.fields
      const [, length, childData] = args
      data = Data.Struct(new Struct(fields), 0, length, 0, null, childData)
    }
    super(data, children)
    this._schema = schema
  }
  /** @nocollapse */
  static from(options) {
    if (isIterable(options["values"])) {
      return Table.from(options)
    }
    return Table.from(options)
  }
  /** @nocollapse */
  static new(...args) {
    const [fs, xs] = selectFieldArgs(args)
    const vs = xs.filter(x => x instanceof Vector)
    return new RecordBatch(
      ...ensureSameLengthData(new Schema(fs), vs.map(x => x.data))
    )
  }
  clone(data, children = this._children) {
    return new RecordBatch(this._schema, data, children)
  }
  concat(...others) {
    const schema = this._schema,
      chunks = Chunked.flatten(this, ...others)
    return new Table(
      schema,
      chunks.map(({ data }) => new RecordBatch(schema, data))
    )
  }
  get schema() {
    return this._schema
  }
  get numCols() {
    return this._schema.fields.length
  }
  get dictionaries() {
    return (
      this._dictionaries ||
      (this._dictionaries = DictionaryCollector.collect(this))
    )
  }
  select(...columnNames) {
    const nameToIndex = this._schema.fields.reduce(
      (m, f, i) => m.set(f.name, i),
      new Map()
    )
    return this.selectAt(
      ...columnNames
        .map(columnName => nameToIndex.get(columnName))
        .filter(x => x > -1)
    )
  }
  selectAt(...columnIndices) {
    const schema = this._schema.selectAt(...columnIndices)
    const childData = columnIndices
      .map(i => this.data.childData[i])
      .filter(Boolean)
    return new RecordBatch(schema, this.length, childData)
  }
}
/**
 * An internal class used by the `RecordBatchReader` and `RecordBatchWriter`
 * implementations to differentiate between a stream with valid zero-length
 * RecordBatches, and a stream with a Schema message, but no RecordBatches.
 * @see https://github.com/apache/arrow/pull/4373
 * @ignore
 * @private
 */
/* tslint:disable:class-name */
export class _InternalEmptyPlaceholderRecordBatch extends RecordBatch {
  constructor(schema) {
    super(schema, 0, schema.fields.map(f => Data.new(f.type, 0, 0, 0)))
  }
}
/** @ignore */
class DictionaryCollector extends Visitor {
  constructor() {
    super(...arguments)
    this.dictionaries = new Map()
  }
  static collect(batch) {
    return new DictionaryCollector().visit(
      batch.data,
      new Struct(batch.schema.fields)
    ).dictionaries
  }
  visit(data, type) {
    if (DataType.isDictionary(type)) {
      return this.visitDictionary(data, type)
    } else {
      data.childData.forEach((child, i) =>
        this.visit(child, type.children[i].type)
      )
    }
    return this
  }
  visitDictionary(data, type) {
    const dictionary = data.dictionary
    if (dictionary && dictionary.length > 0) {
      this.dictionaries.set(type.id, dictionary)
    }
    return this
  }
}

//# sourceMappingURL=recordbatch.mjs.map
