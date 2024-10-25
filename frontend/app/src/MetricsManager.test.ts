/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

// Disable Typescript checking, since mm.track has private scope
// @ts-nocheck

import {
  mockSessionInfo,
  mockSessionInfoProps,
  SessionInfo,
} from "@streamlit/lib"

import { SegmentMetricsManager } from "./MetricsManager"

const getSegmentMetricsManager = (
  sessionInfo?: SessionInfo
): SegmentMetricsManager => {
  const mm = new SegmentMetricsManager(sessionInfo || mockSessionInfo())
  mm.track = jest.fn()
  mm.identify = jest.fn()
  return mm
}

afterEach(() => {
  window.analytics = undefined
})

test("does not track while uninitialized", () => {
  const mm = getSegmentMetricsManager()

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)
})

test("does not track when initialized with gatherUsageStats=false", () => {
  const mm = getSegmentMetricsManager()
  mm.initialize({ gatherUsageStats: false })

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)
})

test("does not initialize Segment analytics when gatherUsageStats=false", () => {
  const mm = getSegmentMetricsManager()
  expect(window.analytics).toBeUndefined()
  mm.initialize({ gatherUsageStats: false })
  expect(window.analytics).toBeUndefined()
})

test("initializes Segment analytics when gatherUsageStats=true", () => {
  const mm = getSegmentMetricsManager()
  expect(window.analytics).toBeUndefined()
  mm.initialize({ gatherUsageStats: true })
  expect(window.analytics).toBeDefined()
  expect(window.analytics.invoked).toBe(true)
  expect(window.analytics.methods).toHaveLength(20)
  expect(window.analytics.load).toBeDefined()
})

test("enqueues events before initialization", () => {
  const sessionInfo = mockSessionInfo()
  const mm = getSegmentMetricsManager(sessionInfo)

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)

  mm.initialize({ gatherUsageStats: true })

  expect(mm.track.mock.calls.length).toBe(3)
})

test("enqueues events when disconnected, then sends them when connected again", () => {
  const sessionInfo = mockSessionInfo()
  const mm = getSegmentMetricsManager(sessionInfo)
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
  const mm = getSegmentMetricsManager()
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
  const mm = getSegmentMetricsManager()
  mm.setMetadata({
    hostedAt: "S4A",
    k: "v",
  })
  mm.initialize({ gatherUsageStats: true })
  mm.enqueue("ev1", { data1: 11 })

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
  const mm = getSegmentMetricsManager(sessionInfo)
  mm.initialize({ gatherUsageStats: true })
  mm.enqueue("ev1", { data1: 11 })

  expect(mm.track.mock.calls[0][1]).toMatchObject({
    machineIdV3: sessionInfo.current.installationIdV3,
  })
})

test("ip address is overwritten", () => {
  const mm = getSegmentMetricsManager()
  mm.initialize({ gatherUsageStats: true })

  mm.enqueue("ev1", { data1: 11 })

  expect(mm.track.mock.calls[0][2]).toMatchObject({
    context: {
      ip: "0.0.0.0",
    },
  })
})
