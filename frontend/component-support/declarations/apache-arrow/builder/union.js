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
const schema_1 = require("../schema")
const buffer_1 = require("./buffer")
const builder_1 = require("../builder")
const type_1 = require("../type")
/** @ignore */
class UnionBuilder extends builder_1.Builder {
  constructor(options) {
    super(options)
    this._typeIds = new buffer_1.DataBufferBuilder(new Int8Array(0), 1)
    if (typeof options["valueToChildTypeId"] === "function") {
      this._valueToChildTypeId = options["valueToChildTypeId"]
    }
  }
  get typeIdToChildIndex() {
    return this.type.typeIdToChildIndex
  }
  append(value, childTypeId) {
    return this.set(this.length, value, childTypeId)
  }
  set(index, value, childTypeId) {
    if (childTypeId === undefined) {
      childTypeId = this._valueToChildTypeId(this, value, index)
    }
    if (this.setValid(index, this.isValid(value))) {
      this.setValue(index, value, childTypeId)
    }
    return this
  }
  // @ts-ignore
  setValue(index, value, childTypeId) {
    this._typeIds.set(index, childTypeId)
    super.setValue(index, value)
  }
  // @ts-ignore
  addChild(child, name = `${this.children.length}`) {
    const childTypeId = this.children.push(child)
    const {
      type: { children, mode, typeIds },
    } = this
    const fields = [...children, new schema_1.Field(name, child.type)]
    this.type = new type_1.Union(mode, [...typeIds, childTypeId], fields)
    return childTypeId
  }
  /** @ignore */
  // @ts-ignore
  _valueToChildTypeId(builder, value, offset) {
    throw new Error(`Cannot map UnionBuilder value to child typeId. \
Pass the \`childTypeId\` as the second argument to unionBuilder.append(), \
or supply a \`valueToChildTypeId\` function as part of the UnionBuilder constructor options.`)
  }
}
exports.UnionBuilder = UnionBuilder
/** @ignore */
class SparseUnionBuilder extends UnionBuilder {}
exports.SparseUnionBuilder = SparseUnionBuilder
/** @ignore */
class DenseUnionBuilder extends UnionBuilder {
  constructor(options) {
    super(options)
    this._offsets = new buffer_1.DataBufferBuilder(new Int32Array(0))
  }
  /** @ignore */
  setValue(index, value, childTypeId) {
    const childIndex = this.type.typeIdToChildIndex[childTypeId]
    this._offsets.set(index, this.getChildAt(childIndex).length)
    return super.setValue(index, value, childTypeId)
  }
}
exports.DenseUnionBuilder = DenseUnionBuilder

//# sourceMappingURL=union.js.map
