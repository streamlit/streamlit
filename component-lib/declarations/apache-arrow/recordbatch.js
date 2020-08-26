"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const data_1 = require("./data");
const table_1 = require("./table");
const vector_1 = require("./vector");
const visitor_1 = require("./visitor");
const schema_1 = require("./schema");
const compat_1 = require("./util/compat");
const chunked_1 = require("./vector/chunked");
const args_1 = require("./util/args");
const type_1 = require("./type");
const recordbatch_1 = require("./util/recordbatch");
const index_1 = require("./vector/index");
class RecordBatch extends index_1.StructVector {
  constructor(...args) {
    let data;
    let schema = args[0];
    let children;
    if (args[1] instanceof data_1.Data) {
      [, data, children] = args;
    } else {
      const fields = schema.fields;
      const [, length, childData] = args;
      data = data_1.Data.Struct(
        new type_1.Struct(fields),
        0,
        length,
        0,
        null,
        childData
      );
    }
    super(data, children);
    this._schema = schema;
  }
  /** @nocollapse */
  static from(options) {
    if (compat_1.isIterable(options["values"])) {
      return table_1.Table.from(options);
    }
    return table_1.Table.from(options);
  }
  /** @nocollapse */
  static new(...args) {
    const [fs, xs] = args_1.selectFieldArgs(args);
    const vs = xs.filter(x => x instanceof vector_1.Vector);
    return new RecordBatch(
      ...recordbatch_1.ensureSameLengthData(
        new schema_1.Schema(fs),
        vs.map(x => x.data)
      )
    );
  }
  clone(data, children = this._children) {
    return new RecordBatch(this._schema, data, children);
  }
  concat(...others) {
    const schema = this._schema,
      chunks = chunked_1.Chunked.flatten(this, ...others);
    return new table_1.Table(
      schema,
      chunks.map(({ data }) => new RecordBatch(schema, data))
    );
  }
  get schema() {
    return this._schema;
  }
  get numCols() {
    return this._schema.fields.length;
  }
  get dictionaries() {
    return (
      this._dictionaries ||
      (this._dictionaries = DictionaryCollector.collect(this))
    );
  }
  select(...columnNames) {
    const nameToIndex = this._schema.fields.reduce(
      (m, f, i) => m.set(f.name, i),
      new Map()
    );
    return this.selectAt(
      ...columnNames
        .map(columnName => nameToIndex.get(columnName))
        .filter(x => x > -1)
    );
  }
  selectAt(...columnIndices) {
    const schema = this._schema.selectAt(...columnIndices);
    const childData = columnIndices
      .map(i => this.data.childData[i])
      .filter(Boolean);
    return new RecordBatch(schema, this.length, childData);
  }
}
exports.RecordBatch = RecordBatch;
/**
 * An internal class used by the `RecordBatchReader` and `RecordBatchWriter`
 * implementations to differentiate between a stream with valid zero-length
 * RecordBatches, and a stream with a Schema message, but no RecordBatches.
 * @see https://github.com/apache/arrow/pull/4373
 * @ignore
 * @private
 */
/* tslint:disable:class-name */
class _InternalEmptyPlaceholderRecordBatch extends RecordBatch {
  constructor(schema) {
    super(schema, 0, schema.fields.map(f => data_1.Data.new(f.type, 0, 0, 0)));
  }
}
exports._InternalEmptyPlaceholderRecordBatch = _InternalEmptyPlaceholderRecordBatch;
/** @ignore */
class DictionaryCollector extends visitor_1.Visitor {
  constructor() {
    super(...arguments);
    this.dictionaries = new Map();
  }
  static collect(batch) {
    return new DictionaryCollector().visit(
      batch.data,
      new type_1.Struct(batch.schema.fields)
    ).dictionaries;
  }
  visit(data, type) {
    if (type_1.DataType.isDictionary(type)) {
      return this.visitDictionary(data, type);
    } else {
      data.childData.forEach((child, i) =>
        this.visit(child, type.children[i].type)
      );
    }
    return this;
  }
  visitDictionary(data, type) {
    const dictionary = data.dictionary;
    if (dictionary && dictionary.length > 0) {
      this.dictionaries.set(type.id, dictionary);
    }
    return this;
  }
}

//# sourceMappingURL=recordbatch.js.map
