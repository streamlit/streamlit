/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { formatTime } from "./utils"

describe("formatTime", () => {
  it.each([
    [0, "(0.0 seconds)"],
    [1.5, "(1.5 seconds)"],
    [45.2, "(45.2 seconds)"],
    [60, "(1 minute)"],
    [61.5, "(1 minute, 1.5 seconds)"],
    [122.2, "(2 minutes, 2.2 seconds)"],
    [3600, "(1 hour)"],
    [3660, "(1 hour, 1 minute)"],
    [3661.5, "(1 hour, 1 minute, 1.5 seconds)"],
    [7384.2, "(2 hours, 3 minutes, 4.2 seconds)"],
  ])("formats %s to %s", (value, expected) => {
    expect(formatTime(value)).toEqual(expected)
  })
})
