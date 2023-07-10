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

import { useIsOverflowing } from "./Hooks"

const stateSetters: Array<any> = []

jest.mock("react", () => ({
  __esModule: true,
  ...jest.requireActual("react"),
  useEffect: jest.fn().mockImplementation(cb => cb()),
  useState: jest.fn().mockImplementation(() => {
    const setValue = jest.fn()
    stateSetters.push(setValue)

    return [false, setValue]
  }),
}))

// NOTE: We can't test the return value of useIsOverflowing directly because
// it won't have changed in a single run of the function. This is why we just
// check that the state setter was called.
describe("useIsOverflowing", () => {
  it("sets state to true if the element is overflowing", () => {
    const ref = { current: { scrollHeight: 1, clientHeight: 0 } }
    // @ts-expect-error
    useIsOverflowing(ref)

    const setIsOverflowing = stateSetters.pop()
    expect(setIsOverflowing).toHaveBeenCalledWith(true)
  })

  it("sets state to false if the element is not overflowing", () => {
    const ref = { current: { scrollHeight: 1, clientHeight: 1 } }
    // @ts-expect-error
    useIsOverflowing(ref)

    const setIsOverflowing = stateSetters.pop()
    expect(setIsOverflowing).toHaveBeenCalledWith(false)
  })
})
