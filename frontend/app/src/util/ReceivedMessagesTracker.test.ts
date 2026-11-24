/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ForwardMsg } from "@streamlit/protobuf"

import { ReceivedMessagesTracker } from "./ReceivedMessagesTracker"

const newSessionMsg = (): ForwardMsg =>
  ForwardMsg.fromObject({ newSession: {} })
const deltaMsg = (): ForwardMsg =>
  ForwardMsg.fromObject({ delta: { newElement: {} } })
const pageProfileMsg = (): ForwardMsg =>
  ForwardMsg.fromObject({ pageProfile: {} })

describe("ReceivedMessagesTracker", () => {
  it("starts with empty totals", () => {
    expect(new ReceivedMessagesTracker().getRunTotals()).toEqual({
      bytes: 0,
      messages: 0,
      cachedMessages: 0,
      cachedBytes: 0,
    })
  })

  it("adds up the bytes and messages of a run", () => {
    const tracker = new ReceivedMessagesTracker()
    tracker.recordMessage(newSessionMsg(), { byteLength: 1_000 })
    tracker.recordMessage(deltaMsg(), { byteLength: 250 })
    tracker.recordMessage(pageProfileMsg(), { byteLength: 80 })

    expect(tracker.getRunTotals()).toEqual({
      bytes: 1_330,
      messages: 3,
      cachedMessages: 0,
      cachedBytes: 0,
    })
  })

  it("counts references to cached messages at both sizes", () => {
    const tracker = new ReceivedMessagesTracker()
    tracker.recordMessage(newSessionMsg(), { byteLength: 1_000 })
    tracker.recordMessage(deltaMsg(), {
      byteLength: 60,
      cachedByteLength: 50_000,
    })
    tracker.recordMessage(deltaMsg(), { byteLength: 300 })

    const totals = tracker.getRunTotals()
    expect(totals.bytes).toBe(1_360)
    expect(totals.messages).toBe(3)
    expect(totals.cachedMessages).toBe(1)
    expect(totals.cachedBytes).toBe(50_000)
  })

  it("counts a cached message whose size is 0 as cached", () => {
    const tracker = new ReceivedMessagesTracker()
    tracker.recordMessage(deltaMsg(), { byteLength: 60, cachedByteLength: 0 })

    expect(tracker.getRunTotals().cachedMessages).toBe(1)
  })

  it("restarts the totals at each NewSession message", () => {
    const tracker = new ReceivedMessagesTracker()
    tracker.recordMessage(newSessionMsg(), { byteLength: 1_000 })
    tracker.recordMessage(deltaMsg(), {
      byteLength: 60,
      cachedByteLength: 5_000,
    })
    tracker.recordMessage(pageProfileMsg(), { byteLength: 80 })
    // Messages after a run's PageProfile don't carry into the next run.
    tracker.recordMessage(deltaMsg(), { byteLength: 9_999 })

    tracker.recordMessage(newSessionMsg(), { byteLength: 900 })
    tracker.recordMessage(deltaMsg(), { byteLength: 100 })

    expect(tracker.getRunTotals()).toEqual({
      bytes: 1_000,
      messages: 2,
      cachedMessages: 0,
      cachedBytes: 0,
    })
  })

  it("counts messages without a size as 0 bytes", () => {
    const tracker = new ReceivedMessagesTracker()
    tracker.recordMessage(newSessionMsg())
    tracker.recordMessage(deltaMsg(), { byteLength: 10 })

    const totals = tracker.getRunTotals()
    expect(totals.messages).toBe(2)
    expect(totals.bytes).toBe(10)
  })

  it("returns a copy of the totals", () => {
    const tracker = new ReceivedMessagesTracker()
    tracker.recordMessage(newSessionMsg(), { byteLength: 10 })
    const totals = tracker.getRunTotals()

    tracker.recordMessage(deltaMsg(), { byteLength: 20 })

    expect(totals.bytes).toBe(10)
    expect(tracker.getRunTotals().bytes).toBe(30)
  })
})
