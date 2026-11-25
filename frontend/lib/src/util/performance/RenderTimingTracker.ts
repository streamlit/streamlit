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

import type { RenderTiming } from "@streamlit/protobuf"

/** Asynchronous work an element can wait on before it is fully drawn. */
export type ElementLoadKind = "draw" | "media"

/**
 * How long after the script finishes to wait for visible elements to report
 * ready before the run is reported as timed out.
 */
export const RENDER_TIMING_TIMEOUT_MS = 30_000

/** Lower bounds, in CSS pixels, of the reported viewport size buckets. */
const VIEWPORT_WIDTH_BUCKETS = [0, 480, 768, 1024, 1280, 1600, 1920]
const VIEWPORT_HEIGHT_BUCKETS = [0, 480, 720, 900, 1080, 1440]

/**
 * Element types that are placeholders or loading indicators rather than
 * content, so they never count as the run's first meaningful content.
 */
const NON_CONTENT_ELEMENT_TYPES = new Set([
  "empty",
  "progress",
  "skeleton",
  "space",
  "spinner",
])

/** The browser APIs the tracker depends on, replaceable in tests. */
export interface RenderTimingEnvironment {
  /** Milliseconds since navigation start, like `performance.now()`. */
  now: () => number
  /** Runs the callback once the browser has painted the next frame. */
  afterNextPaint: (callback: () => void) => void
  /** Returns undefined when IntersectionObserver isn't supported. */
  createIntersectionObserver: (
    callback: IntersectionObserverCallback
  ) => IntersectionObserver | undefined
  isPageHidden: () => boolean
  getViewportSize: () => { width: number; height: number }
}

/** One renderTiming metrics event. */
export interface RenderTimingReport {
  runIndex: number
  renderTiming: RenderTiming.$Properties
}

export interface RenderTimingTrackerOptions {
  /** Sends the renderTiming event of a run. */
  onReport: (report: RenderTimingReport) => void
  environment?: Partial<RenderTimingEnvironment>
}

interface PendingLoad {
  kind: ElementLoadKind
  start: number
}

interface LoadInterval extends PendingLoad {
  end: number
}

interface ElementRecord {
  readonly run: RunMeasurement
  readonly handle: ElementTimingHandle
  /** The element payload this record measures. */
  readonly version: unknown
  readonly isContent: boolean
  readonly registeredAt: number
  /** When the element's code had loaded and its content committed. */
  contentCommittedAt?: number
  readonly pendingLoads: Map<string, PendingLoad>
  readonly loadIntervals: LoadInterval[]
  /** When the element was painted with no pending work. */
  readyAt?: number
  target?: Element
  /** Undefined until the IntersectionObserver first reports the element. */
  isIntersecting?: boolean
  wasEverIntersecting: boolean
}

interface RunMeasurement {
  readonly runIndex: number
  readonly scriptRunId: string
  readonly startAt: number
  readonly appShellReadyAt?: number
  readonly connectedAt?: number
  scriptFinishedAt?: number
  /**
   * Earliest paint of content that was in the viewport. Kept on the run
   * because an element that changes during the run, such as streamed text,
   * replaces its record.
   */
  firstContentAt?: number
  wasHidden: boolean
  wasSuperseded: boolean
  readonly records: Set<ElementRecord>
  readonly recordsByTarget: Map<Element, ElementRecord>
  /**
   * Number of records the run is still waiting on: not yet reported by the
   * IntersectionObserver, or visible and not ready. Kept up to date by
   * `updateRecord`, so checking whether the run is complete doesn't scan.
   */
  waitingCount: number
  /** Records to check for readiness after the next paint. */
  readonly recordsToCheck: Set<ElementRecord>
  isReadyCheckScheduled: boolean
  observer?: IntersectionObserver
  viewportSize?: { width: number; height: number }
  timeoutId?: ReturnType<typeof setTimeout>
  /** Bumped on every change that can affect whether the run is complete. */
  changeCount: number
  isSettling: boolean
  isFinalized: boolean
}

