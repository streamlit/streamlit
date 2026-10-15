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

/**
 * React Aria only lands on `min + n * step`. When `max` is just past the last
 * step — the default time slider is 1µs short of 24:00 — the track end is that
 * next step, and the value is mapped back to `max`. The extra distance has to
 * stay a small fraction of the span so the existing steps do not move.
 */

/** Extra track length, as a fraction of the span, that still keeps ticks put. */
const MAX_TRACK_STRETCH = 0.01

/** A few ULPs. A fraction of `step` would treat the 1µs gap before `time.max` as aligned. */
const ULP_TOLERANCE = 16

/** True when `a` and `b` match within a few ULPs at their magnitude. */
export function sliderValuesEqual(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b))
  const tolerance = scale * Number.EPSILON * ULP_TOLERANCE
  return Math.abs(a - b) <= tolerance
}

/**
 * Digit count React Aria uses for `step`.
 * Decimal steps count the decimal point (`"0.1"` → 2). Integer steps use 0.
 */
function stepPrecision(step: number): number {
  const stepString = step.toString()
  const exponentIndex = stepString.toLowerCase().indexOf("e-")
  if (exponentIndex > 0) {
    return Math.abs(Math.floor(Math.log10(Math.abs(step)))) + exponentIndex
  }
  const pointIndex = stepString.indexOf(".")
  return pointIndex >= 0 ? stepString.length - pointIndex : 0
}

/** Round `value` with React Aria's step precision so on-grid values compare equal. */
function roundToStepPrecision(value: number, step: number): number {
  const precision = stepPrecision(step)
  if (precision === 0) {
    return value
  }
  const pow = 10 ** precision
  return Math.round(value * pow) / pow
}

/**
 * Largest `min + n * step` still at or below `max`.
 * The quotient is rounded before flooring, matching React Aria, so `0..1`
 * step `0.1` stays aligned.
 */
function lastInRangeStep(min: number, max: number, step: number): number {
  const steps = Math.floor(roundToStepPrecision((max - min) / step, step))
  return roundToStepPrecision(min + Math.max(0, steps) * step, step)
}

/**
 * Max passed to the slider track.
 * Returns `max` when it is already on the grid, or when reaching it would
 * stretch the track enough to move the existing steps.
 */
export function sliderTrackMax(
  min: number,
  max: number,
  step: number
): number {
  if (
    !(step > 0) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    !(max > min)
  ) {
    return max
  }

  const lastStep = lastInRangeStep(min, max, step)
  if (sliderValuesEqual(lastStep, max) || lastStep > max) {
    return max
  }

  const trackMax = roundToStepPrecision(lastStep + step, step)
  const stretch = (trackMax - max) / (max - min)
  if (!(trackMax > max) || stretch > MAX_TRACK_STRETCH) {
    return max
  }
  return trackMax
}

/**
 * Value to show on the track for a committed value. `max` sits on the track end.
 *
 * Compare the endpoint with `>` / exact steps, not ULP equality. Around year
 * 2000 a microsecond timestamp is only 1 ULP apart from the next one, so a
 * tolerance would treat `time.max` and 24:00 as the same number.
 */
export function toTrackValue(
  value: number,
  max: number,
  trackMax: number
): number {
  if (trackMax === max) {
    return value
  }
  return value >= max ? trackMax : value
}

/** Committed value for a track position. The track end is reported as `max`. */
export function fromTrackValue(
  value: number,
  max: number,
  trackMax: number
): number {
  if (trackMax === max) {
    return value
  }
  if (value >= trackMax || value > max) {
    return max
  }
  return value
}
