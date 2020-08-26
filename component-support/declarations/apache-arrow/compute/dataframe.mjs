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
import { Table } from "../table";
import { IntVector } from "../vector/int";
import { Field, Schema } from "../schema";
import { Col } from "./predicate";
import { RecordBatch } from "../recordbatch";
import { DataType } from "../type";
Table.prototype.countBy = function(name) {
  return new DataFrame(this.chunks).countBy(name);
};
Table.prototype.scan = function(next, bind) {
  return new DataFrame(this.chunks).scan(next, bind);
};
Table.prototype.scanReverse = function(next, bind) {
  return new DataFrame(this.chunks).scanReverse(next, bind);
};
Table.prototype.filter = function(predicate) {
  return new DataFrame(this.chunks).filter(predicate);
};
export class DataFrame extends Table {
  filter(predicate) {
    return new FilteredDataFrame(this.chunks, predicate);
  }
  scan(next, bind) {
    const batches = this.chunks,
      numBatches = batches.length;
    for (let batchIndex = -1; ++batchIndex < numBatches; ) {
      // load batches
      const batch = batches[batchIndex];
      if (bind) {
        bind(batch);
      }
      // yield all indices
      for (let index = -1, numRows = batch.length; ++index < numRows; ) {
        next(index, batch);
      }
    }
  }
  scanReverse(next, bind) {
    const batches = this.chunks,
      numBatches = batches.length;
    for (let batchIndex = numBatches; --batchIndex >= 0; ) {
      // load batches
      const batch = batches[batchIndex];
      if (bind) {
        bind(batch);
      }
      // yield all indices
      for (let index = batch.length; --index >= 0; ) {
        next(index, batch);
      }
    }
  }
  countBy(name) {
    const batches = this.chunks,
      numBatches = batches.length;
    const count_by = typeof name === "string" ? new Col(name) : name;
    // Assume that all dictionary batches are deltas, which means that the
    // last record batch has the most complete dictionary
    count_by.bind(batches[numBatches - 1]);
    const vector = count_by.vector;
    if (!DataType.isDictionary(vector.type)) {
      throw new Error(
        "countBy currently only supports dictionary-encoded columns"
      );
    }
    const countByteLength = Math.ceil(Math.log(vector.length) / Math.log(256));
    const CountsArrayType =
      countByteLength == 4
        ? Uint32Array
        : countByteLength >= 2
        ? Uint16Array
        : Uint8Array;
    const counts = new CountsArrayType(vector.dictionary.length);
    for (let batchIndex = -1; ++batchIndex < numBatches; ) {
      // load batches
      const batch = batches[batchIndex];
      // rebind the countBy Col
      count_by.bind(batch);
      const keys = count_by.vector.indices;
      // yield all indices
      for (let index = -1, numRows = batch.length; ++index < numRows; ) {
        let key = keys.get(index);
        if (key !== null) {
          counts[key]++;
        }
      }
    }
    return new CountByResult(vector.dictionary, IntVector.from(counts));
  }
}
/** @ignore */
export class CountByResult extends Table {
  constructor(values, counts) {
    const schema = new Schema([
      new Field("values", values.type),
      new Field("counts", counts.type)
    ]);
    super(new RecordBatch(schema, counts.length, [values, counts]));
  }
  toJSON() {
    const values = this.getColumnAt(0);
    const counts = this.getColumnAt(1);
    const result = {};
    for (let i = -1; ++i < this.length; ) {
      result[values.get(i)] = counts.get(i);
    }
    return result;
  }
}
/** @ignore */
export class FilteredDataFrame extends DataFrame {
  constructor(batches, predicate) {
    super(batches);
    this._predicate = predicate;
  }
  scan(next, bind) {
    // inlined version of this:
    // this.parent.scan((idx, columns) => {
    //     if (this.predicate(idx, columns)) next(idx, columns);
    // });
    const batches = this._chunks;
    const numBatches = batches.length;
    for (let batchIndex = -1; ++batchIndex < numBatches; ) {
      // load batches
      const batch = batches[batchIndex];
      const predicate = this._predicate.bind(batch);
      let isBound = false;
      // yield all indices
      for (let index = -1, numRows = batch.length; ++index < numRows; ) {
        if (predicate(index, batch)) {
          // bind batches lazily - if predicate doesn't match anything
          // in the batch we don't need to call bind on the batch
          if (bind && !isBound) {
            bind(batch);
            isBound = true;
          }
          next(index, batch);
        }
      }
    }
  }
  scanReverse(next, bind) {
    const batches = this._chunks;
    const numBatches = batches.length;
    for (let batchIndex = numBatches; --batchIndex >= 0; ) {
      // load batches
      const batch = batches[batchIndex];
      const predicate = this._predicate.bind(batch);
      let isBound = false;
      // yield all indices
      for (let index = batch.length; --index >= 0; ) {
        if (predicate(index, batch)) {
          // bind batches lazily - if predicate doesn't match anything
          // in the batch we don't need to call bind on the batch
          if (bind && !isBound) {
            bind(batch);
            isBound = true;
          }
          next(index, batch);
        }
      }
    }
  }
  count() {
    // inlined version of this:
    // let sum = 0;
    // this.parent.scan((idx, columns) => {
    //     if (this.predicate(idx, columns)) ++sum;
    // });
    // return sum;
    let sum = 0;
    const batches = this._chunks;
    const numBatches = batches.length;
    for (let batchIndex = -1; ++batchIndex < numBatches; ) {
      // load batches
      const batch = batches[batchIndex];
      const predicate = this._predicate.bind(batch);
      // yield all indices
      for (let index = -1, numRows = batch.length; ++index < numRows; ) {
        if (predicate(index, batch)) {
          ++sum;
        }
      }
    }
    return sum;
  }
  *[Symbol.iterator]() {
    // inlined version of this:
    // this.parent.scan((idx, columns) => {
    //     if (this.predicate(idx, columns)) next(idx, columns);
    // });
    const batches = this._chunks;
    const numBatches = batches.length;
    for (let batchIndex = -1; ++batchIndex < numBatches; ) {
      // load batches
      const batch = batches[batchIndex];
      // TODO: bind batches lazily
      // If predicate doesn't match anything in the batch we don't need
      // to bind the callback
      const predicate = this._predicate.bind(batch);
      // yield all indices
      for (let index = -1, numRows = batch.length; ++index < numRows; ) {
        if (predicate(index, batch)) {
          yield batch.get(index);
        }
      }
    }
  }
  filter(predicate) {
    return new FilteredDataFrame(this._chunks, this._predicate.and(predicate));
  }
  countBy(name) {
    const batches = this._chunks,
      numBatches = batches.length;
    const count_by = typeof name === "string" ? new Col(name) : name;
    // Assume that all dictionary batches are deltas, which means that the
    // last record batch has the most complete dictionary
    count_by.bind(batches[numBatches - 1]);
    const vector = count_by.vector;
    if (!DataType.isDictionary(vector.type)) {
      throw new Error(
        "countBy currently only supports dictionary-encoded columns"
      );
    }
    const countByteLength = Math.ceil(Math.log(vector.length) / Math.log(256));
    const CountsArrayType =
      countByteLength == 4
        ? Uint32Array
        : countByteLength >= 2
        ? Uint16Array
        : Uint8Array;
    const counts = new CountsArrayType(vector.dictionary.length);
    for (let batchIndex = -1; ++batchIndex < numBatches; ) {
      // load batches
      const batch = batches[batchIndex];
      const predicate = this._predicate.bind(batch);
      // rebind the countBy Col
      count_by.bind(batch);
      const keys = count_by.vector.indices;
      // yield all indices
      for (let index = -1, numRows = batch.length; ++index < numRows; ) {
        let key = keys.get(index);
        if (key !== null && predicate(index, batch)) {
          counts[key]++;
        }
      }
    }
    return new CountByResult(vector.dictionary, IntVector.from(counts));
  }
}

//# sourceMappingURL=dataframe.mjs.map
