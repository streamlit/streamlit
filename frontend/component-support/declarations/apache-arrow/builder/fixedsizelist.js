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
const run_1 = require("./run")
const schema_1 = require("../schema")
const builder_1 = require("../builder")
const type_1 = require("../type")
/** @ignore */
class FixedSizeListBuilder extends builder_1.Builder {
  constructor() {
    super(...arguments)
    this._run = new run_1.Run()
  }
  setValue(index, value) {
    super.setValue(index, this._run.bind(value))
  }
  addChild(child, name = "0") {
    if (this.numChildren > 0) {
      throw new Error("FixedSizeListBuilder can only have one child.")
    }
    const childIndex = this.children.push(child)
    this.type = new type_1.FixedSizeList(
      this.type.listSize,
      new schema_1.Field(name, child.type, true)
    )
    return childIndex
  }
  clear() {
    this._run.clear()
    return super.clear()
  }
}
exports.FixedSizeListBuilder = FixedSizeListBuilder

//# sourceMappingURL=fixedsizelist.js.map
