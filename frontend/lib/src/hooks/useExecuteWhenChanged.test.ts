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

import { renderHook } from "@testing-library/react"
import { vi } from "vitest"

import {
  arrayComparator,
  useExecuteWhenChanged,
} from "./useExecuteWhenChanged"

describe("#useExecuteWhenChanged", () => {
  it("should not call the callback when the value is the same", () => {
    const callback = vi.fn()
    const { rerender } = renderHook(
      ({ value }) => useExecuteWhenChanged(() => callback(value), [value]),
      { initialProps: { value: 1 } }
    )

    expect(callback).not.toHaveBeenCalled()

    rerender({ value: 1 })
    rerender({ value: 1 })

    expect(callback).not.toHaveBeenCalled()
  })

  it("should execute the callback when the value changes", () => {
    const callback = vi.fn()
    const { rerender } = renderHook(
      ({ value }) => useExecuteWhenChanged(() => callback(value), [value]),
      { initialProps: { value: 1 } }
    )

    // Initial render should not call the callback
    expect(callback).not.toHaveBeenCalled()

    // Rerender with the same value should not call the callback again
    callback.mockClear()
    rerender({ value: 1 })
    expect(callback).not.toHaveBeenCalled()

    // Rerender with a different value should call the callback
    callback.mockClear()
    rerender({ value: 2 })
    expect(callback).toHaveBeenCalledWith(2)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should handle stabilized objects as expected", () => {
    const callback = vi.fn()
    const value = { id: 1, name: "test" }
    const { rerender } = renderHook(
      ({ value }) => useExecuteWhenChanged(() => callback(value), [value]),
      { initialProps: { value } }
    )

    expect(callback).not.toHaveBeenCalled()

    rerender({ value })

    expect(callback).not.toHaveBeenCalled()
  })

  it("should use custom comparator when provided", () => {
    const callback = vi.fn()
    const customComparator = vi.fn(([prev], [curr]) => prev === curr)

    const { rerender } = renderHook(
      ({ value }) =>
        useExecuteWhenChanged(
          () => callback(value),
          [value],
          customComparator
        ),
      { initialProps: { value: "test value" } }
    )

    // Initial render should not call the callback
    expect(callback).not.toHaveBeenCalled()
    // Expect the custom comparator to have been called
    expect(customComparator).toHaveBeenCalledTimes(1)

    // Rerender with new value
    rerender({ value: "updated" })

    // The custom comparator should have been called 2 more times because the
    // value has changed. On the first re-render, the comparator is called with
    // the initial value and the new value. The callback is called on this run,
    // which sets state. On the second re-render, the comparator is called again
    // with the previous value and the new value. The callback is not called
    // again because the value has not changed.
    expect(customComparator).toHaveBeenCalledTimes(3)
    // The callback should have been called only once because the value has changed
    expect(callback).toHaveBeenCalledTimes(1)
  })

  describe("#arrayComparator", () => {
    it.each([
      {
        a: [1, 2, 3],
        b: [1, 2, 3],
        expected: true,
        description: "identical primitive arrays",
      },
      {
        a: [1, 2, 3],
        b: [1, 2, 4],
        expected: false,
        description: "different primitive arrays",
      },
      {
        a: [],
        b: [],
        expected: true,
        description: "empty arrays",
      },
      {
        a: [1],
        b: [1, 2],
        expected: false,
        description: "different length arrays",
      },
      {
        a: [null, undefined],
        b: [null, undefined],
        expected: true,
        description: "arrays with null and undefined",
      },
      {
        a: [null],
        b: [undefined],
        expected: false,
        description: "null vs undefined",
      },
      {
        a: [NaN],
        b: [NaN],
        expected: true,
        description: "arrays with NaN",
      },
      {
        a: [NaN, 1],
        b: [NaN, 1],
        expected: true,
        description: "arrays with NaN and numbers",
      },
    ])("should return $expected for $description", ({ a, b, expected }) => {
      expect(arrayComparator(a, b)).toBe(expected)
    })

    it("should handle arrays with object references correctly", () => {
      const obj1 = { id: 1 }
      const obj2 = { id: 2 }

      // Same object references should be equal
      expect(arrayComparator([obj1, obj2], [obj1, obj2])).toBe(true)

      // Different object references with same content should be different
      expect(arrayComparator([obj1, obj2], [obj1, { id: 2 }])).toBe(false)
      expect(arrayComparator([{ id: 1 }], [{ id: 1 }])).toBe(false)
    })

    it("should handle nested arrays", () => {
      const inner = [2, 3]

      // Same nested array references should be equal
      expect(arrayComparator([1, inner], [1, inner])).toBe(true)

      // Different nested array references should be different
      expect(arrayComparator([1, [2, 3]], [1, [2, 3]])).toBe(false)
      expect(arrayComparator([1, [2, 3]], [1, [2, 4]])).toBe(false)
    })
  })
})
