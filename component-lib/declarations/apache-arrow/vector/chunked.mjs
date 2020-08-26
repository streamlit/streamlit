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
import { clampRange } from "../util/vector";
import { DataType } from "../type";
import { selectChunkArgs } from "../util/args";
import { AbstractVector, Vector } from "../vector";
/** @ignore */
export class Chunked extends AbstractVector {
  constructor(type, chunks = [], offsets = calculateOffsets(chunks)) {
    super();
    this._nullCount = -1;
    this._type = type;
    this._chunks = chunks;
    this._chunkOffsets = offsets;
    this._length = offsets[offsets.length - 1];
    this._numChildren = (this._type.children || []).length;
  }
  /** @nocollapse */
  static flatten(...vectors) {
    return selectChunkArgs(Vector, vectors);
  }
  /** @nocollapse */
  static concat(...vectors) {
    const chunks = Chunked.flatten(...vectors);
    return new Chunked(chunks[0].type, chunks);
  }
  get type() {
    return this._type;
  }
  get length() {
    return this._length;
  }
  get chunks() {
    return this._chunks;
  }
  get typeId() {
    return this._type.typeId;
  }
  get VectorName() {
    return `Chunked<${this._type}>`;
  }
  get data() {
    return this._chunks[0] ? this._chunks[0].data : null;
  }
  get ArrayType() {
    return this._type.ArrayType;
  }
  get numChildren() {
    return this._numChildren;
  }
  get stride() {
    return this._chunks[0] ? this._chunks[0].stride : 1;
  }
  get byteLength() {
    return this._chunks.reduce(
      (byteLength, chunk) => byteLength + chunk.byteLength,
      0
    );
  }
  get nullCount() {
    let nullCount = this._nullCount;
    if (nullCount < 0) {
      this._nullCount = nullCount = this._chunks.reduce(
        (x, { nullCount }) => x + nullCount,
        0
      );
    }
    return nullCount;
  }
  get indices() {
    if (DataType.isDictionary(this._type)) {
      if (!this._indices) {
        const chunks = this._chunks;
        this._indices =
          chunks.length === 1
            ? chunks[0].indices
            : Chunked.concat(...chunks.map(x => x.indices));
      }
      return this._indices;
    }
    return null;
  }
  get dictionary() {
    if (DataType.isDictionary(this._type)) {
      return this._chunks[this._chunks.length - 1].data.dictionary;
    }
    return null;
  }
  *[Symbol.iterator]() {
    for (const chunk of this._chunks) {
      yield* chunk;
    }
  }
  clone(chunks = this._chunks) {
    return new Chunked(this._type, chunks);
  }
  concat(...others) {
    return this.clone(Chunked.flatten(this, ...others));
  }
  slice(begin, end) {
    return clampRange(this, begin, end, this._sliceInternal);
  }
  getChildAt(index) {
    if (index < 0 || index >= this._numChildren) {
      return null;
    }
    let columns = this._children || (this._children = []);
    let child, field, chunks;
    if ((child = columns[index])) {
      return child;
    }
    if ((field = (this._type.children || [])[index])) {
      chunks = this._chunks
        .map(vector => vector.getChildAt(index))
        .filter(vec => vec != null);
      if (chunks.length > 0) {
        return (columns[index] = new Chunked(field.type, chunks));
      }
    }
    return null;
  }
  search(index, then) {
    let idx = index;
    // binary search to find the child vector and value indices
    let offsets = this._chunkOffsets,
      rhs = offsets.length - 1;
    // return early if out of bounds, or if there's just one child
    if (idx < 0) {
      return null;
    }
    if (idx >= offsets[rhs]) {
      return null;
    }
    if (rhs <= 1) {
      return then ? then(this, 0, idx) : [0, idx];
    }
    let lhs = 0,
      pos = 0,
      mid = 0;
    do {
      if (lhs + 1 === rhs) {
        return then ? then(this, lhs, idx - pos) : [lhs, idx - pos];
      }
      mid = (lhs + (rhs - lhs) / 2) | 0;
      idx >= offsets[mid] ? (lhs = mid) : (rhs = mid);
    } while (idx < offsets[rhs] && idx >= (pos = offsets[lhs]));
    return null;
  }
  isValid(index) {
    return !!this.search(index, this.isValidInternal);
  }
  get(index) {
    return this.search(index, this.getInternal);
  }
  set(index, value) {
    this.search(index, ({ chunks }, i, j) => chunks[i].set(j, value));
  }
  indexOf(element, offset) {
    if (offset && typeof offset === "number") {
      return this.search(offset, (self, i, j) =>
        this.indexOfInternal(self, i, j, element)
      );
    }
    return this.indexOfInternal(this, 0, Math.max(0, offset || 0), element);
  }
  toArray() {
    const { chunks } = this;
    const n = chunks.length;
    let ArrayType = this._type.ArrayType;
    if (n <= 0) {
      return new ArrayType(0);
    }
    if (n <= 1) {
      return chunks[0].toArray();
    }
    let len = 0,
      src = new Array(n);
    for (let i = -1; ++i < n; ) {
      len += (src[i] = chunks[i].toArray()).length;
    }
    if (ArrayType !== src[0].constructor) {
      ArrayType = src[0].constructor;
    }
    let dst = new ArrayType(len);
    let set = ArrayType === Array ? arraySet : typedSet;
    for (let i = -1, idx = 0; ++i < n; ) {
      idx = set(src[i], dst, idx);
    }
    return dst;
  }
  getInternal({ _chunks }, i, j) {
    return _chunks[i].get(j);
  }
  isValidInternal({ _chunks }, i, j) {
    return _chunks[i].isValid(j);
  }
  indexOfInternal({ _chunks }, chunkIndex, fromIndex, element) {
    let i = chunkIndex - 1,
      n = _chunks.length;
    let start = fromIndex,
      offset = 0,
      found = -1;
    while (++i < n) {
      if (~(found = _chunks[i].indexOf(element, start))) {
        return offset + found;
      }
      start = 0;
      offset += _chunks[i].length;
    }
    return -1;
  }
  _sliceInternal(self, begin, end) {
    const slices = [];
    const { chunks, _chunkOffsets: chunkOffsets } = self;
    for (let i = -1, n = chunks.length; ++i < n; ) {
      const chunk = chunks[i];
      const chunkLength = chunk.length;
      const chunkOffset = chunkOffsets[i];
      // If the child is to the right of the slice boundary, we can stop
      if (chunkOffset >= end) {
        break;
      }
      // If the child is to the left of of the slice boundary, exclude
      if (begin >= chunkOffset + chunkLength) {
        continue;
      }
      // If the child is between both left and right boundaries, include w/o slicing
      if (chunkOffset >= begin && chunkOffset + chunkLength <= end) {
        slices.push(chunk);
        continue;
      }
      // If the child overlaps one of the slice boundaries, include that slice
      const from = Math.max(0, begin - chunkOffset);
      const to = Math.min(end - chunkOffset, chunkLength);
      slices.push(chunk.slice(from, to));
    }
    return self.clone(slices);
  }
}
/** @ignore */
function calculateOffsets(vectors) {
  let offsets = new Uint32Array((vectors || []).length + 1);
  let offset = (offsets[0] = 0),
    length = offsets.length;
  for (let index = 0; ++index < length; ) {
    offsets[index] = offset += vectors[index - 1].length;
  }
  return offsets;
}
/** @ignore */
const typedSet = (src, dst, offset) => {
  dst.set(src, offset);
  return offset + src.length;
};
/** @ignore */
const arraySet = (src, dst, offset) => {
  let idx = offset;
  for (let i = -1, n = src.length; ++i < n; ) {
    dst[idx++] = src[i];
  }
  return idx;
};

//# sourceMappingURL=chunked.mjs.map
