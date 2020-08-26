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
const stream_1 = require("../../io/stream")
const reader_1 = require("../../ipc/reader")
/** @ignore */
function recordBatchReaderThroughDOMStream(
  writableStrategy,
  readableStrategy
) {
  const queue = new stream_1.AsyncByteQueue()
  let reader = null
  const readable = new ReadableStream({
    async cancel() {
      await queue.close()
    },
    async start(controller) {
      await next(controller, reader || (reader = await open()))
    },
    async pull(controller) {
      reader ? await next(controller, reader) : controller.close()
    },
  })
  return {
    writable: new WritableStream(queue, {
      highWaterMark: 2 ** 14,
      ...writableStrategy,
    }),
    readable,
  }
  async function open() {
    return await (await reader_1.RecordBatchReader.from(queue)).open(
      readableStrategy
    )
  }
  async function next(controller, reader) {
    let size = controller.desiredSize
    let r = null
    while (!(r = await reader.next()).done) {
      controller.enqueue(r.value)
      if (size != null && --size <= 0) {
        return
      }
    }
    controller.close()
  }
}
exports.recordBatchReaderThroughDOMStream = recordBatchReaderThroughDOMStream

//# sourceMappingURL=reader.js.map
