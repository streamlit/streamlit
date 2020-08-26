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
const stream_1 = require("stream");
const stream_2 = require("../../io/stream");
const reader_1 = require("../../ipc/reader");
/** @ignore */
function recordBatchReaderThroughNodeStream(options) {
  return new RecordBatchReaderDuplex(options);
}
exports.recordBatchReaderThroughNodeStream = recordBatchReaderThroughNodeStream;
/** @ignore */
class RecordBatchReaderDuplex extends stream_1.Duplex {
  constructor(options) {
    super({
      allowHalfOpen: false,
      ...options,
      readableObjectMode: true,
      writableObjectMode: false
    });
    this._pulling = false;
    this._autoDestroy = true;
    this._reader = null;
    this._pulling = false;
    this._asyncQueue = new stream_2.AsyncByteQueue();
    this._autoDestroy =
      options && typeof options.autoDestroy === "boolean"
        ? options.autoDestroy
        : true;
  }
  _final(cb) {
    const aq = this._asyncQueue;
    aq && aq.close();
    cb && cb();
  }
  _write(x, _, cb) {
    const aq = this._asyncQueue;
    aq && aq.write(x);
    cb && cb();
    return true;
  }
  _read(size) {
    const aq = this._asyncQueue;
    if (aq && !this._pulling && (this._pulling = true)) {
      (async () => {
        if (!this._reader) {
          this._reader = await this._open(aq);
        }
        this._pulling = await this._pull(size, this._reader);
      })();
    }
  }
  _destroy(err, cb) {
    const aq = this._asyncQueue;
    if (aq) {
      err ? aq.abort(err) : aq.close();
    }
    cb((this._asyncQueue = this._reader = null));
  }
  async _open(source) {
    return await (await reader_1.RecordBatchReader.from(source)).open({
      autoDestroy: this._autoDestroy
    });
  }
  async _pull(size, reader) {
    let r = null;
    while (this.readable && !(r = await reader.next()).done) {
      if (!this.push(r.value) || (size != null && --size <= 0)) {
        break;
      }
    }
    if (
      !this.readable ||
      (r &&
        r.done &&
        (reader.autoDestroy || (await reader.reset().open()).closed))
    ) {
      this.push(null);
      await reader.cancel();
    }
    return !this.readable;
  }
}

//# sourceMappingURL=reader.js.map
