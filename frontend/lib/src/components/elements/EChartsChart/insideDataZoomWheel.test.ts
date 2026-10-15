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

import {
  type ChartWheelGesture,
  chartWheelPassesToPage,
  createChartWheelGesture,
  noteChartPointerEntered,
  noteChartPointerLeft,
  WHEEL_GESTURE_GAP_MS,
  WHEEL_SETTLE_MS,
} from "./insideDataZoomWheel"

function enter(
  gesture: ChartWheelGesture,
  now: number,
  lastWheelAt = 0
): void {
  noteChartPointerEntered(gesture, now, lastWheelAt)
}

function wheel(
  gesture: ChartWheelGesture,
  now: number,
  previousWheelAt: number,
  overrides: { consumes?: boolean; explicitGesture?: boolean } = {}
): boolean {
  return chartWheelPassesToPage(gesture, {
    now,
    previousWheelAt,
    consumes: overrides.consumes ?? true,
    explicitGesture: overrides.explicitGesture ?? false,
  })
}

describe("chartWheelPassesToPage", () => {
  it("zooms once the pointer has rested on the chart", () => {
    const gesture = createChartWheelGesture()
    enter(gesture, 1_000)

    expect(wheel(gesture, 1_000 + WHEEL_SETTLE_MS - 1, 0)).toBe(true)

    const rested = createChartWheelGesture()
    enter(rested, 1_000)
    expect(wheel(rested, 1_000 + WHEEL_SETTLE_MS, 0)).toBe(false)
  })

  it("keeps the rest of an early flick on the page", () => {
    const gesture = createChartWheelGesture()
    enter(gesture, 1_000)
    const first = 1_000 + 50
    expect(wheel(gesture, first, 0)).toBe(true)
    expect(wheel(gesture, first + 16, first)).toBe(true)
  })

  it("keeps scrolling when a page-scroll flick runs into the chart", () => {
    const gesture = createChartWheelGesture()
    const enteredAt = 5_000
    enter(gesture, enteredAt, enteredAt - 20)

    const firstOnChart = enteredAt + 16
    expect(wheel(gesture, firstOnChart, enteredAt - 20)).toBe(true)
    const lastOfFlick = firstOnChart + 16
    expect(wheel(gesture, lastOfFlick, firstOnChart)).toBe(true)

    const nextFlick = lastOfFlick + WHEEL_GESTURE_GAP_MS + 50
    expect(wheel(gesture, nextFlick, lastOfFlick)).toBe(true)

    expect(wheel(gesture, nextFlick + WHEEL_SETTLE_MS, nextFlick)).toBe(false)
  })

  it("zooms immediately for an explicit modifier or pinch", () => {
    const gesture = createChartWheelGesture()
    enter(gesture, 1_000)
    expect(wheel(gesture, 1_010, 0, { explicitGesture: true })).toBe(false)
  })

  it("keeps scrolling when the wheel would not zoom or pan", () => {
    const gesture = createChartWheelGesture()
    enter(gesture, 1_000)
    expect(wheel(gesture, 5_000, 0, { consumes: false })).toBe(true)
  })

  it("keeps a page-scroll flick scrolling when a later wheel is a pinch or modifier", () => {
    const gesture = createChartWheelGesture()
    enter(gesture, 1_000)
    const first = 1_050
    expect(wheel(gesture, first, 0)).toBe(true)
    expect(wheel(gesture, first + 16, first, { explicitGesture: true })).toBe(
      true
    )
  })

  it("waits for the pointer to rest again after it leaves the chart", () => {
    const gesture = createChartWheelGesture()
    enter(gesture, 1_000)
    expect(wheel(gesture, 1_000 + WHEEL_SETTLE_MS, 0)).toBe(false)

    noteChartPointerLeft(gesture)
    enter(gesture, 2_000, 0)
    const early = 2_000 + WHEEL_SETTLE_MS - 1
    expect(wheel(gesture, early, 0)).toBe(true)
    // That wheel cleared this gesture's rest timer. The same object zooms
    // only after another full rest, measured from the wheel that cleared it.
    expect(wheel(gesture, early + WHEEL_SETTLE_MS, early)).toBe(false)
  })

  it("scrolls a wheel that arrives before pointerenter, then zooms once the pointer rests", () => {
    const gesture = createChartWheelGesture()
    const first = 5_000
    expect(wheel(gesture, first, 0)).toBe(true)
    expect(wheel(gesture, first + WHEEL_SETTLE_MS, first)).toBe(false)
  })
})
