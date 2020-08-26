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
import { toUint8Array } from "../util/buffer"
import { BufferBuilder } from "./buffer"
import { VariableWidthBuilder } from "../builder"
/** @ignore */
export class BinaryBuilder extends VariableWidthBuilder {
  constructor(opts) {
    super(opts)
    this._values = new BufferBuilder(new Uint8Array(0))
  }
  get byteLength() {
    let size = this._pendingLength + this.length * 4
    this._offsets && (size += this._offsets.byteLength)
    this._values && (size += this._values.byteLength)
    this._nulls && (size += this._nulls.byteLength)
    return size
  }
  setValue(index, value) {
    return super.setValue(index, toUint8Array(value))
  }
  _flushPending(pending, pendingLength) {
    const offsets = this._offsets
    const data = this._values.reserve(pendingLength).buffer
    let index = 0,
      length = 0,
      offset = 0,
      value
    for ([index, value] of pending) {
      if (value === undefined) {
        offsets.set(index, 0)
      } else {
        length = value.length
        data.set(value, offset)
        offsets.set(index, length)
        offset += length
      }
    }
  }
}

//# sourceMappingURL=binary.mjs.map
