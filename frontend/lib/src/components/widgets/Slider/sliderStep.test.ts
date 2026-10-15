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

import { fromTrackValue, sliderTrackMax, toTrackValue } from "./sliderStep"

// time.min .. time.max with a 15-minute step. time.max is 1µs short of 96 steps.
const TIME_MIN = 0
const TIME_MAX = 86_399_999_999
const TIME_STEP = 900_000_000
const TIME_TRACK_MAX = 86_400_000_000
const TIME_23_45 = 85_500_000_000

describe("sliderStep", () => {
  it("extends a time slider track to the next step and maps it back to max", () => {
    expect(sliderTrackMax(TIME_MIN, TIME_MAX, TIME_STEP)).toBe(TIME_TRACK_MAX)
    expect(toTrackValue(TIME_MAX, TIME_MAX, TIME_TRACK_MAX)).toBe(
      TIME_TRACK_MAX
    )
    expect(fromTrackValue(TIME_TRACK_MAX, TIME_MAX, TIME_TRACK_MAX)).toBe(
      TIME_MAX
    )
    expect(fromTrackValue(TIME_23_45, TIME_MAX, TIME_TRACK_MAX)).toBe(
      TIME_23_45
    )
  })

  it("maps the track end back to time.max for a year-2000 timestamp", () => {
    // Microseconds since 2000-01-01. A 1µs gap is only a few ULPs here, so
    // the track end must not compare equal to time.max.
    const min = Date.UTC(2000, 0, 1) * 1000
    const max = min + TIME_MAX
    const trackMax = sliderTrackMax(min, max, TIME_STEP)
    expect(trackMax).toBe(min + TIME_TRACK_MAX)
    expect(trackMax).not.toBe(max)
    expect(fromTrackValue(trackMax, max, trackMax)).toBe(max)
    expect(toTrackValue(max, max, trackMax)).toBe(trackMax)
    expect(fromTrackValue(min + TIME_23_45, max, trackMax)).toBe(
      min + TIME_23_45
    )
  })

  it("maps time(23, 59) back from the same 24:00 track end", () => {
    const max = 86_340_000_000
    const trackMax = sliderTrackMax(TIME_MIN, max, TIME_STEP)
    expect(trackMax).toBe(TIME_TRACK_MAX)
    expect(fromTrackValue(trackMax, max, trackMax)).toBe(max)
    expect(toTrackValue(max, max, trackMax)).toBe(trackMax)
  })

  it("does not stretch a wide gap", () => {
    // 0..10 step 3 would move 9 from 90% of the track to 75%.
    expect(sliderTrackMax(0, 10, 3)).toBe(10)
    expect(fromTrackValue(9, 10, 10)).toBe(9)
    expect(toTrackValue(10, 10, 10)).toBe(10)
  })

  it("leaves a step-aligned span unchanged", () => {
    expect(sliderTrackMax(0, 10, 1)).toBe(10)
    expect(sliderTrackMax(0, 1, 0.1)).toBe(1)
  })

  it("does not stretch a max that is only a few ULPs past the last step", () => {
    // 0.1 * 3 lands just above 0.3. A 0.001 step is within 1% of that span,
    // so the track would extend to 0.301 without the tolerance.
    const max = 0.30000000000000004
    expect(max).not.toBe(0.3)
    expect(sliderTrackMax(0, max, 0.001)).toBe(max)
  })
})
