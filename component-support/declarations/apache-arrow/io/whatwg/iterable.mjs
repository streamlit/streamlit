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
import { toUint8Array } from "../../util/buffer";
import { isIterable, isAsyncIterable } from "../../util/compat";
/** @ignore */
export function toDOMStream(source, options) {
  if (isAsyncIterable(source)) {
    return asyncIterableAsReadableDOMStream(source, options);
  }
  if (isIterable(source)) {
    return iterableAsReadableDOMStream(source, options);
  }
  /* istanbul ignore next */
  throw new Error(
    `toDOMStream() must be called with an Iterable or AsyncIterable`
  );
}
/** @ignore */
function iterableAsReadableDOMStream(source, options) {
  let it = null;
  const bm = (options && options.type === "bytes") || false;
  const hwm = (options && options.highWaterMark) || 2 ** 24;
  return new ReadableStream(
    {
      ...options,
      start(controller) {
        next(controller, it || (it = source[Symbol.iterator]()));
      },
      pull(controller) {
        it ? next(controller, it) : controller.close();
      },
      cancel() {
        ((it && (it.return && it.return())) || true) && (it = null);
      }
    },
    { highWaterMark: bm ? hwm : undefined, ...options }
  );
  function next(controller, it) {
    let buf;
    let r = null;
    let size = controller.desiredSize || null;
    while (!(r = it.next(bm ? size : null)).done) {
      if (ArrayBuffer.isView(r.value) && (buf = toUint8Array(r.value))) {
        size != null && bm && (size = size - buf.byteLength + 1);
        r.value = buf;
      }
      controller.enqueue(r.value);
      if (size != null && --size <= 0) {
        return;
      }
    }
    controller.close();
  }
}
/** @ignore */
function asyncIterableAsReadableDOMStream(source, options) {
  let it = null;
  const bm = (options && options.type === "bytes") || false;
  const hwm = (options && options.highWaterMark) || 2 ** 24;
  return new ReadableStream(
    {
      ...options,
      async start(controller) {
        await next(controller, it || (it = source[Symbol.asyncIterator]()));
      },
      async pull(controller) {
        it ? await next(controller, it) : controller.close();
      },
      async cancel() {
        ((it && (it.return && (await it.return()))) || true) && (it = null);
      }
    },
    { highWaterMark: bm ? hwm : undefined, ...options }
  );
  async function next(controller, it) {
    let buf;
    let r = null;
    let size = controller.desiredSize || null;
    while (!(r = await it.next(bm ? size : null)).done) {
      if (ArrayBuffer.isView(r.value) && (buf = toUint8Array(r.value))) {
        size != null && bm && (size = size - buf.byteLength + 1);
        r.value = buf;
      }
      controller.enqueue(r.value);
      if (size != null && --size <= 0) {
        return;
      }
    }
    controller.close();
  }
}

//# sourceMappingURL=iterable.mjs.map