type FinalizeReason = "complete" | "timedOut" | "cutShort"

const DEFAULT_ENVIRONMENT: RenderTimingEnvironment = {
  now: () => performance.now(),
  afterNextPaint: callback => {
    requestAnimationFrame(() => {
      // eslint-disable-next-line no-restricted-globals -- Non-React class; a task after the frame runs once it's painted.
      setTimeout(callback, 0)
    })
  },
  createIntersectionObserver: callback =>
    typeof IntersectionObserver === "undefined"
      ? undefined
      : new IntersectionObserver(callback),
  isPageHidden: () => document.visibilityState === "hidden",
  // Read once per run, right after a paint while layout is clean.
  getViewportSize: () => ({
    // eslint-disable-next-line no-restricted-properties, streamlit-custom/no-force-reflow-access -- Non-React class; see above.
    width: window.innerWidth,
    // eslint-disable-next-line no-restricted-properties, streamlit-custom/no-force-reflow-access -- Non-React class; see above.
    height: window.innerHeight,
  }),
}

/** Whether the run can't complete until this record changes. */
function isWaitingOn(record: ElementRecord): boolean {
  return (
    record.isIntersecting === undefined ||
    (record.isIntersecting && record.readyAt === undefined)
  )
}

/**
 * Applies a change to a record's visibility or readiness, keeping the run's
 * `waitingCount` up to date.
 */
function updateRecord(record: ElementRecord, change: () => void): void {
  const wasWaiting = isWaitingOn(record)
  change()
  record.run.waitingCount += Number(isWaitingOn(record)) - Number(wasWaiting)
}

/** Records the record's paint as the run's first content if it's earliest. */
function noteFirstContent(record: ElementRecord): void {
  const { run, readyAt } = record
  if (
    !record.isContent ||
    !record.wasEverIntersecting ||
    readyAt === undefined
  ) {
    return
  }
  run.firstContentAt = Math.min(run.firstContentAt ?? readyAt, readyAt)
}

function getBucket(size: number, bounds: number[]): number {
  return bounds.reduce((bucket, bound) => (size >= bound ? bound : bucket), 0)
}

/** Total length of the union of the intervals, clipped to [from, to]. */
function getUnionLength(
  intervals: { start: number; end: number }[],
  from: number,
  to: number
): number {
  const clipped = intervals
    .map(({ start, end }) => ({
      start: Math.max(start, from),
      end: Math.min(end, to),
    }))
    .filter(({ start, end }) => end > start)
    .toSorted((a, b) => a.start - b.start)

  let total = 0
  let currentEnd = -Infinity
  for (const { start, end } of clipped) {
    if (end <= currentEnd) continue
    total += end - Math.max(start, currentEnd)
    currentEnd = end
  }
  return total
}

/**
 * Connects one element container to the tracker. The container reports when
 * it commits an element and when the element's content (past its code-split
 * Suspense boundary) commits; the element's components report pending
 * asynchronous work through `setLoading`. Calls can arrive in any order
 * within a React commit.
 */
export class ElementTimingHandle {
  /** The record of the element in the measured run, if any. */
  record?: ElementRecord

  target?: Element

  /** Asynchronous work currently pending in the element, by slot id. */
  readonly loadingSlots = new Map<string, ElementLoadKind>()

  /** The element payload whose content most recently committed. */
  contentVersion?: unknown

  /** The element payload most recently committed by the container. */
  committedVersion?: unknown

  private readonly tracker: RenderTimingTracker

  constructor(tracker: RenderTimingTracker) {
    this.tracker = tracker
  }

  /** Sets the container's DOM node, which decides whether it's visible. */
  setTarget(target: Element | null): void {
    this.target = target ?? undefined
    this.tracker.handleTargetChanged(this)
  }

