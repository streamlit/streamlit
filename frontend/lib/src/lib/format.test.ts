/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import moment from "moment"
import * as format from "./format"

test("class Duration constructor", () => {
  const duration = new format.Duration(1234)
  expect(duration.getTime()).toBe(1234)
})

test("class toFormattedString function with exponential notation", () => {
  expect(format.toFormattedString(4.2e-9)).toBe("0.0000")
  // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
  expect(format.toFormattedString(4.2657457627118644e-9)).toBe("0.0000")
})

describe("Format", () => {
  it("correctly checks if iso8601 contains timezone", () => {
    expect(
      format.Format.iso8601ContainsTimezone("2021-02-16T12:57:37.946398")
    ).toBeFalsy()

    const withTimezones = [
      "2021-02-16T13:03:07.531364-08:00",
      "2021-02-16T13:03:07.531364+08:00",
      "2021-02-16T13:03:07.531364-0800",
      "2021-02-16T13:03:07.531364+0800",
      "2021-02-16T13:03:07.531364-08",
      "2021-02-16T13:03:07.531364+08",
      "2021-02-16T13:03:07.531364Z",
    ]

    withTimezones.forEach(iso => {
      expect(format.Format.iso8601ContainsTimezone(iso)).toBeTruthy()
    })
  })

  it("correctly parses iso8601 without timezone", () => {
    const iso = "2021-02-16T12:57:37.946398"
    const got = format.Format.iso8601ToMoment(iso)
    const want = moment(iso)
    expect(want.isSame(got)).toBeTruthy()
  })

  it("correctly parses iso8601 with timezone", () => {
    const iso = "2021-02-16T13:03:07.531364-08:00"
    const got = format.Format.iso8601ToMoment(iso)
    const want = moment.parseZone(iso)
    expect(want.isSame(got)).toBeTruthy()
  })
})
