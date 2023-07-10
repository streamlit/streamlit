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

import { act, renderHook } from "@testing-library/react-hooks"
import useStateRef from "./useStateRef" // import the hook

describe("useStateRef hook", () => {
  it("should initialize correctly with initial state", () => {
    const { result } = renderHook(() => useStateRef(10))

    const [state, , stateRef] = result.current

    // Initial state is set correctly
    expect(state).toEqual(10)
    expect(stateRef.current).toEqual(10)
  })

  it("should set state correctly", () => {
    const { result } = renderHook(() => useStateRef(10))
    const [, setState, stateRef] = result.current

    act(() => {
      setState(20)
    })

    // State is updated
    const state = result.current[0]
    expect(state).toEqual(20)
    expect(stateRef.current).toEqual(20)
  })

  it("should handle function update correctly", () => {
    const { result } = renderHook(() => useStateRef(10))
    const [, setState, stateRef] = result.current

    act(() => {
      setState(prev => prev + 10)
    })

    // State is updated
    const state = result.current[0]
    expect(state).toEqual(20)
    expect(stateRef.current).toEqual(20)
  })

  it("should maintain reference correctly when state changes", () => {
    const { result } = renderHook(() => useStateRef(10))
    const [, setValue, initialRef] = result.current

    act(() => {
      setValue(20)
    })

    // Reference has not changed
    expect(result.current[2]).toBe(initialRef)
  })

  it("should allow ref to be set independently from state", () => {
    const { result } = renderHook(() => useStateRef(10))
    const [, setState, stateRef] = result.current

    act(() => {
      stateRef.current = 20
    })

    let state = result.current[0]
    expect(state).toEqual(10)
    expect(stateRef.current).toEqual(20)

    act(() => {
      setState(20)
    })

    // State is updated
    state = result.current[0]
    expect(state).toEqual(20)
    expect(stateRef.current).toEqual(20)
  })
})
