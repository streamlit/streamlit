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
const buffer_1 = require("../util/buffer")
/** @ignore */
exports.default = {
  fromIterable(source) {
    return pump(fromIterable(source))
  },
  fromAsyncIterable(source) {
    return pump(fromAsyncIterable(source))
  },
  fromDOMStream(source) {
    return pump(fromDOMStream(source))
  },
  fromNodeStream(stream) {
    return pump(fromNodeStream(stream))
  },
  // @ts-ignore
  toDOMStream(source, options) {
    throw new Error(`"toDOMStream" not available in this environment`)
  },
  // @ts-ignore
  toNodeStream(source, options) {
    throw new Error(`"toNodeStream" not available in this environment`)
  },
}
/** @ignore */
const pump = iterator => {
  iterator.next()
  return iterator
}
/** @ignore */
function* fromIterable(source) {
  let done,
    threw = false
  let buffers = [],
    buffer
  let cmd,
    size,
    bufferLength = 0
  function byteRange() {
    if (cmd === "peek") {
      return buffer_1.joinUint8Arrays(buffers, size)[0]
    }
    ;[buffer, buffers, bufferLength] = buffer_1.joinUint8Arrays(buffers, size)
    return buffer
  }
  // Yield so the caller can inject the read command before creating the source Iterator
  ;({ cmd, size } = yield null)
  // initialize the iterator
  let it = buffer_1.toUint8ArrayIterator(source)[Symbol.iterator]()
  try {
    do {
      // read the next value
      ;({ done, value: buffer } = isNaN(size - bufferLength)
        ? it.next(undefined)
        : it.next(size - bufferLength))
      // if chunk is not null or empty, push it onto the queue
      if (!done && buffer.byteLength > 0) {
        buffers.push(buffer)
        bufferLength += buffer.byteLength
      }
      // If we have enough bytes in our buffer, yield chunks until we don't
      if (done || size <= bufferLength) {
        do {
          ;({ cmd, size } = yield byteRange())
        } while (size < bufferLength)
      }
    } while (!done)
  } catch (e) {
    ;(threw = true) && typeof it.throw === "function" && it.throw(e)
  } finally {
    threw === false && typeof it.return === "function" && it.return()
  }
}
/** @ignore */
async function* fromAsyncIterable(source) {
  let done,
    threw = false
  let buffers = [],
    buffer
  let cmd,
    size,
    bufferLength = 0
  function byteRange() {
    if (cmd === "peek") {
      return buffer_1.joinUint8Arrays(buffers, size)[0]
    }
    ;[buffer, buffers, bufferLength] = buffer_1.joinUint8Arrays(buffers, size)
    return buffer
  }
  // Yield so the caller can inject the read command before creating the source AsyncIterator
  ;({ cmd, size } = yield null)
  // initialize the iterator
  let it = buffer_1.toUint8ArrayAsyncIterator(source)[Symbol.asyncIterator]()
  try {
    do {
      // read the next value
      ;({ done, value: buffer } = isNaN(size - bufferLength)
        ? await it.next(undefined)
        : await it.next(size - bufferLength))
      // if chunk is not null or empty, push it onto the queue
      if (!done && buffer.byteLength > 0) {
        buffers.push(buffer)
        bufferLength += buffer.byteLength
      }
      // If we have enough bytes in our buffer, yield chunks until we don't
      if (done || size <= bufferLength) {
        do {
          ;({ cmd, size } = yield byteRange())
        } while (size < bufferLength)
      }
    } while (!done)
  } catch (e) {
    ;(threw = true) && typeof it.throw === "function" && (await it.throw(e))
  } finally {
    threw === false && typeof it.return === "function" && (await it.return())
  }
}
// All this manual Uint8Array chunk management can be avoided if/when engines
// add support for ArrayBuffer.transfer() or ArrayBuffer.prototype.realloc():
// https://github.com/domenic/proposal-arraybuffer-transfer
/** @ignore */
async function* fromDOMStream(source) {
  let done = false,
    threw = false
  let buffers = [],
    buffer
  let cmd,
    size,
    bufferLength = 0
  function byteRange() {
    if (cmd === "peek") {
      return buffer_1.joinUint8Arrays(buffers, size)[0]
    }
    ;[buffer, buffers, bufferLength] = buffer_1.joinUint8Arrays(buffers, size)
    return buffer
  }
  // Yield so the caller can inject the read command before we establish the ReadableStream lock
  ;({ cmd, size } = yield null)
  // initialize the reader and lock the stream
  let it = new AdaptiveByteReader(source)
  try {
    do {
      // read the next value
      ;({ done, value: buffer } = isNaN(size - bufferLength)
        ? await it["read"](undefined)
        : await it["read"](size - bufferLength))
      // if chunk is not null or empty, push it onto the queue
      if (!done && buffer.byteLength > 0) {
        buffers.push(buffer_1.toUint8Array(buffer))
        bufferLength += buffer.byteLength
      }
      // If we have enough bytes in our buffer, yield chunks until we don't
      if (done || size <= bufferLength) {
        do {
          ;({ cmd, size } = yield byteRange())
        } while (size < bufferLength)
      }
    } while (!done)
  } catch (e) {
    ;(threw = true) && (await it["cancel"](e))
  } finally {
    threw === false
      ? await it["cancel"]()
      : source["locked"] && it.releaseLock()
  }
}
/** @ignore */
class AdaptiveByteReader {
  constructor(source) {
    this.source = source
    this.byobReader = null
    this.defaultReader = null
    try {
      this.supportsBYOB = !!(this.reader = this.getBYOBReader())
    } catch (e) {
      this.supportsBYOB = !!!(this.reader = this.getDefaultReader())
    }
  }
  get closed() {
    return this.reader
      ? this.reader["closed"].catch(() => {})
      : Promise.resolve()
  }
  releaseLock() {
    if (this.reader) {
      this.reader.releaseLock()
    }
    this.reader = this.byobReader = this.defaultReader = null
  }
  async cancel(reason) {
    const { reader, source } = this
    reader && (await reader["cancel"](reason).catch(() => {}))
    source && (source["locked"] && this.releaseLock())
  }
  async read(size) {
    if (size === 0) {
      return { done: this.reader == null, value: new Uint8Array(0) }
    }
    const result =
      !this.supportsBYOB || typeof size !== "number"
        ? await this.getDefaultReader().read()
        : await this.readFromBYOBReader(size)
    !result.done && (result.value = buffer_1.toUint8Array(result))
    return result
  }
  getDefaultReader() {
    if (this.byobReader) {
      this.releaseLock()
    }
    if (!this.defaultReader) {
      this.defaultReader = this.source["getReader"]()
      // We have to catch and swallow errors here to avoid uncaught promise rejection exceptions
      // that seem to be raised when we call `releaseLock()` on this reader. I'm still mystified
      // about why these errors are raised, but I'm sure there's some important spec reason that
      // I haven't considered. I hate to employ such an anti-pattern here, but it seems like the
      // only solution in this case :/
      this.defaultReader["closed"].catch(() => {})
    }
    return (this.reader = this.defaultReader)
  }
  getBYOBReader() {
    if (this.defaultReader) {
      this.releaseLock()
    }
    if (!this.byobReader) {
      this.byobReader = this.source["getReader"]({ mode: "byob" })
      // We have to catch and swallow errors here to avoid uncaught promise rejection exceptions
      // that seem to be raised when we call `releaseLock()` on this reader. I'm still mystified
      // about why these errors are raised, but I'm sure there's some important spec reason that
      // I haven't considered. I hate to employ such an anti-pattern here, but it seems like the
      // only solution in this case :/
      this.byobReader["closed"].catch(() => {})
    }
    return (this.reader = this.byobReader)
  }
  // This strategy plucked from the example in the streams spec:
  // https://streams.spec.whatwg.org/#example-manual-read-bytes
  async readFromBYOBReader(size) {
    return await readInto(this.getBYOBReader(), new ArrayBuffer(size), 0, size)
  }
}
/** @ignore */
async function readInto(reader, buffer, offset, size) {
  if (offset >= size) {
    return { done: false, value: new Uint8Array(buffer, 0, size) }
  }
  const { done, value } = await reader.read(
    new Uint8Array(buffer, offset, size - offset)
  )
  if ((offset += value.byteLength) < size && !done) {
    return await readInto(reader, value.buffer, offset, size)
  }
  return { done, value: new Uint8Array(value.buffer, 0, offset) }
}
/** @ignore */
const onEvent = (stream, event) => {
  let handler = _ => resolve([event, _])
  let resolve
  return [
    event,
    handler,
    new Promise(r => (resolve = r) && stream["once"](event, handler)),
  ]
}
/** @ignore */
async function* fromNodeStream(stream) {
  let events = []
  let event = "error"
  let done = false,
    err = null
  let cmd,
    size,
    bufferLength = 0
  let buffers = [],
    buffer
  function byteRange() {
    if (cmd === "peek") {
      return buffer_1.joinUint8Arrays(buffers, size)[0]
    }
    ;[buffer, buffers, bufferLength] = buffer_1.joinUint8Arrays(buffers, size)
    return buffer
  }
  // Yield so the caller can inject the read command before we
  // add the listener for the source stream's 'readable' event.
  ;({ cmd, size } = yield null)
  // ignore stdin if it's a TTY
  if (stream["isTTY"]) {
    return yield new Uint8Array(0)
  }
  try {
    // initialize the stream event handlers
    events[0] = onEvent(stream, "end")
    events[1] = onEvent(stream, "error")
    do {
      events[2] = onEvent(stream, "readable")
      // wait on the first message event from the stream
      ;[event, err] = await Promise.race(events.map(x => x[2]))
      // if the stream emitted an Error, rethrow it
      if (event === "error") {
        break
      }
      if (!(done = event === "end")) {
        // If the size is NaN, request to read everything in the stream's internal buffer
        if (!isFinite(size - bufferLength)) {
          buffer = buffer_1.toUint8Array(stream["read"](undefined))
        } else {
          buffer = buffer_1.toUint8Array(stream["read"](size - bufferLength))
          // If the byteLength is 0, then the requested amount is more than the stream has
          // in its internal buffer. In this case the stream needs a "kick" to tell it to
          // continue emitting readable events, so request to read everything the stream
          // has in its internal buffer right now.
          if (buffer.byteLength < size - bufferLength) {
            buffer = buffer_1.toUint8Array(stream["read"](undefined))
          }
        }
        // if chunk is not null or empty, push it onto the queue
        if (buffer.byteLength > 0) {
          buffers.push(buffer)
          bufferLength += buffer.byteLength
        }
      }
      // If we have enough bytes in our buffer, yield chunks until we don't
      if (done || size <= bufferLength) {
        do {
          ;({ cmd, size } = yield byteRange())
        } while (size < bufferLength)
      }
    } while (!done)
  } finally {
    await cleanup(events, event === "error" ? err : null)
  }
  function cleanup(events, err) {
    buffer = buffers = null
    return new Promise(async (resolve, reject) => {
      for (const [evt, fn] of events) {
        stream["off"](evt, fn)
      }
      try {
        // Some stream implementations don't call the destroy callback,
        // because it's really a node-internal API. Just calling `destroy`
        // here should be enough to conform to the ReadableStream contract
        const destroy = stream["destroy"]
        destroy && destroy.call(stream, err)
        err = undefined
      } catch (e) {
        err = e || err
      } finally {
        err != null ? reject(err) : resolve()
      }
    })
  }
}

//# sourceMappingURL=adapters.js.map
