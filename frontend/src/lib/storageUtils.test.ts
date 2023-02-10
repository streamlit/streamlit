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

import { localStorageAvailable } from "./storageUtils"

describe("localStorageAvailable", () => {
  // NOTE: localStorage is weird, and calling .spyOn(window.localStorage, "setItem")
  // doesn't work. Accessing .__proto__ here isn't too bad of a crime since
  // it's test code.
  const breakLocalStorage = (): void => {
    jest
      // eslint-disable-next-line no-proto
      .spyOn(window.localStorage.__proto__, "setItem")
      .mockImplementation(() => {
        throw new Error("boom")
      })
  }

  afterEach(() => {
    jest.restoreAllMocks()
    window.localStorage.clear()
  })

  it("returns false if a localStorage function explodes", () => {
    breakLocalStorage()
    expect(localStorageAvailable()).toBe(false)
  })

  it("returns true if all localStorage functions work", () => {
    expect(localStorageAvailable()).toBe(true)
  })
})