  /**
   * Called each time the container commits. Registers the element with the
   * measured run if it belongs to the run and its payload is new.
   */
  elementCommitted(
    scriptRunId: string,
    version: unknown,
    elementType: string
  ): void {
    if (version === this.committedVersion) return
    this.committedVersion = version
    this.tracker.registerElement(
      this,
      scriptRunId,
      version,
      !NON_CONTENT_ELEMENT_TYPES.has(elementType)
    )
  }

  /** Called when the element's content commits past its Suspense boundary. */
  contentCommitted(version: unknown): void {
    this.contentVersion = version
    this.tracker.handleContentCommitted(this)
  }

  /** Marks one piece of the element's asynchronous work as pending or done. */
  setLoading(slot: string, kind: ElementLoadKind, isLoading: boolean): void {
    if (isLoading) {
      this.loadingSlots.set(slot, kind)
    } else {
      this.loadingSlots.delete(slot)
    }
    this.tracker.handleLoadingChanged(this, slot, kind, isLoading)
  }

  /** Called when the container unmounts. */
  dispose(): void {
    this.committedVersion = undefined
    this.contentVersion = undefined
    this.tracker.removeRecord(this)
  }
}

/**
 * Measures what the user waits for in each script run, for the browser's
 * renderTiming metrics event: milestones from the run's start to the first
 * meaningful content and to every visible element being drawn, and what the
 * time after the script finished was spent on. See the RenderTiming message
 * in MetricsEvent.proto for the reported fields.
 *
 * A run is measured from its NewSession until it fully loads, is cut short
 * (page hidden, or superseded by another run) or times out. Observers and
 * timers only exist while a run is measured.
 */
export class RenderTimingTracker {
  private readonly env: RenderTimingEnvironment

  private readonly onReport: (report: RenderTimingReport) => void

  private appShellReadyAt?: number

  private wasHiddenBeforeFirstRun: boolean

  private nextRunIndex = 0

  /** When the earliest rerun request not yet followed by a run was sent. */
  private pendingRequestAt?: number

  private run?: RunMeasurement

  private isListeningForVisibility = false

  private isDisposed = false

  constructor({ onReport, environment }: RenderTimingTrackerOptions) {
    this.env = { ...DEFAULT_ENVIRONMENT, ...environment }
    this.onReport = onReport
    this.wasHiddenBeforeFirstRun = this.env.isPageHidden()
    // The first run is measured from navigation start, so watch for the page
    // being hidden from now on.
    this.listenForVisibility()
  }

  createElementHandle(): ElementTimingHandle {
    return new ElementTimingHandle(this)
  }

  /** Called when the frontend app mounts. */
  appMounted(): void {
    this.appShellReadyAt ??= this.env.now()
  }

  /** Called when the browser sends a rerun request. */
  rerunRequested(): void {
    if (this.isDisposed) return

    this.pendingRequestAt ??= this.env.now()
    const { run } = this
    if (run && !run.isFinalized) {
      run.wasSuperseded = true
      if (run.scriptFinishedAt !== undefined) {
        this.finalize(run, "cutShort")
      }
    }
  }

  /** Called when a NewSession message starts a run. */
  runStarted(scriptRunId: string): void {
    if (this.isDisposed) return

    const now = this.env.now()
    if (this.run && !this.run.isFinalized) {
      this.run.wasSuperseded = true
      this.finalize(this.run, "cutShort")
    }

    const runIndex = this.nextRunIndex++
    const isFirstRun = runIndex === 0
    const run: RunMeasurement = {
      runIndex,
      scriptRunId,
      startAt: isFirstRun ? 0 : (this.pendingRequestAt ?? now),
      appShellReadyAt: isFirstRun ? this.appShellReadyAt : undefined,
      connectedAt: isFirstRun ? now : undefined,
      wasHidden:
        (isFirstRun && this.wasHiddenBeforeFirstRun) ||
        this.env.isPageHidden(),
      wasSuperseded: false,
      records: new Set(),
      recordsByTarget: new Map(),
      waitingCount: 0,
      recordsToCheck: new Set(),
      isReadyCheckScheduled: false,
      changeCount: 0,
      isSettling: false,
      isFinalized: false,
    }
    run.observer = this.env.createIntersectionObserver(entries => {
      this.handleIntersections(run, entries)
    })
    this.env.afterNextPaint(() => {
      if (!run.isFinalized) run.viewportSize = this.env.getViewportSize()
    })
    this.pendingRequestAt = undefined
    this.run = run
    this.listenForVisibility()
  }

