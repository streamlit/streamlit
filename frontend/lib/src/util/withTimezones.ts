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

// eslint-disable-next-line no-restricted-imports
import timezoneMock from "timezone-mock"

/**
 * Executes tests for many different timezones. This test harness is used to
 * ensure the expected behavior works in important and unique timezones.
 *
 * @param {function(string): void} fn - The describe/test block to be executed
 * in each timezone.
 */
export const withTimezones = (fn: (timezone: string) => void): void => {
  const TIMEZONES = [
    "UTC",
    "Australia/Adelaide",
    "Brazil/East",
    "Europe/London",
    "US/Eastern",
    "US/Pacific",
  ] as const

  describe.each(TIMEZONES)("with %s timezone", timezone => {
    beforeAll(() => {
      timezoneMock.register(timezone)
    })

    fn(timezone)

    afterAll(() => {
      timezoneMock.unregister()
    })
  })
}
