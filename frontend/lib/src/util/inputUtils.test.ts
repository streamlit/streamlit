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

import { isEnterKeyPressed } from "./inputUtils"

describe("inputUtils", () => {
  it("isEnterKeyPressed should return true when Enter is pressed", () => {
    const event = {
      key: "Enter",
      keyCode: 0,
      nativeEvent: undefined as never,
    }
    expect(isEnterKeyPressed(event)).toBe(true)
  })
  it("isEnterKeyPressed should return true when keyCode is 13", () => {
    const event = {
      key: "SomeKey",
      keyCode: 13,
      nativeEvent: undefined as never,
    }
    expect(isEnterKeyPressed(event)).toBe(true)
  })
  it("isEnterKeyPressed should return true when keyCode is 10", () => {
    const event = {
      key: "SomeKey",
      keyCode: 10,
      nativeEvent: undefined as never,
    }
    expect(isEnterKeyPressed(event)).toBe(true)
  })
  it("isEnterKeyPressed should return false when key is not Enter and keycode is not an enter code", () => {
    const event = {
      key: "SomeKey",
      keyCode: 9,
      nativeEvent: undefined as never,
    }
    expect(isEnterKeyPressed(event)).toBe(false)
  })
})
