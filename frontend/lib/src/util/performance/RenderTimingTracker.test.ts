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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  type ElementTimingHandle,
  RENDER_TIMING_TIMEOUT_MS,
  type RenderTimingReport,
  RenderTimingTracker,
} from "./RenderTimingTracker"

const RUN_ID = "run-1"

class FakeIntersectionObserver {
  readonly observed = new Set<Element>()

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    this.observed.add(target)
  }

  unobserve(target: Element): void {
    this.observed.delete(target)
  }

  disconnect(): void {
    this.observed.clear()
  }

  report(target: Element, isIntersecting: boolean): void {
    if (!this.observed.has(target)) return
    this.callback(
      [{ target, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    )
  }
}

/** A controllable clock, paint queue, observer and page visibility. */
class FakeBrowser {
  time = 0

  isHidden = false

  viewport = { width: 1300, height: 800 }

  observers: FakeIntersectionObserver[] = []

  private paintQueue: (() => void)[] = []

  readonly environment = {
    now: () => this.time,
    afterNextPaint: (callback: () => void) => {
      this.paintQueue.push(callback)
    },
    createIntersectionObserver: (callback: IntersectionObserverCallback) => {
      const observer = new FakeIntersectionObserver(callback)
      this.observers.push(observer)
      return observer as unknown as IntersectionObserver
    },
    isPageHidden: () => this.isHidden,
    getViewportSize: () => this.viewport,
  }

  /** Advances the clock and paints one frame. */
  paint(atTime = this.time): void {
    this.time = atTime
    const callbacks = this.paintQueue
    this.paintQueue = []
    callbacks.forEach(callback => callback())
  }

  /** Paints frames until nothing is waiting on a frame. */
  paintUntilIdle(): void {
    for (let i = 0; i < 20 && this.paintQueue.length > 0; i++) {
      this.paint()
    }
  }

  get observer(): FakeIntersectionObserver {
    const observer = this.observers.at(-1)
    if (!observer) throw new Error("No IntersectionObserver was created")
    return observer
  }

  setHidden(isHidden: boolean): void {
    this.isHidden = isHidden
    document.dispatchEvent(new Event("visibilitychange"))
  }
}

/** Flushes the microtask that follows scriptFinished. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
}

describe("RenderTimingTracker", () => {
  let browser: FakeBrowser
  let reports: RenderTimingReport[]
  let tracker: RenderTimingTracker

  const createTracker = (): RenderTimingTracker =>
    new RenderTimingTracker({
      onReport: report => reports.push(report),
      environment: browser.environment,
    })

  /**
   * Mounts an element the way ElementContainer does: commits its content
   * (the probe runs before the container's layout effect) and registers it.
   */
  const commitElement = ({
    handle = tracker.createElementHandle(),
    version = {},
    type = "markdown",
    scriptRunId = RUN_ID,
    isContentLoaded = true,
  }: {
    handle?: ElementTimingHandle
    version?: object
    type?: string
    scriptRunId?: string
    isContentLoaded?: boolean
  } = {}): {
    handle: ElementTimingHandle
    target: Element
    version: object
  } => {
    const target = handle.target ?? document.createElement("div")
    if (isContentLoaded) {
      handle.contentCommitted(version)
    }
    handle.setTarget(target)
    handle.elementCommitted(scriptRunId, version, type)
    return { handle, target, version }
  }

  const finishScript = async (atTime: number): Promise<number | undefined> => {
    browser.time = atTime
    const runIndex = tracker.scriptFinished()
    await flushMicrotasks()
    return runIndex
  }

  beforeEach(() => {
    vi.useFakeTimers()
    browser = new FakeBrowser()
    reports = []
    tracker = createTracker()
  })

  afterEach(() => {
    tracker.dispose()
    vi.useRealTimers()
  })

  describe("milestones", () => {
    it("measures the first run from navigation start", async () => {
      browser.time = 120
      tracker.appMounted()
      browser.time = 300
      tracker.runStarted(RUN_ID)

      browser.time = 400
      const { target } = commitElement()
      browser.observer.report(target, true)
      browser.paint(450)

      expect(await finishScript(500)).toBe(0)
      expect(reports).toHaveLength(0)
      browser.paintUntilIdle()

      expect(reports).toEqual([
        {
          runIndex: 0,
          renderTiming: expect.objectContaining({
            appShellReadyMs: 120,
            connectedMs: 300,
            firstContentMs: 450,
            scriptFinishedMs: 500,
            fullyLoadedMs: 500,
            visibleElements: 1,
            wasHidden: false,
            wasSuperseded: false,
            timedOut: false,
            timedOutElements: 0,
          }),
        },
      ])
    })

    it("measures reruns from the rerun request", async () => {
      tracker.runStarted("run-0")
      await finishScript(100)
      browser.paintUntilIdle()

      browser.time = 1000
      tracker.rerunRequested()
      browser.time = 1100
      tracker.runStarted(RUN_ID)
      const { handle, target } = commitElement()
      browser.observer.report(target, true)
      handle.setLoading("chart", "draw", true)
      await finishScript(1200)
      browser.time = 1300
      handle.setLoading("chart", "draw", false)
      browser.paint(1350)
      browser.paintUntilIdle()

      expect(reports).toHaveLength(2)
      const { runIndex, renderTiming } = reports[1]
      expect(runIndex).toBe(1)
      expect(renderTiming).toMatchObject({
        firstContentMs: 350,
        scriptFinishedMs: 200,
        fullyLoadedMs: 350,
      })
      expect(renderTiming.appShellReadyMs).toBeUndefined()
      expect(renderTiming.connectedMs).toBeUndefined()
    })

    it("starts a rerun at the earliest request before the run starts", async () => {
      tracker.runStarted("run-0")
      await finishScript(10)
      browser.paintUntilIdle()

      browser.time = 1000
      tracker.rerunRequested()
      browser.time = 1050
      tracker.rerunRequested()
      browser.time = 1100
      tracker.runStarted(RUN_ID)
      await finishScript(1200)
      browser.paintUntilIdle()

      expect(reports[1].renderTiming.scriptFinishedMs).toBe(200)
    })

    it("starts a run without a request at its NewSession", async () => {
      tracker.runStarted("run-0")
      await finishScript(10)
      browser.paintUntilIdle()

      browser.time = 2000
      tracker.runStarted(RUN_ID)
      await finishScript(2300)
      browser.paintUntilIdle()

      expect(reports[1].renderTiming.scriptFinishedMs).toBe(300)
    })

    it("never reports fully loaded before the script finished", async () => {
      tracker.runStarted(RUN_ID)
      const { target } = commitElement()
      browser.observer.report(target, true)
      browser.paint(100)
      await finishScript(900)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming).toMatchObject({
        firstContentMs: 100,
        fullyLoadedMs: 900,
      })
    })

    it("reports a run without elements as loaded when the script finishes", async () => {
      tracker.runStarted(RUN_ID)
      await finishScript(250)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming).toMatchObject({
        scriptFinishedMs: 250,
        fullyLoadedMs: 250,
        visibleElements: 0,
      })
      expect(reports[0].renderTiming.firstContentMs).toBeUndefined()
    })

    it("returns no run index when no run is measured", () => {
      expect(tracker.scriptFinished()).toBeUndefined()
    })
  })

  describe("first meaningful content", () => {
    it.each(["skeleton", "spinner", "progress", "empty", "space"])(
      "ignores %s elements",
      async type => {
        tracker.runStarted(RUN_ID)
        browser.time = 50
        const placeholder = commitElement({ type })
        browser.observer.report(placeholder.target, true)
        browser.paint(60)
        browser.time = 200
        const content = commitElement()
        browser.observer.report(content.target, true)
        browser.paint(220)
        await finishScript(300)
        browser.paintUntilIdle()

        expect(reports[0].renderTiming.firstContentMs).toBe(220)
        expect(reports[0].renderTiming.visibleElements).toBe(2)
      }
    )

    it("ignores elements that were never in the viewport", async () => {
      tracker.runStarted(RUN_ID)
      const offscreen = commitElement()
      browser.observer.report(offscreen.target, false)
      browser.paint(100)
      const onscreen = commitElement()
      browser.observer.report(onscreen.target, true)
      browser.paint(200)
      await finishScript(300)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming.firstContentMs).toBe(200)
      expect(reports[0].renderTiming.visibleElements).toBe(1)
    })

    it("ignores elements of other runs", async () => {
      tracker.runStarted(RUN_ID)
      const stale = commitElement({ scriptRunId: "previous-run" })
      browser.paint(100)
      await finishScript(300)
      browser.paintUntilIdle()

      expect(browser.observer.observed.has(stale.target)).toBe(false)
      expect(reports[0].renderTiming.firstContentMs).toBeUndefined()
      expect(reports[0].renderTiming.visibleElements).toBe(0)
    })

    it("only counts changed elements on reruns", async () => {
      tracker.runStarted("run-0")
      const changing = commitElement({ scriptRunId: "run-0" })
      const unchanged = commitElement({ scriptRunId: "run-0" })
      browser.observer.report(changing.target, true)
      browser.observer.report(unchanged.target, true)
      browser.paint(50)
      await finishScript(60)
      browser.paintUntilIdle()

      browser.time = 1000
      tracker.rerunRequested()
      tracker.runStarted(RUN_ID)
      // The unchanged element commits the same payload again.
      commitElement({
        handle: unchanged.handle,
        version: unchanged.version,
        scriptRunId: RUN_ID,
      })
      browser.time = 1100
      const changed = commitElement({ handle: changing.handle })
      browser.observer.report(changed.target, true)
      browser.paint(1150)
      await finishScript(1200)
      browser.paintUntilIdle()

      expect(reports[1].renderTiming).toMatchObject({
        firstContentMs: 150,
        visibleElements: 1,
      })
    })
  })

  describe("visibility rule", () => {
    it("doesn't wait for elements outside the viewport", async () => {
      tracker.runStarted(RUN_ID)
      const onscreen = commitElement()
      const offscreen = commitElement()
      offscreen.handle.setLoading("image", "media", true)
      browser.observer.report(onscreen.target, true)
      browser.observer.report(offscreen.target, false)
      browser.paint(100)
      await finishScript(200)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming).toMatchObject({
        fullyLoadedMs: 200,
        visibleElements: 1,
        mediaLoadingMs: 0,
      })
    })

    it("waits until every element has a visibility result", async () => {
      tracker.runStarted(RUN_ID)
      const { target } = commitElement()
      browser.paint(100)
      await finishScript(200)
      browser.paintUntilIdle()

      expect(reports).toHaveLength(0)

      browser.time = 300
      browser.observer.report(target, false)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming.fullyLoadedMs).toBe(200)
    })

    it("waits for elements scrolled into view before the run is loaded", async () => {
      tracker.runStarted(RUN_ID)
      const onscreen = commitElement()
      const belowFold = commitElement()
      belowFold.handle.setLoading("chart", "draw", true)
      browser.observer.report(onscreen.target, true)
      browser.observer.report(belowFold.target, false)
      await finishScript(100)
      // The user scrolls the chart into view before the run completes.
      browser.observer.report(belowFold.target, true)
      browser.paintUntilIdle()

      expect(reports).toHaveLength(0)

      browser.time = 700
      belowFold.handle.setLoading("chart", "draw", false)
      browser.paint(720)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming).toMatchObject({
        fullyLoadedMs: 720,
        visibleElements: 2,
      })
    })

    it("stops waiting for elements pushed out of view by content above", async () => {
      tracker.runStarted(RUN_ID)
      const pushedDown = commitElement()
      pushedDown.handle.setLoading("image", "media", true)
      browser.observer.report(pushedDown.target, true)
      await finishScript(100)
      browser.paintUntilIdle()

      expect(reports).toHaveLength(0)

      browser.time = 150
      browser.observer.report(pushedDown.target, false)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming).toMatchObject({
        fullyLoadedMs: 100,
        visibleElements: 0,
      })
    })

    it("stops waiting for elements that unmount", async () => {
      tracker.runStarted(RUN_ID)
      const { handle, target } = commitElement()
      handle.setLoading("chart", "draw", true)
      browser.observer.report(target, true)
      await finishScript(100)
      browser.paintUntilIdle()

      expect(reports).toHaveLength(0)

      handle.dispose()
      browser.paintUntilIdle()

      expect(reports[0].renderTiming.visibleElements).toBe(0)
      expect(browser.observer.observed.has(target)).toBe(false)
    })

    it("counts every element as visible without IntersectionObserver", async () => {
      tracker.dispose()
      tracker = new RenderTimingTracker({
        onReport: report => reports.push(report),
        environment: {
          ...browser.environment,
          createIntersectionObserver: () => undefined,
        },
      })
      tracker.runStarted(RUN_ID)
      commitElement()
      browser.paint(100)
      await finishScript(200)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming.visibleElements).toBe(1)
    })

    it("waits for the layout to settle before completing", async () => {
      tracker.runStarted(RUN_ID)
      const first = commitElement()
      browser.observer.report(first.target, true)
      browser.paint(50)
      await finishScript(100)
      // The run looks complete; one frame later a new element commits.
      browser.paint(110)
      const late = commitElement()
      late.handle.setLoading("chart", "draw", true)
      browser.observer.report(late.target, true)
      browser.paintUntilIdle()

      expect(reports).toHaveLength(0)

      browser.time = 400
      late.handle.setLoading("chart", "draw", false)
      browser.paint(420)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming.fullyLoadedMs).toBe(420)
    })

    it.each([
      [{ width: 375, height: 667 }, 0, 480],
      [{ width: 800, height: 600 }, 768, 480],
      [{ width: 1440, height: 900 }, 1280, 900],
      [{ width: 2560, height: 1600 }, 1920, 1440],
    ])(
      "reports the viewport %o in buckets %i x %i",
      async (viewport, widthBucket, heightBucket) => {
        browser.viewport = viewport
        tracker.runStarted(RUN_ID)
        await finishScript(10)
        browser.paintUntilIdle()

        expect(reports[0].renderTiming).toMatchObject({
          viewportWidthBucket: widthBucket,
          viewportHeightBucket: heightBucket,
        })
      }
    )

    it("reads the viewport size after the run's first paint", async () => {
      tracker.runStarted(RUN_ID)
      browser.viewport = { width: 1440, height: 900 }
      browser.paint(10)
      browser.viewport = { width: 375, height: 667 }
      await finishScript(20)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming).toMatchObject({
        viewportWidthBucket: 1280,
        viewportHeightBucket: 900,
      })
    })
  })

  describe("post-script split", () => {
    it("splits the gap into code loading, drawing and media loading", async () => {
      tracker.runStarted(RUN_ID)
      browser.time = 500
      const chart = commitElement({ isContentLoaded: false })
      const images = commitElement()
      browser.observer.report(chart.target, true)
      browser.observer.report(images.target, true)
      await finishScript(500)

      browser.time = 600
      images.handle.setLoading("image-1", "media", true)
      browser.time = 700
      chart.handle.contentCommitted(chart.version)
      chart.handle.setLoading("chart", "draw", true)
      images.handle.setLoading("image-2", "media", true)
      browser.time = 800
      images.handle.setLoading("image-1", "media", false)
      browser.time = 1000
      images.handle.setLoading("image-2", "media", false)
      browser.time = 1100
      chart.handle.setLoading("chart", "draw", false)
      browser.paint(1150)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming).toMatchObject({
        scriptFinishedMs: 500,
        fullyLoadedMs: 1150,
        codeLoadingMs: 200,
        drawingMs: 400,
        mediaLoadingMs: 400,
      })
    })

    it("only counts work after the script finished", async () => {
      tracker.runStarted(RUN_ID)
      const { handle, target } = commitElement()
      browser.observer.report(target, true)
      browser.time = 100
      handle.setLoading("chart", "draw", true)
      await finishScript(400)
      browser.time = 500
      handle.setLoading("chart", "draw", false)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming.drawingMs).toBe(100)
    })

    it("treats an element that starts new work after painting as not ready", async () => {
      tracker.runStarted(RUN_ID)
      const { handle, target } = commitElement()
      browser.observer.report(target, true)
      browser.paint(100)
      await finishScript(200)
      // The chart only starts drawing once it has a width.
      handle.setLoading("chart", "draw", true)
      browser.paintUntilIdle()

      expect(reports).toHaveLength(0)

      browser.time = 600
      handle.setLoading("chart", "draw", false)
      browser.paint(650)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming).toMatchObject({
        fullyLoadedMs: 650,
        drawingMs: 400,
      })
    })

    it("applies work that started before the element registered", async () => {
      tracker.runStarted(RUN_ID)
      const handle = tracker.createElementHandle()
      browser.time = 100
      // Child layout effects run before the container registers the element.
      handle.setLoading("image", "media", true)
      const { target } = commitElement({ handle })
      browser.observer.report(target, true)
      await finishScript(100)
      browser.time = 300
      handle.setLoading("image", "media", false)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming).toMatchObject({
        fullyLoadedMs: 300,
        mediaLoadingMs: 200,
      })
    })
  })

  describe("exclusions", () => {
    it("reports a run hidden while loading as soon as it's hidden", async () => {
      tracker.runStarted(RUN_ID)
      const { handle, target } = commitElement()
      handle.setLoading("chart", "draw", true)
      browser.observer.report(target, true)
      await finishScript(100)
      browser.time = 200
      browser.setHidden(true)

      expect(reports).toHaveLength(1)
      expect(reports[0].renderTiming).toMatchObject({
        wasHidden: true,
        drawingMs: 100,
      })
      expect(reports[0].renderTiming.fullyLoadedMs).toBeUndefined()
    })

    it("reports a run hidden before its script finished once it finishes", async () => {
      tracker.runStarted(RUN_ID)
      browser.setHidden(true)
      browser.setHidden(false)

      expect(reports).toHaveLength(0)

      await finishScript(100)

      expect(reports[0].renderTiming.wasHidden).toBe(true)
      expect(reports[0].renderTiming.fullyLoadedMs).toBeUndefined()
    })

    it("flags the first run if the page was hidden before it started", async () => {
      browser.setHidden(true)
      browser.setHidden(false)
      tracker.runStarted(RUN_ID)
      await finishScript(100)

      expect(reports[0].renderTiming.wasHidden).toBe(true)
    })

    it("flags the first run if the page started hidden", async () => {
      tracker.dispose()
      browser.isHidden = true
      tracker = createTracker()
      browser.isHidden = false
      tracker.runStarted(RUN_ID)
      await finishScript(100)

      expect(reports[0].renderTiming.wasHidden).toBe(true)
    })

    it("doesn't flag a rerun for a page hidden between runs", async () => {
      tracker.runStarted("run-0")
      await finishScript(10)
      browser.paintUntilIdle()
      browser.setHidden(true)
      browser.setHidden(false)

      tracker.rerunRequested()
      tracker.runStarted(RUN_ID)
      await finishScript(100)
      browser.paintUntilIdle()

      expect(reports[1].renderTiming.wasHidden).toBe(false)
    })

    it("reports a run superseded after its script finished immediately", async () => {
      tracker.runStarted(RUN_ID)
      const { handle, target } = commitElement()
      handle.setLoading("chart", "draw", true)
      browser.observer.report(target, true)
      await finishScript(100)
      browser.time = 300
      tracker.rerunRequested()

      expect(reports).toHaveLength(1)
      expect(reports[0].renderTiming.wasSuperseded).toBe(true)
      expect(reports[0].renderTiming.fullyLoadedMs).toBeUndefined()
    })

    it("reports a run superseded before its script finished once it finishes", async () => {
      tracker.runStarted(RUN_ID)
      tracker.rerunRequested()

      expect(reports).toHaveLength(0)

      await finishScript(100)

      expect(reports[0].renderTiming.wasSuperseded).toBe(true)
    })

    it("drops a run replaced before its script finished", async () => {
      tracker.runStarted("run-0")
      tracker.runStarted(RUN_ID)
      await finishScript(100)
      browser.paintUntilIdle()

      expect(reports).toHaveLength(1)
      expect(reports[0].runIndex).toBe(1)
      expect(reports[0].renderTiming.wasSuperseded).toBe(false)
    })

    it("reports a run replaced by a server-started run as superseded", async () => {
      tracker.runStarted("run-0")
      const { handle, target } = commitElement({ scriptRunId: "run-0" })
      handle.setLoading("chart", "draw", true)
      browser.observer.report(target, true)
      await finishScript(100)
      tracker.runStarted(RUN_ID)

      expect(reports).toHaveLength(1)
      expect(reports[0].runIndex).toBe(0)
      expect(reports[0].renderTiming.wasSuperseded).toBe(true)
    })

    it("times out visible elements that never report ready", async () => {
      tracker.runStarted(RUN_ID)
      const ready = commitElement()
      const stuck = commitElement()
      stuck.handle.setLoading("chart", "draw", true)
      browser.observer.report(ready.target, true)
      browser.observer.report(stuck.target, true)
      browser.paint(50)
      await finishScript(100)
      browser.paintUntilIdle()
      browser.time = 100 + RENDER_TIMING_TIMEOUT_MS
      vi.advanceTimersByTime(RENDER_TIMING_TIMEOUT_MS - 1)

      expect(reports).toHaveLength(0)

      vi.advanceTimersByTime(1)

      expect(reports[0].renderTiming).toMatchObject({
        timedOut: true,
        timedOutElements: 1,
        drawingMs: RENDER_TIMING_TIMEOUT_MS,
        firstContentMs: 50,
      })
      expect(reports[0].renderTiming.fullyLoadedMs).toBeUndefined()
    })

    it("reports a run whose elements are ready as loaded when settling stalls", async () => {
      tracker.runStarted(RUN_ID)
      const { target } = commitElement()
      browser.observer.report(target, true)
      await finishScript(100)
      // One frame paints, then the browser stops rendering frames.
      browser.paint(200)
      browser.time = 100 + RENDER_TIMING_TIMEOUT_MS
      vi.advanceTimersByTime(RENDER_TIMING_TIMEOUT_MS)

      expect(reports[0].renderTiming).toMatchObject({
        timedOut: false,
        fullyLoadedMs: 200,
      })
    })

    it("doesn't time out runs that completed", async () => {
      tracker.runStarted(RUN_ID)
      await finishScript(100)
      browser.paintUntilIdle()
      vi.advanceTimersByTime(RENDER_TIMING_TIMEOUT_MS)

      expect(reports).toHaveLength(1)
      expect(reports[0].renderTiming.timedOut).toBe(false)
    })
  })

  describe("lifecycle", () => {
    it("releases the observer once the run is reported", async () => {
      tracker.runStarted(RUN_ID)
      const { target } = commitElement()
      browser.observer.report(target, true)
      browser.paint(10)
      await finishScript(20)
      browser.paintUntilIdle()

      expect(reports).toHaveLength(1)
      expect(browser.observer.observed.size).toBe(0)
    })

    it("stops listening for visibility changes between runs", async () => {
      const removeListener = vi.spyOn(document, "removeEventListener")
      tracker.runStarted(RUN_ID)
      await finishScript(20)
      browser.paintUntilIdle()

      expect(removeListener).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function)
      )
    })

    it("stops measuring when disposed", async () => {
      tracker.runStarted(RUN_ID)
      tracker.dispose()
      tracker.rerunRequested()

      expect(tracker.scriptFinished()).toBeUndefined()
      await flushMicrotasks()
      browser.paintUntilIdle()
      expect(reports).toHaveLength(0)
    })

    it("reports the loading screen mode", async () => {
      tracker.runStarted(RUN_ID)
      await finishScript(10)
      browser.paintUntilIdle()

      expect(reports[0].renderTiming.loadingScreen).toBe("v2")
    })
  })
})
