/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

// Disable Typescript checking, since mm.track and identify have private scope
// @ts-nocheck
import {
  getMetricsManagerForTest,
  getMetricsManagerAnalyticsForTest,
} from "src/lib/MetricsManagerTestUtils"
import { mockSessionInfo, mockSessionInfoProps } from "./mocks/mocks"

afterEach(() => {
  window.analytics = undefined
})

test("does not track while uninitialized", () => {
  const mm = getMetricsManagerForTest()

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)
  expect(mm.identify.mock.calls.length).toBe(0)
})

test("does not track when initialized with gatherUsageStats=false", () => {
  const mm = getMetricsManagerForTest()
  mm.initialize({ gatherUsageStats: false })

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)
  expect(mm.identify.mock.calls.length).toBe(0)
})

test("does not initialize Segment analytics when gatherUsageStats=false", () => {
  const mm = getMetricsManagerForTest()
  expect(window.analytics).toBeUndefined()
  mm.initialize({ gatherUsageStats: false })
  expect(window.analytics).toBeUndefined()
})

test("initializes Segment analytics when gatherUsageStats=true", () => {
  const mm = getMetricsManagerForTest()
  expect(window.analytics).toBeUndefined()
  mm.initialize({ gatherUsageStats: true })
  expect(window.analytics).toBeDefined()
  expect(window.analytics.invoked).toBe(true)
  expect(window.analytics.methods).toHaveLength(20)
  expect(window.analytics.load).toBeDefined()
})

test("enqueues events before initialization", () => {
  const sessionInfo = mockSessionInfo()
  const mm = getMetricsManagerForTest(sessionInfo)

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)

  mm.initialize({ gatherUsageStats: true })

  expect(mm.track.mock.calls.length).toBe(3)
  expect(mm.identify.mock.calls.length).toBe(1)
  expect(mm.identify.mock.calls[0][0]).toBe(sessionInfo.current.installationId)
  expect(mm.identify.mock.calls[0][1]).toMatchObject({
    authoremail: sessionInfo.current.authorEmail,
  })
})

test("enqueues events when disconnected, then sends them when connected again", () => {
  const sessionInfo = mockSessionInfo()
  const mm = getMetricsManagerForTest(sessionInfo)
  mm.initialize({ gatherUsageStats: true })

  // "Disconnect" our SessionInfo. Enqueued events should not be tracked.
  sessionInfo.setCurrent(undefined)
  expect(sessionInfo.isSet).toBe(false)

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)

  // Initialize the SessionInfo. The next call to enqueue should cause
  // all of our enqueued messages to get tracked.
  sessionInfo.setCurrent(mockSessionInfoProps())
  mm.enqueue("ev4", { data4: 14 })
  expect(mm.track.mock.calls.length).toBe(4)
})

test("tracks events immediately after initialized", () => {
  const mm = getMetricsManagerForTest()
  mm.initialize({ gatherUsageStats: true })

  expect(mm.track.mock.calls.length).toBe(0)
  mm.enqueue("ev1", { data1: 11 })
  expect(mm.track.mock.calls.length).toBe(1)
  mm.enqueue("ev2", { data2: 12 })
  expect(mm.track.mock.calls.length).toBe(2)
  mm.enqueue("ev3", { data3: 13 })
  expect(mm.track.mock.calls.length).toBe(3)
})

test("tracks host data when in an iFrame", () => {
  const mm = getMetricsManagerForTest()
  mm.setMetadata({
    hostedAt: "S4A",
    k: "v",
  })
  mm.initialize({ gatherUsageStats: true })
  mm.enqueue("ev1", { data1: 11 })

  expect(mm.identify.mock.calls[0][1]).toMatchObject({
    hostedAt: "S4A",
  })
  expect(mm.track.mock.calls[0][1]).toMatchObject({
    hostedAt: "S4A",
    data1: 11,
  })
  expect(mm.track.mock.calls[0][1]).not.toMatchObject({
    k: "v",
  })
})

test("tracks installation data", () => {
  const sessionInfo = mockSessionInfo()
  const mm = getMetricsManagerForTest(sessionInfo)
  mm.initialize({ gatherUsageStats: true })
  mm.enqueue("ev1", { data1: 11 })

  expect(mm.identify.mock.calls[0][1]).toMatchObject({
    machineIdV3: sessionInfo.current.installationIdV3,
  })
  expect(mm.track.mock.calls[0][1]).toMatchObject({
    machineIdV3: sessionInfo.current.installationIdV3,
  })
})

test("increments deltas", () => {
  const mm = getMetricsManagerForTest()

  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("bar")
  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("bar")

  const counter = mm.getAndResetDeltaCounter()

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
  const counter = mm.getAndResetDeltaCounter()

  expect(Object.keys(counter).length).toBe(0)
})

test("clears deltas automatically on read", () => {
  const mm = getMetricsManagerForTest()

  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("bar")
  mm.incrementDeltaCounter("foo")
  mm.incrementDeltaCounter("bar")

  const counter1 = mm.getAndResetDeltaCounter()
  const counter2 = mm.getAndResetDeltaCounter()

  expect(Object.keys(counter1).length).toBe(2)
  expect(Object.keys(counter2).length).toBe(0)
})

test("ip address is not tracked", () => {
  const mm = getMetricsManagerAnalyticsForTest()
  mm.initialize({ gatherUsageStats: true })

  expect(mm.identify.mock.calls[0][2]).toMatchObject({
    ip: "0.0.0.0",
  })

  expect(mm.track.mock.calls[0][2]).toMatchObject({
    ip: "0.0.0.0",
  })
})

test("page title is not tracked", () => {
  const mm = getMetricsManagerAnalyticsForTest()
  mm.initialize({ gatherUsageStats: true })

  expect(mm.identify.mock.calls[0][2]).toMatchObject({
    pageTitle: "",
  })

  expect(mm.track.mock.calls[0][2]).toMatchObject({
    pageTitle: "",
  })
})

test("data automatically includes device data", () => {
  const mm = getMetricsManagerAnalyticsForTest()
  mm.initialize({ gatherUsageStats: true })

  expect(mm.identify.mock.calls[0][2]).toHaveProperty(["device", "browser"])
  expect(mm.identify.mock.calls[0][2]).toHaveProperty([
    "device",
    "browserVersion",
  ])
  expect(mm.identify.mock.calls[0][2]).toHaveProperty(["device", "OS"])
  expect(mm.identify.mock.calls[0][2]).toHaveProperty(["device", "OSVersion"])
  expect(mm.identify.mock.calls[0][2]).toHaveProperty(["device", "deviceType"])
  expect(mm.identify.mock.calls[0][2]).toHaveProperty(["device", "engine"])
  expect(mm.identify.mock.calls[0][2]).toHaveProperty([
    "device",
    "engineVersion",
  ])

  expect(mm.track.mock.calls[0][2]).toHaveProperty(["device", "browser"])
  expect(mm.track.mock.calls[0][2]).toHaveProperty([
    "device",
    "browserVersion",
  ])
  expect(mm.track.mock.calls[0][2]).toHaveProperty(["device", "OS"])
  expect(mm.track.mock.calls[0][2]).toHaveProperty(["device", "OSVersion"])
  expect(mm.track.mock.calls[0][2]).toHaveProperty(["device", "deviceType"])
  expect(mm.track.mock.calls[0][2]).toHaveProperty(["device", "engine"])
  expect(mm.track.mock.calls[0][2]).toHaveProperty(["device", "engineVersion"])
})
