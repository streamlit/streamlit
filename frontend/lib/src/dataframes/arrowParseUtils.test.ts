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

import { parseHeaderName } from "./arrowParseUtils"

describe("parseHeaderName", () => {
  it("returns a single-level header unchanged", () => {
    expect(parseHeaderName("foo", 1)).toEqual(["foo"])
  })

  it("splits a stringified MultiIndex tuple", () => {
    expect(parseHeaderName("('1','red')", 2)).toEqual(["1", "red"])
  })

  it("stringifies non-string tuple levels", () => {
    expect(parseHeaderName("(1,'red')", 2)).toEqual(["1", "red"])
  })

  it("pads a non-tuple multi-level header", () => {
    expect(parseHeaderName("5", 2)).toEqual(["", "5"])
  })

  it("pads a multi-level header that is not valid JSON", () => {
    expect(parseHeaderName("foo", 2)).toEqual(["", "foo"])
  })
})
