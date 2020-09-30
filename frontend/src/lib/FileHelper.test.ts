/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { BYTE_CONVERSION_SIZE, getSizeDisplay } from "./FileHelper"

describe("getSizeDisplay", () => {
  beforeEach(() => {})

  afterEach(() => {})

  test("shows unit", async () => {
    expect(getSizeDisplay(1024, "b")).toEqual("1.0KB")
    expect(getSizeDisplay(1024 * 1024, "b")).toEqual("1.0MB")
    expect(getSizeDisplay(1024 * 1024 * 1024, "b")).toEqual("1.0GB")

    expect(getSizeDisplay(10, "gb")).toEqual("10.0GB")
    expect(getSizeDisplay(1024, "mb")).toEqual("1.0GB")
  })

  test("unusual values", async () => {
    expect(() => getSizeDisplay(-100, "b")).toThrow(
      "Size must be greater than or equal to 0"
    )
    expect(getSizeDisplay(0, "")).toEqual("0.0B")
    expect(getSizeDisplay(0, "b", -1)).toEqual("0B")
  })

  test("rounding truncation", async () => {
    expect(getSizeDisplay(1024, "b")).toEqual("1.0KB")
    expect(getSizeDisplay(1024, "b", 0)).toEqual("1KB")
    expect(getSizeDisplay(1024, "b", 3)).toEqual("1.000KB")
  })

  test("rounding up unit", async () => {
    expect(getSizeDisplay(500, "b")).toEqual("500.0B")
    expect(getSizeDisplay(800, "b")).toEqual("0.8KB")
    expect(getSizeDisplay(501, "gb")).toEqual("501.0GB")
  })
})
