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
const row_1 = require("./row")
const vector_1 = require("../vector")
const base_1 = require("./base")
const type_1 = require("../type")
/** @ignore */
class MapVector extends base_1.BaseVector {
  asList() {
    const child = this.type.children[0]
    return vector_1.Vector.new(this.data.clone(new type_1.List(child)))
  }
  bind(index) {
    const child = this.getChildAt(0)
    const { [index]: begin, [index + 1]: end } = this.valueOffsets
    return new row_1.MapRow(child.slice(begin, end))
  }
}
exports.MapVector = MapVector

//# sourceMappingURL=map.js.map
