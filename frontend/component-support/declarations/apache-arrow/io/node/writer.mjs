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
import { Duplex } from "stream"
import { AsyncByteStream } from "../../io/stream"
/** @ignore */
export function recordBatchWriterThroughNodeStream(options) {
  return new RecordBatchWriterDuplex(new this(options))
}
/** @ignore */
class RecordBatchWriterDuplex extends Duplex {
  constructor(writer, options) {
    super({
      allowHalfOpen: false,
      ...options,
      writableObjectMode: true,
      readableObjectMode: false,
    })
    this._pulling = false
    this._writer = writer
    this._reader = new AsyncByteStream(writer)
  }
  _final(cb) {
    const writer = this._writer
    writer && writer.close()
    cb && cb()
  }
  _write(x, _, cb) {
    const writer = this._writer
    writer && writer.write(x)
    cb && cb()
    return true
  }
  _read(size) {
    const it = this._reader
    if (it && !this._pulling && (this._pulling = true)) {
      ;(async () => (this._pulling = await this._pull(size, it)))()
    }
  }
  _destroy(err, cb) {
    const writer = this._writer
    if (writer) {
      err ? writer.abort(err) : writer.close()
    }
    cb((this._reader = this._writer = null))
  }
  async _pull(size, reader) {
    let r = null
    while (this.readable && !(r = await reader.next(size || null)).done) {
      if (size != null && r.value) {
        size -= r.value.byteLength
      }
      if (!this.push(r.value) || size <= 0) {
        break
      }
    }
    if ((r && r.done) || !this.readable) {
      this.push(null)
      await reader.cancel()
    }
    return !this.readable
  }
}

//# sourceMappingURL=writer.mjs.map
