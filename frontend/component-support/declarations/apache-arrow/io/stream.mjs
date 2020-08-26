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
import streamAdapters from "./adapters"
import { decodeUtf8 } from "../util/utf8"
import { ITERATOR_DONE, AsyncQueue } from "./interfaces"
import { toUint8Array, joinUint8Arrays } from "../util/buffer"
import {
  isPromise,
  isFetchResponse,
  isIterable,
  isAsyncIterable,
  isReadableDOMStream,
  isReadableNodeStream,
} from "../util/compat"
/** @ignore */
export class AsyncByteQueue extends AsyncQueue {
  write(value) {
    if ((value = toUint8Array(value)).byteLength > 0) {
      return super.write(value)
    }
  }
  toString(sync = false) {
    return sync
      ? decodeUtf8(this.toUint8Array(true))
      : this.toUint8Array(false).then(decodeUtf8)
  }
  toUint8Array(sync = false) {
    return sync
      ? joinUint8Arrays(this._values)[0]
      : (async () => {
          let buffers = [],
            byteLength = 0
          for await (const chunk of this) {
            buffers.push(chunk)
            byteLength += chunk.byteLength
          }
          return joinUint8Arrays(buffers, byteLength)[0]
        })()
  }
}
/** @ignore */
export class ByteStream {
  constructor(source) {
    if (source) {
      this.source = new ByteStreamSource(streamAdapters.fromIterable(source))
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
/** @ignore */
export class AsyncByteStream {
  constructor(source) {
    if (source instanceof AsyncByteStream) {
      this.source = source.source
    } else if (source instanceof AsyncByteQueue) {
      this.source = new AsyncByteStreamSource(
        streamAdapters.fromAsyncIterable(source)
      )
    } else if (isReadableNodeStream(source)) {
      this.source = new AsyncByteStreamSource(
        streamAdapters.fromNodeStream(source)
      )
    } else if (isReadableDOMStream(source)) {
      this.source = new AsyncByteStreamSource(
        streamAdapters.fromDOMStream(source)
      )
    } else if (isFetchResponse(source)) {
      this.source = new AsyncByteStreamSource(
        streamAdapters.fromDOMStream(source.body)
      )
    } else if (isIterable(source)) {
      this.source = new AsyncByteStreamSource(
        streamAdapters.fromIterable(source)
      )
    } else if (isPromise(source)) {
      this.source = new AsyncByteStreamSource(
        streamAdapters.fromAsyncIterable(source)
      )
    } else if (isAsyncIterable(source)) {
      this.source = new AsyncByteStreamSource(
        streamAdapters.fromAsyncIterable(source)
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
      (this.source.throw && this.source.throw(value)) || ITERATOR_DONE
    )
  }
  return(value) {
    return Object.create(
      (this.source.return && this.source.return(value)) || ITERATOR_DONE
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
      (this.source.throw && (await this.source.throw(value))) || ITERATOR_DONE
    this._closedPromiseResolve && this._closedPromiseResolve()
    this._closedPromiseResolve = undefined
    return Object.create(result)
  }
  async return(value) {
    const result =
      (this.source.return && (await this.source.return(value))) ||
      ITERATOR_DONE
    this._closedPromiseResolve && this._closedPromiseResolve()
    this._closedPromiseResolve = undefined
    return Object.create(result)
  }
}

//# sourceMappingURL=stream.mjs.map
