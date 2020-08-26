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
const schema_1 = require("../schema");
const type_1 = require("../type");
const builder_1 = require("../builder");
/** @ignore */
class MapBuilder extends builder_1.VariableWidthBuilder {
  set(index, value) {
    return super.set(index, value);
  }
  setValue(index, value) {
    value = value instanceof Map ? value : new Map(Object.entries(value));
    const pending = this._pending || (this._pending = new Map());
    const current = pending.get(index);
    current && (this._pendingLength -= current.size);
    this._pendingLength += value.size;
    pending.set(index, value);
  }
  addChild(child, name = `${this.numChildren}`) {
    if (this.numChildren > 0) {
      throw new Error("ListBuilder can only have one child.");
    }
    this.children[this.numChildren] = child;
    this.type = new type_1.Map_(
      new schema_1.Field(name, child.type, true),
      this.type.keysSorted
    );
    return this.numChildren - 1;
  }
  _flushPending(pending) {
    const offsets = this._offsets;
    const setValue = this._setValue;
    pending.forEach((value, index) => {
      if (value === undefined) {
        offsets.set(index, 0);
      } else {
        offsets.set(index, value.size);
        setValue(this, index, value);
      }
    });
  }
}
exports.MapBuilder = MapBuilder;

//# sourceMappingURL=map.js.map
