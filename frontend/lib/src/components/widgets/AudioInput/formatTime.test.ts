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

import { withTimezones } from "~lib/util/withTimezones"

import formatTime from "./formatTime"

withTimezones(() => {
  describe("formatTime", () => {
    // Test cases for seconds only (< 1 minute)
    it('should format 0 milliseconds as "00:00"', () => {
      expect(formatTime(0)).toBe("00:00")
    })

    it('should format 1000 milliseconds as "00:01"', () => {
      expect(formatTime(1000)).toBe("00:01")
    })

    it('should format 59000 milliseconds as "00:59"', () => {
      expect(formatTime(59000)).toBe("00:59")
    })

    // Test cases for minutes and seconds (< 1 hour)
    it('should format 60000 milliseconds as "01:00"', () => {
      expect(formatTime(60000)).toBe("01:00")
    })

    it('should format 90000 milliseconds as "01:30"', () => {
      expect(formatTime(90000)).toBe("01:30")
    })

    it('should format 3540000 milliseconds as "59:00"', () => {
      expect(formatTime(3540000)).toBe("59:00")
    })

    // Test cases for hours, minutes and seconds (>= 1 hour)
    it('should format 3600000 milliseconds as "01:00:00"', () => {
      expect(formatTime(3600000)).toBe("01:00:00")
    })

    it('should format 3660000 milliseconds as "01:01:00"', () => {
      expect(formatTime(3660000)).toBe("01:01:00")
    })

    it('should format 7200000 milliseconds as "02:00:00"', () => {
      expect(formatTime(7200000)).toBe("02:00:00")
    })
  })
})
