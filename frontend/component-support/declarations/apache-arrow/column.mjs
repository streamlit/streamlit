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
import { Field } from "./schema"
import { Vector } from "./vector"
import { Chunked } from "./vector/chunked"
export class Column extends Chunked {
  constructor(field, vectors = [], offsets) {
    vectors = Chunked.flatten(...vectors)
    super(field.type, vectors, offsets)
    this._field = field
    if (vectors.length === 1 && !(this instanceof SingleChunkColumn)) {
      return new SingleChunkColumn(field, vectors[0], this._chunkOffsets)
    }
  }
  /** @nocollapse */
  static new(field, data, ...rest) {
    const chunks = Chunked.flatten(
      Array.isArray(data)
        ? [...data, ...rest]
        : data instanceof Vector
        ? [data, ...rest]
        : [Vector.new(data, ...rest)]
    )
    if (typeof field === "string") {
      const type = chunks[0].data.type
      field = new Field(field, type, true)
    } else if (
      !field.nullable &&
      chunks.some(({ nullCount }) => nullCount > 0)
    ) {
      field = field.clone({ nullable: true })
    }
    return new Column(field, chunks)
  }
  get field() {
    return this._field
  }
  get name() {
    return this._field.name
  }
  get nullable() {
    return this._field.nullable
  }
  get metadata() {
    return this._field.metadata
  }
  clone(chunks = this._chunks) {
    return new Column(this._field, chunks)
  }
  getChildAt(index) {
    if (index < 0 || index >= this.numChildren) {
      return null
    }
    let columns = this._children || (this._children = [])
    let column, field, chunks
    if ((column = columns[index])) {
      return column
    }
    if ((field = (this.type.children || [])[index])) {
      chunks = this._chunks
        .map(vector => vector.getChildAt(index))
        .filter(vec => vec != null)
      if (chunks.length > 0) {
        return (columns[index] = new Column(field, chunks))
      }
    }
    return null
  }
}
/** @ignore */
class SingleChunkColumn extends Column {
  constructor(field, vector, offsets) {
    super(field, [vector], offsets)
    this._chunk = vector
  }
  search(index, then) {
    return then ? then(this, 0, index) : [0, index]
  }
  isValid(index) {
    return this._chunk.isValid(index)
  }
  get(index) {
    return this._chunk.get(index)
  }
  set(index, value) {
    this._chunk.set(index, value)
  }
  indexOf(element, offset) {
    return this._chunk.indexOf(element, offset)
  }
}

//# sourceMappingURL=column.mjs.map