  /**
   * Called when the PageProfile message of the run is handled. Returns the
   * run's index for the pageProfile event, or undefined if no run is
   * measured.
   */
  scriptFinished(): number | undefined {
    const { run } = this
    if (!run || run.isFinalized || run.scriptFinishedAt !== undefined) {
      return undefined
    }

    run.scriptFinishedAt = this.env.now()
    // Deferred so the caller's pageProfile event goes out before this run's
    // renderTiming event.
    queueMicrotask(() => {
      if (run.isFinalized) return
      if (run.wasHidden || run.wasSuperseded) {
        this.finalize(run, "cutShort")
        return
      }
      // eslint-disable-next-line no-restricted-globals -- Non-React class managing the run's timeout.
      run.timeoutId = setTimeout(() => {
        // Every element can be ready while the settle frames never paint,
        // such as in a window the browser stopped rendering.
        this.finalize(run, this.isComplete(run) ? "complete" : "timedOut")
      }, RENDER_TIMING_TIMEOUT_MS)
      this.evaluate(run)
    })
    return run.runIndex
  }

  /** Stops measuring and releases observers, listeners and timers. */
  dispose(): void {
    this.isDisposed = true
    if (this.run) {
      this.release(this.run)
      this.run = undefined
    }
    this.stopListeningForVisibility()
  }

  registerElement(
    handle: ElementTimingHandle,
    scriptRunId: string,
    version: unknown,
    isContent: boolean
  ): void {
    this.removeRecord(handle)

    const { run } = this
    if (!run || run.isFinalized || run.scriptRunId !== scriptRunId) return

    const now = this.env.now()
    const record: ElementRecord = {
      run,
      handle,
      version,
      isContent,
      registeredAt: now,
      contentCommittedAt: handle.contentVersion === version ? now : undefined,
      pendingLoads: new Map(),
      loadIntervals: [],
      wasEverIntersecting: false,
    }
    handle.loadingSlots.forEach((kind, slot) => {
      record.pendingLoads.set(slot, { kind, start: now })
    })
    handle.record = record
    run.records.add(record)
    // Not yet reported by the IntersectionObserver.
    run.waitingCount++
    run.changeCount++
    this.observe(record)
    this.scheduleReadyCheck(record)
  }

  handleTargetChanged(handle: ElementTimingHandle): void {
    const record = this.getMeasuredRecord(handle)
    if (record) this.observe(record)
  }

  handleContentCommitted(handle: ElementTimingHandle): void {
    const record = this.getMeasuredRecord(handle)
    if (
      !record ||
      record.version !== handle.contentVersion ||
      record.contentCommittedAt !== undefined
    ) {
      return
    }
    record.contentCommittedAt = this.env.now()
    record.run.changeCount++
    this.scheduleReadyCheck(record)
  }

  handleLoadingChanged(
    handle: ElementTimingHandle,
    slot: string,
    kind: ElementLoadKind,
    isLoading: boolean
  ): void {
    const record = this.getMeasuredRecord(handle)
    if (!record) return

    const now = this.env.now()
    const pending = record.pendingLoads.get(slot)
    if (isLoading && !pending) {
      record.pendingLoads.set(slot, { kind, start: now })
      // An element that starts new work after being painted isn't done.
      updateRecord(record, () => {
        record.readyAt = undefined
      })
      record.run.changeCount++
    } else if (!isLoading && pending) {
      record.pendingLoads.delete(slot)
      record.loadIntervals.push({ ...pending, end: now })
      record.run.changeCount++
      this.scheduleReadyCheck(record)
    }
  }

