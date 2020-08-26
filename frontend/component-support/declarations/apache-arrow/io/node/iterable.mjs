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
import { Readable } from "stream"
import { isIterable, isAsyncIterable } from "../../util/compat"
/** @ignore */
export function toNodeStream(source, options) {
  if (isAsyncIterable(source)) {
    return new AsyncIterableReadable(source[Symbol.asyncIterator](), options)
  }
  if (isIterable(source)) {
    return new IterableReadable(source[Symbol.iterator](), options)
  }
  /* istanbul ignore next */
  throw new Error(
    `toNodeStream() must be called with an Iterable or AsyncIterable`
  )
}
/** @ignore */
class IterableReadable extends Readable {
  constructor(it, options) {
    super(options)
    this._iterator = it
    this._pulling = false
    this._bytesMode = !options || !options.objectMode
  }
  _read(size) {
    const it = this._iterator
    if (it && !this._pulling && (this._pulling = true)) {
      this._pulling = this._pull(size, it)
    }
  }
  _destroy(e, cb) {
    let it = this._iterator,
      fn
    it && (fn = (e != null && it.throw) || it.return)
    fn && fn.call(it, e)
    cb && cb(null)
  }
  _pull(size, it) {
    const bm = this._bytesMode
    let r = null
    while (this.readable && !(r = it.next(bm ? size : null)).done) {
      if (size != null) {
        size -= bm && ArrayBuffer.isView(r.value) ? r.value.byteLength : 1
      }
      if (!this.push(r.value) || size <= 0) {
        break
      }
    }
    if (((r && r.done) || !this.readable) && (this.push(null) || true)) {
      it.return && it.return()
    }
    return !this.readable
  }
}
/** @ignore */
class AsyncIterableReadable extends Readable {
  constructor(it, options) {
    super(options)
    this._iterator = it
    this._pulling = false
    this._bytesMode = !options || !options.objectMode
  }
  _read(size) {
    const it = this._iterator
    if (it && !this._pulling && (this._pulling = true)) {
      ;(async () => (this._pulling = await this._pull(size, it)))()
    }
  }
  _destroy(e, cb) {
    let it = this._iterator,
      fn
    it && (fn = (e != null && it.throw) || it.return)
    ;(fn && fn.call(it, e).then(() => cb && cb(null))) || (cb && cb(null))
  }
  async _pull(size, it) {
    const bm = this._bytesMode
    let r = null
    while (this.readable && !(r = await it.next(bm ? size : null)).done) {
      if (size != null) {
        size -= bm && ArrayBuffer.isView(r.value) ? r.value.byteLength : 1
      }
      if (!this.push(r.value) || size <= 0) {
        break
      }
    }
    if (((r && r.done) || !this.readable) && (this.push(null) || true)) {
      it.return && it.return()
    }
    return !this.readable
  }
}

//# sourceMappingURL=iterable.mjs.map
