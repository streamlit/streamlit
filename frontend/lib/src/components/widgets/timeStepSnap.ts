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

/** Hour/minute/second parts used by step-snap helpers. */
export interface TimeParts {
  hour: number
  minute: number
  second: number
}

/**
 * Compute the next step-snapped value given the current total, step size,
 * direction, and wrap boundary. Used for minute-granular (max=1440) and
 * hour-only (max=24) step snapping on ArrowUp/ArrowDown.
 */
export function snapTimeStep(
  current: number,
  step: number,
  up: boolean,
  max: number
): number {
  const next = up
    ? Math.floor(current / step) * step + step
    : Math.ceil(current / step) * step - step
  if (next >= max) return 0
  if (next < 0) return Math.floor((max - 1) / step) * step
  return next
}

/**
 * Apply step-snapping to hour/minute/second parts based on the focused segment.
 * Returns the new parts if snapping applies, or null if React Aria's default
 * ±1 behavior should be used.
 */
export function snapTimeParts(
  current: TimeParts,
  segmentType: string | null,
  step: number,
  up: boolean
): TimeParts | null {
  if (segmentType === "minute" && step % 60 === 0) {
    const stepMins = step / 60
    if (stepMins <= 1) return null
    const totalMins = current.hour * 60 + current.minute
    const wrapped = snapTimeStep(totalMins, stepMins, up, 1440)
    return {
      hour: Math.floor(wrapped / 60),
      minute: wrapped % 60,
      second: 0,
    }
  }

  if (segmentType === "hour" && step % 3600 === 0) {
    const stepHours = step / 3600
    if (stepHours <= 1) return null
    const wrapped = snapTimeStep(current.hour, stepHours, up, 24)
    return { hour: wrapped, minute: 0, second: 0 }
  }

  if (step % 60 !== 0 && step > 1) {
    if (
      segmentType !== "hour" &&
      segmentType !== "minute" &&
      segmentType !== "second"
    ) {
      return null
    }

    const totalSecs =
      current.hour * 3600 + current.minute * 60 + current.second

    let next: number
    if (segmentType === "second") {
      // Use snapTimeStep so overflow lands on midnight and underflow on the
      // last in-day step boundary — modulo wrap loses alignment when step
      // does not divide 86400 (e.g. step=7).
      next = snapTimeStep(totalSecs, step, up, 86400)
    } else {
      // For hour/minute segments, find the next step boundary at least one
      // segment-unit away so the displayed segment visibly changes. Modulo
      // wrap preserves that offset across midnight (e.g. 23:30 + hour with
      // step=30 → 00:30); collapsing to 00:00 would drop minutes/seconds.
      const jumpSize = segmentType === "hour" ? 3600 : 60
      next = up
        ? Math.ceil((totalSecs + jumpSize) / step) * step
        : Math.floor((totalSecs - jumpSize) / step) * step
      next = ((next % 86400) + 86400) % 86400
    }

    return {
      hour: Math.floor(next / 3600),
      minute: Math.floor((next % 3600) / 60),
      second: next % 60,
    }
  }

  return null
}

/**
 * Whether `step` is not a whole number of minutes, so the widget shows a
 * seconds segment and sends seconds.
 */
export function stepIncludesSeconds(step: number): boolean {
  return step % 60 !== 0
}
