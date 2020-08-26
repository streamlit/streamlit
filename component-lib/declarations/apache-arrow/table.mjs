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
import { Column } from "./column";
import { Schema } from "./schema";
import {
  RecordBatch,
  _InternalEmptyPlaceholderRecordBatch
} from "./recordbatch";
import { RecordBatchReader } from "./ipc/reader";
import { Struct } from "./type";
import { selectColumnArgs, selectArgs } from "./util/args";
import { isPromise, isIterable, isAsyncIterable } from "./util/compat";
import { RecordBatchFileWriter, RecordBatchStreamWriter } from "./ipc/writer";
import {
  distributeColumnsIntoRecordBatches,
  distributeVectorsIntoRecordBatches
} from "./util/recordbatch";
import { Chunked, StructVector } from "./vector/index";
export class Table extends Chunked {
  constructor(...args) {
    let schema = null;
    if (args[0] instanceof Schema) {
      schema = args.shift();
    }
    let chunks = selectArgs(RecordBatch, args);
    if (!schema && !(schema = chunks[0] && chunks[0].schema)) {
      throw new TypeError(
        "Table must be initialized with a Schema or at least one RecordBatch"
      );
    }
    chunks[0] ||
      (chunks[0] = new _InternalEmptyPlaceholderRecordBatch(schema));
    super(new Struct(schema.fields), chunks);
    this._schema = schema;
    this._chunks = chunks;
  }
  /** @nocollapse */
  static empty(schema = new Schema([])) {
    return new Table(schema, []);
  }
  /** @nocollapse */
  static from(input) {
    if (!input) {
      return Table.empty();
    }
    if (typeof input === "object") {
      let table = isIterable(input["values"])
        ? tableFromIterable(input)
        : isAsyncIterable(input["values"])
        ? tableFromAsyncIterable(input)
        : null;
      if (table !== null) {
        return table;
      }
    }
    let reader = RecordBatchReader.from(input);
    if (isPromise(reader)) {
      return (async () => await Table.from(await reader))();
    }
    if (reader.isSync() && (reader = reader.open())) {
      return !reader.schema
        ? Table.empty()
        : new Table(reader.schema, [...reader]);
    }
    return (async opening => {
      const reader = await opening;
      const schema = reader.schema;
      const batches = [];
      if (schema) {
        for await (let batch of reader) {
          batches.push(batch);
        }
        return new Table(schema, batches);
      }
      return Table.empty();
    })(reader.open());
  }
  /** @nocollapse */
  static async fromAsync(source) {
    return await Table.from(source);
  }
  /** @nocollapse */
  static fromStruct(vector) {
    return Table.new(vector.data.childData, vector.type.children);
  }
  /** @nocollapse */
  static new(...cols) {
    return new Table(
      ...distributeColumnsIntoRecordBatches(selectColumnArgs(cols))
    );
  }
  get schema() {
    return this._schema;
  }
  get length() {
    return this._length;
  }
  get chunks() {
    return this._chunks;
  }
  get numCols() {
    return this._numChildren;
  }
  clone(chunks = this._chunks) {
    return new Table(this._schema, chunks);
  }
  getColumn(name) {
    return this.getColumnAt(this.getColumnIndex(name));
  }
  getColumnAt(index) {
    return this.getChildAt(index);
  }
  getColumnIndex(name) {
    return this._schema.fields.findIndex(f => f.name === name);
  }
  getChildAt(index) {
    if (index < 0 || index >= this.numChildren) {
      return null;
    }
    let field, child;
    const fields = this._schema.fields;
    const columns = this._children || (this._children = []);
    if ((child = columns[index])) {
      return child;
    }
    if ((field = fields[index])) {
      const chunks = this._chunks
        .map(chunk => chunk.getChildAt(index))
        .filter(vec => vec != null);
      if (chunks.length > 0) {
        return (columns[index] = new Column(field, chunks));
      }
    }
    return null;
  }
  // @ts-ignore
  serialize(encoding = "binary", stream = true) {
    const Writer = !stream ? RecordBatchFileWriter : RecordBatchStreamWriter;
    return Writer.writeAll(this).toUint8Array(true);
  }
  count() {
    return this._length;
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
    return new Table(
      schema,
      this._chunks.map(({ length, data: { childData } }) => {
        return new RecordBatch(
          schema,
          length,
          columnIndices.map(i => childData[i]).filter(Boolean)
        );
      })
    );
  }
  assign(other) {
    const fields = this._schema.fields;
    const [indices, oldToNew] = other.schema.fields.reduce(
      (memo, f2, newIdx) => {
        const [indices, oldToNew] = memo;
        const i = fields.findIndex(f => f.name === f2.name);
        ~i ? (oldToNew[i] = newIdx) : indices.push(newIdx);
        return memo;
      },
      [[], []]
    );
    const schema = this._schema.assign(other.schema);
    const columns = [
      ...fields.map((_f, i, _fs, j = oldToNew[i]) =>
        j === undefined ? this.getColumnAt(i) : other.getColumnAt(j)
      ),
      ...indices.map(i => other.getColumnAt(i))
    ].filter(Boolean);
    return new Table(...distributeVectorsIntoRecordBatches(schema, columns));
  }
}
function tableFromIterable(input) {
  const { type } = input;
  if (type instanceof Struct) {
    return Table.fromStruct(StructVector.from(input));
  }
  return null;
}
function tableFromAsyncIterable(input) {
  const { type } = input;
  if (type instanceof Struct) {
    return StructVector.from(input).then(vector => Table.fromStruct(vector));
  }
  return null;
}

//# sourceMappingURL=table.mjs.map
