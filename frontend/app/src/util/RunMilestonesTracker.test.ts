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

import { describe, expect, it } from "vitest"

import { RunMilestonesTracker } from "./RunMilestonesTracker"

const createTracker = (): {
  tracker: RunMilestonesTracker
  setTime: (time: number) => void
} => {
  let time = 0
  return {
    tracker: new RunMilestonesTracker(() => time),
    setTime: (newTime: number) => {
      time = newTime
    },
  }
}

describe("RunMilestonesTracker", () => {
  it("measures the first run from navigation start", () => {
    const { tracker, setTime } = createTracker()
    setTime(200.4)
    tracker.appMounted()
    setTime(450)
    tracker.rerunRequested()
    setTime(700.6)
    tracker.runStarted()
    setTime(1200)

    expect(tracker.scriptFinished()).toEqual({
      appShellReadyMs: 200,
      connectedMs: 701,
      scriptFinishedMs: 1200,
    })
  })

  it("measures a rerun from its first rerun request", () => {
    const { tracker, setTime } = createTracker()
    tracker.appMounted()
    tracker.runStarted()
    tracker.scriptFinished()

    setTime(5000)
    tracker.rerunRequested()
    setTime(5100)
    tracker.rerunRequested()
    setTime(5300)
    tracker.runStarted()
    setTime(5800)

    expect(tracker.scriptFinished()).toEqual({ scriptFinishedMs: 800 })
  })

  it("measures a run the browser didn't request from its NewSession", () => {
    const { tracker, setTime } = createTracker()
    tracker.runStarted()
    tracker.scriptFinished()

    setTime(5000)
    tracker.runStarted()
    setTime(5250)

    expect(tracker.scriptFinished()).toEqual({ scriptFinishedMs: 250 })
  })

  it("drops a run that never got its PageProfile when the next run starts", () => {
    const { tracker, setTime } = createTracker()
    tracker.runStarted()

    setTime(9000)
    tracker.rerunRequested()
    setTime(9400)
    tracker.runStarted()
    setTime(9900)

    expect(tracker.scriptFinished()).toEqual({ scriptFinishedMs: 900 })
  })

  it("keeps a request made during a run for the next run", () => {
    const { tracker, setTime } = createTracker()
    tracker.runStarted()

    setTime(3000)
    tracker.rerunRequested()
    setTime(3100)
    expect(tracker.scriptFinished()).toEqual({
      connectedMs: 0,
      scriptFinishedMs: 3100,
    })

    setTime(3200)
    tracker.runStarted()
    setTime(3500)
    expect(tracker.scriptFinished()).toEqual({ scriptFinishedMs: 500 })

    // The request belongs to that run only.
    setTime(4000)
    tracker.runStarted()
    setTime(4100)
    expect(tracker.scriptFinished()).toEqual({ scriptFinishedMs: 100 })
  })

  it("reports each run once", () => {
    const { tracker } = createTracker()
    expect(tracker.scriptFinished()).toBeUndefined()

    tracker.runStarted()
    expect(tracker.scriptFinished()).toBeDefined()
    expect(tracker.scriptFinished()).toBeUndefined()
  })

  it("records app shell ready only once", () => {
    const { tracker, setTime } = createTracker()
    setTime(100)
    tracker.appMounted()
    setTime(900)
    tracker.appMounted()
    tracker.runStarted()

    expect(tracker.scriptFinished()?.appShellReadyMs).toBe(100)
  })
})
