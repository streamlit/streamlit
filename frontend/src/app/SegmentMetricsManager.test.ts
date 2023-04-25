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

// Disable Typescript checking, since mm.track has private scope
// @ts-nocheck

import { Alert, Delta, ForwardMsgMetadata, Element } from "src/lib/proto"
import { mockSessionInfo, mockSessionInfoProps } from "src/lib/mocks/mocks"
import { SegmentMetricsManager } from "./SegmentMetricsManager"
import { SessionInfo } from "src/lib/SessionInfo"

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

test("increments deltas", () => {
  const mm = getSegmentMetricsManager()

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
  const mm = getSegmentMetricsManager()

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
  const mm = getSegmentMetricsManager()

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

describe("handleDeltaMessage", () => {
  const mainContainerMetadata = new ForwardMsgMetadata({ deltaPath: [0, 1] })
  const sidebarMetadata = new ForwardMsgMetadata({ deltaPath: [1, 1] })

  it("increments root container deltaCounter", () => {
    const mm = getSegmentMetricsManager()
    mm.handleDeltaMessage(new Delta(), mainContainerMetadata)
    expect(mm.getAndResetDeltaCounter()).toEqual({ main: 1 })
    expect(mm.getAndResetCustomComponentCounter()).toEqual({})

    mm.handleDeltaMessage(new Delta(), sidebarMetadata)
    expect(mm.getAndResetDeltaCounter()).toEqual({ sidebar: 1 })
    expect(mm.getAndResetCustomComponentCounter()).toEqual({})
  })

  it("handles newElement Delta messages", () => {
    const mm = getSegmentMetricsManager()

    const delta = Delta.create({
      newElement: Element.create({
        alert: {
          body: "mockBody",
          format: Alert.Format.INFO,
          icon: "mockIcon",
        },
      }),
    })

    mm.handleDeltaMessage(delta, mainContainerMetadata)
    expect(mm.getAndResetDeltaCounter()).toEqual({ main: 1, alert: 1 })
    expect(mm.getAndResetCustomComponentCounter()).toEqual({})
  })

  it("handles componentInstance Delta messages", () => {
    const mm = getSegmentMetricsManager()

    const delta = Delta.create({
      newElement: Element.create({
        componentInstance: {
          id: "mockId",
          componentName: "mockComponentName",
        },
      }),
    })

    mm.handleDeltaMessage(delta, mainContainerMetadata)
    expect(mm.getAndResetDeltaCounter()).toEqual({
      main: 1,
      componentInstance: 1,
    })
    expect(mm.getAndResetCustomComponentCounter()).toEqual({
      mockComponentName: 1,
    })
  })

  it("handles addBlock messages", () => {
    const mm = getSegmentMetricsManager()

    const delta = Delta.create({ addBlock: {} })

    mm.handleDeltaMessage(delta, mainContainerMetadata)
    expect(mm.getAndResetDeltaCounter()).toEqual({ main: 1, "new block": 1 })
    expect(mm.getAndResetCustomComponentCounter()).toEqual({})
  })

  it("handles addRows messages", () => {
    const mm = getSegmentMetricsManager()

    const delta = Delta.create({ addRows: {} })

    mm.handleDeltaMessage(delta, mainContainerMetadata)
    expect(mm.getAndResetDeltaCounter()).toEqual({ main: 1, "add rows": 1 })
    expect(mm.getAndResetCustomComponentCounter()).toEqual({})
  })

  it("handles arrowAddRows messages", () => {
    const mm = getSegmentMetricsManager()

    const delta = Delta.create({ arrowAddRows: {} })

    mm.handleDeltaMessage(delta, mainContainerMetadata)
    expect(mm.getAndResetDeltaCounter()).toEqual({
      main: 1,
      "arrow add rows": 1,
    })
    expect(mm.getAndResetCustomComponentCounter()).toEqual({})
  })
})