  removeRecord(handle: ElementTimingHandle): void {
    const { record } = handle
    if (!record) return

    handle.record = undefined
    const { run } = record
    run.records.delete(record)
    run.recordsToCheck.delete(record)
    if (isWaitingOn(record)) run.waitingCount--
    if (record.target) {
      run.recordsByTarget.delete(record.target)
      run.observer?.unobserve(record.target)
    }
    if (!run.isFinalized) {
      run.changeCount++
      this.evaluate(run)
    }
  }

  private getMeasuredRecord(
    handle: ElementTimingHandle
  ): ElementRecord | undefined {
    const { record } = handle
    return record && !record.run.isFinalized ? record : undefined
  }

  private observe(record: ElementRecord): void {
    const { run, handle } = record
    if (!handle.target || record.target === handle.target) return

    if (record.target) {
      run.recordsByTarget.delete(record.target)
      run.observer?.unobserve(record.target)
    }
    record.target = handle.target
    run.recordsByTarget.set(record.target, record)
    if (run.observer) {
      updateRecord(record, () => {
        record.isIntersecting = undefined
      })
      run.observer.observe(record.target)
    } else {
      // Without IntersectionObserver every element counts as visible.
      updateRecord(record, () => {
        record.isIntersecting = true
      })
      record.wasEverIntersecting = true
    }
  }

  private handleIntersections(
    run: RunMeasurement,
    entries: IntersectionObserverEntry[]
  ): void {
    if (run.isFinalized) return

    for (const entry of entries) {
      const record = run.recordsByTarget.get(entry.target)
      if (!record) continue
      updateRecord(record, () => {
        record.isIntersecting = entry.isIntersecting
      })
      record.wasEverIntersecting ||= entry.isIntersecting
      noteFirstContent(record)
    }
    run.changeCount++
    this.evaluate(run)
  }

  /**
   * Checks the record for readiness after the next paint. One check per run
   * per frame covers every record that changed in that frame.
   */
  private scheduleReadyCheck(record: ElementRecord): void {
    const { run } = record
    run.recordsToCheck.add(record)
    if (run.isReadyCheckScheduled) return

    run.isReadyCheckScheduled = true
    this.env.afterNextPaint(() => {
      run.isReadyCheckScheduled = false
      if (run.isFinalized) return

      const paintedAt = this.env.now()
      let hasNewReady = false
      for (const pending of run.recordsToCheck) {
        if (
          pending.readyAt !== undefined ||
          pending.contentCommittedAt === undefined ||
          pending.pendingLoads.size > 0
        ) {
          continue
        }
        updateRecord(pending, () => {
          pending.readyAt = paintedAt
        })
        noteFirstContent(pending)
        hasNewReady = true
      }
      run.recordsToCheck.clear()
      if (hasNewReady) {
        run.changeCount++
        this.evaluate(run)
      }
    })
  }

  private isComplete(run: RunMeasurement): boolean {
    return run.scriptFinishedAt !== undefined && run.waitingCount === 0
  }

  /**
   * Completes the run once it has stayed complete for two painted frames, so
   * layout shifts and React commits still pending when it first looked
   * complete are taken into account.
   */
  private evaluate(run: RunMeasurement): void {
    if (run.isFinalized || run.isSettling || !this.isComplete(run)) return

    run.isSettling = true
    const changeCount = run.changeCount
    this.env.afterNextPaint(() => {
      this.env.afterNextPaint(() => {
        run.isSettling = false
        if (run.isFinalized) return
        if (run.changeCount === changeCount && this.isComplete(run)) {
          this.finalize(run, "complete")
        } else {
          this.evaluate(run)
        }
      })
    })
  }

