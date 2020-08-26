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
const adapters_1 = require("./adapters")
const utf8_1 = require("../util/utf8")
const interfaces_1 = require("./interfaces")
const buffer_1 = require("../util/buffer")
const compat_1 = require("../util/compat")
/** @ignore */
class AsyncByteQueue extends interfaces_1.AsyncQueue {
  write(value) {
    if ((value = buffer_1.toUint8Array(value)).byteLength > 0) {
      return super.write(value)
    }
  }
  toString(sync = false) {
    return sync
      ? utf8_1.decodeUtf8(this.toUint8Array(true))
      : this.toUint8Array(false).then(utf8_1.decodeUtf8)
  }
  toUint8Array(sync = false) {
    return sync
      ? buffer_1.joinUint8Arrays(this._values)[0]
      : (async () => {
          let buffers = [],
            byteLength = 0
          for await (const chunk of this) {
            buffers.push(chunk)
            byteLength += chunk.byteLength
          }
          return buffer_1.joinUint8Arrays(buffers, byteLength)[0]
        })()
  }
}
exports.AsyncByteQueue = AsyncByteQueue
/** @ignore */
class ByteStream {
  constructor(source) {
    if (source) {
      this.source = new ByteStreamSource(
        adapters_1.default.fromIterable(source)
      )
    }
  }
  [Symbol.iterator]() {
    return this
  }
  next(value) {
    return this.source.next(value)
  }
  throw(value) {
    return this.source.throw(value)
  }
  return(value) {
    return this.source.return(value)
  }
  peek(size) {
    return this.source.peek(size)
  }
  read(size) {
    return this.source.read(size)
  }
}
exports.ByteStream = ByteStream
/** @ignore */
class AsyncByteStream {
  constructor(source) {
    if (source instanceof AsyncByteStream) {
      this.source = source.source
    } else if (source instanceof AsyncByteQueue) {
      this.source = new AsyncByteStreamSource(
        adapters_1.default.fromAsyncIterable(source)
      )
    } else if (compat_1.isReadableNodeStream(source)) {
      this.source = new AsyncByteStreamSource(
        adapters_1.default.fromNodeStream(source)
      )
    } else if (compat_1.isReadableDOMStream(source)) {
      this.source = new AsyncByteStreamSource(
        adapters_1.default.fromDOMStream(source)
      )
    } else if (compat_1.isFetchResponse(source)) {
      this.source = new AsyncByteStreamSource(
        adapters_1.default.fromDOMStream(source.body)
      )
    } else if (compat_1.isIterable(source)) {
      this.source = new AsyncByteStreamSource(
        adapters_1.default.fromIterable(source)
      )
    } else if (compat_1.isPromise(source)) {
      this.source = new AsyncByteStreamSource(
        adapters_1.default.fromAsyncIterable(source)
      )
    } else if (compat_1.isAsyncIterable(source)) {
      this.source = new AsyncByteStreamSource(
        adapters_1.default.fromAsyncIterable(source)
      )
    }
  }
  [Symbol.asyncIterator]() {
    return this
  }
  next(value) {
    return this.source.next(value)
  }
  throw(value) {
    return this.source.throw(value)
  }
  return(value) {
    return this.source.return(value)
  }
  get closed() {
    return this.source.closed
  }
  cancel(reason) {
    return this.source.cancel(reason)
  }
  peek(size) {
    return this.source.peek(size)
  }
  read(size) {
    return this.source.read(size)
  }
}
exports.AsyncByteStream = AsyncByteStream
/** @ignore */
class ByteStreamSource {
  constructor(source) {
    this.source = source
  }
  cancel(reason) {
    this.return(reason)
  }
  peek(size) {
    return this.next(size, "peek").value
  }
  read(size) {
    return this.next(size, "read").value
  }
  next(size, cmd = "read") {
    return this.source.next({ cmd, size })
  }
  throw(value) {
    return Object.create(
      (this.source.throw && this.source.throw(value)) ||
        interfaces_1.ITERATOR_DONE
    )
  }
  return(value) {
    return Object.create(
      (this.source.return && this.source.return(value)) ||
        interfaces_1.ITERATOR_DONE
    )
  }
}
/** @ignore */
class AsyncByteStreamSource {
  constructor(source) {
    this.source = source
    this._closedPromise = new Promise(r => (this._closedPromiseResolve = r))
  }
  async cancel(reason) {
    await this.return(reason)
  }
  get closed() {
    return this._closedPromise
  }
  async read(size) {
    return (await this.next(size, "read")).value
  }
  async peek(size) {
    return (await this.next(size, "peek")).value
  }
  async next(size, cmd = "read") {
    return await this.source.next({ cmd, size })
  }
  async throw(value) {
    const result =
      (this.source.throw && (await this.source.throw(value))) ||
      interfaces_1.ITERATOR_DONE
    this._closedPromiseResolve && this._closedPromiseResolve()
    this._closedPromiseResolve = undefined
    return Object.create(result)
  }
  async return(value) {
    const result =
      (this.source.return && (await this.source.return(value))) ||
      interfaces_1.ITERATOR_DONE
    this._closedPromiseResolve && this._closedPromiseResolve()
    this._closedPromiseResolve = undefined
    return Object.create(result)
  }
}

//# sourceMappingURL=stream.js.map
