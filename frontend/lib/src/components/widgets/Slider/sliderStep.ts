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
 * React Aria only stops on `min + n * step`. When `max` sits just past the
 * last step, the track extends to the next step and the slider stores that
 * end position as `max`. A longer extension would move the existing steps.
 * The default time slider is 1µs short of 24:00.
 */

/** Largest extra track length, as a fraction of the span, before existing steps shift too far. */
const MAX_TRACK_STRETCH = 0.01

/**
 * Units in the last place that still count as on the step grid.
 * Float math can leave `max` a few ULPs past the last step, as with
 * `0.1 * 3`. A fraction of `step` is much coarser than that error.
 */
const ULP_TOLERANCE = 16

/** True when `a` and `b` differ by only a few units in the last place. */
function sliderValuesEqual(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b))
  const tolerance = scale * Number.EPSILON * ULP_TOLERANCE
  return Math.abs(a - b) <= tolerance
}

/**
 * Precision React Aria uses for `step`.
 * Decimal steps count the decimal point (`"0.1"` → 2). Integer steps use 0.
 * Exponential steps add the `"e-"` index to the exponent (`"1e-7"` → 8).
 */
function stepPrecision(step: number): number {
  const stepString = step.toString()
  const exponentIndex = stepString.toLowerCase().indexOf("e-")
  if (exponentIndex > 0) {
    const exponent = Math.floor(Math.log10(Math.abs(step)))
    return Math.abs(exponent) + exponentIndex
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
  return roundToStepPrecision(min + steps * step, step)
}

/**
 * Upper bound of the slider track.
 * Returns `max` when it is already on the grid, or when the next step would
 * move the existing steps.
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
  if (trackMax > max && stretch <= MAX_TRACK_STRETCH) {
    return trackMax
  }
  return max
}

/**
 * Track position for a committed value. `max` is drawn at the track end.
 *
 * Compares with `>=`, not ULP equality. Around year 2000 a microsecond is
 * only a few ULPs, so a tolerance would treat `time.max` and 24:00 as the
 * same value.
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

/** Committed value for a track position. The slider stores the track end as `max`. */
export function fromTrackValue(
  value: number,
  max: number,
  trackMax: number
): number {
  if (trackMax === max) {
    return value
  }
  if (value > max) {
    return max
  }
  return value
}