  private finalize(run: RunMeasurement, reason: FinalizeReason): void {
    if (run.isFinalized) return

    const now = this.env.now()
    const renderTiming =
      run.scriptFinishedAt === undefined
        ? undefined
        : this.buildRenderTiming(run, run.scriptFinishedAt, reason, now)

    this.release(run)
    if (this.run === run) {
      this.run = undefined
      this.stopListeningForVisibility()
    }

    // A run without a PageProfile message has no pageProfile event to join.
    if (renderTiming) {
      this.onReport({ runIndex: run.runIndex, renderTiming })
    }
  }

  private release(run: RunMeasurement): void {
    run.isFinalized = true
    clearTimeout(run.timeoutId)
    run.observer?.disconnect()
    for (const record of run.records) {
      if (record.handle.record === record) {
        record.handle.record = undefined
      }
    }
    run.records.clear()
    run.recordsByTarget.clear()
    run.recordsToCheck.clear()
    run.waitingCount = 0
  }

  private buildRenderTiming(
    run: RunMeasurement,
    scriptFinishedAt: number,
    reason: FinalizeReason,
    now: number
  ): RenderTiming.$Properties {
    const records = Array.from(run.records)
    const visible = records.filter(record => record.isIntersecting === true)

    const fullyLoadedAt =
      reason === "complete"
        ? Math.max(
            scriptFinishedAt,
            ...visible.map(record => record.readyAt ?? scriptFinishedAt)
          )
        : undefined
    const gapEnd = fullyLoadedAt ?? now

    const mediaLoadingMs = Math.round(
      getUnionLength(
        visible.flatMap(record => [
          ...record.loadIntervals.filter(load => load.kind === "media"),
          ...Array.from(record.pendingLoads.values())
            .filter(load => load.kind === "media")
            .map(load => ({ start: load.start, end: gapEnd })),
        ]),
        scriptFinishedAt,
        gapEnd
      )
    )
    const codeLoadingMs = Math.round(
      getUnionLength(
        visible.map(record => ({
          start: record.registeredAt,
          end: record.contentCommittedAt ?? gapEnd,
        })),
        scriptFinishedAt,
        gapEnd
      )
    )

    const toRunTime = (time: number | undefined): number | undefined =>
      time === undefined ? undefined : Math.round(time - run.startAt)
    const { width, height } = run.viewportSize ?? this.env.getViewportSize()
    const timedOutElements =
      reason === "timedOut"
        ? records.filter(
            record =>
              record.isIntersecting !== false && record.readyAt === undefined
          ).length
        : 0

    return {
      appShellReadyMs: toRunTime(run.appShellReadyAt),
      connectedMs: toRunTime(run.connectedAt),
      firstContentMs: toRunTime(run.firstContentAt),
      scriptFinishedMs: toRunTime(scriptFinishedAt),
      fullyLoadedMs: toRunTime(fullyLoadedAt),
      codeLoadingMs,
      mediaLoadingMs,
      visibleElements: visible.length,
      viewportWidthBucket: getBucket(width, VIEWPORT_WIDTH_BUCKETS),
      viewportHeightBucket: getBucket(height, VIEWPORT_HEIGHT_BUCKETS),
      wasHidden: run.wasHidden,
      wasSuperseded: run.wasSuperseded,
      timedOut: reason === "timedOut",
      timedOutElements,
    }
  }

  private readonly handleVisibilityChange = (): void => {
    if (!this.env.isPageHidden()) return

    if (this.nextRunIndex === 0) {
      this.wasHiddenBeforeFirstRun = true
    }
    const { run } = this
    if (run && !run.isFinalized) {
      run.wasHidden = true
      if (run.scriptFinishedAt !== undefined) {
        this.finalize(run, "cutShort")
      }
    }
  }

  private listenForVisibility(): void {
    if (this.isListeningForVisibility) return
    this.isListeningForVisibility = true
    document.addEventListener("visibilitychange", this.handleVisibilityChange)
  }

  private stopListeningForVisibility(): void {
    if (!this.isListeningForVisibility) return
    this.isListeningForVisibility = false
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    )
  }
}
