/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SessionInfo } from "lib/SessionInfo"
import { getMetricsManagerForTest } from "lib/MetricsManagerTestUtils"

beforeEach(() => {
  SessionInfo.current = new SessionInfo({
    sessionId: "sessionId",
    streamlitVersion: "sv",
    pythonVersion: "pv",
    installationId: "iid",
    authorEmail: "ae",
    maxCachedMessageAge: 2,
    commandLine: "command line",
    userMapboxToken: "mbx",
  })
})

afterEach(() => {
  SessionInfo["singleton"] = undefined
})

test("does not track while uninitialized", () => {
  const mm = getMetricsManagerForTest()

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm["track"].mock.calls.length).toBe(0)
  expect(mm["identify"].mock.calls.length).toBe(0)
})

test("does not track when initialized with gatherUsageStats=false", () => {
  const mm = getMetricsManagerForTest()
  mm.initialize({ gatherUsageStats: false })

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm["track"].mock.calls.length).toBe(0)
  expect(mm["identify"].mock.calls.length).toBe(0)
})

test("enqueues events before initialization", () => {
  const mm = getMetricsManagerForTest()

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm["track"].mock.calls.length).toBe(0)

  mm.initialize({ gatherUsageStats: true })

  expect(mm["track"].mock.calls.length).toBe(3)
  expect(mm["identify"].mock.calls.length).toBe(1)
})

test("tracks events immediately after initialized", () => {
  const mm = getMetricsManagerForTest()
  mm.initialize({ gatherUsageStats: true })

  expect(mm["track"].mock.calls.length).toBe(0)
  mm.enqueue("ev1", { data1: 11 })
  expect(mm["track"].mock.calls.length).toBe(1)
  mm.enqueue("ev2", { data2: 12 })
  expect(mm["track"].mock.calls.length).toBe(2)
  mm.enqueue("ev3", { data3: 13 })
  expect(mm["track"].mock.calls.length).toBe(3)
})

test("increments deltas", () => {
  const mm = getMetricsManagerForTest()

  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("bar")
  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("bar")

  const counter = mm.getDeltaCounter()

  expect(counter.foo).toBe(3)
  expect(counter.bar).toBe(2)
  expect(counter.boz).toBeUndefined()
})

test("clears deltas", () => {
  const mm = getMetricsManagerForTest()

  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("bar")
  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("bar")

  mm.clearDeltaCounter()
  const counter = mm.getDeltaCounter()

  expect(Object.keys(counter).length).toBe(0)
})

test("clears deltas automatically on read", () => {
  const mm = getMetricsManagerForTest()

  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("bar")
  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("bar")

  const counter1 = mm.getDeltaCounter()
  const counter2 = mm.getDeltaCounter()

  expect(Object.keys(counter1).length).toBe(2)
  expect(Object.keys(counter2).length).toBe(0)
})
