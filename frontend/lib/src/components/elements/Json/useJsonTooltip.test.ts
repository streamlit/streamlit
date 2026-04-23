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

import { act, renderHook } from "@testing-library/react"

import { formatJsonPath, useJsonTooltip } from "./useJsonTooltip"

describe("formatJsonPath", () => {
  it.each<{ namespace: Array<string | null>; expected: string }>([
    // Empty namespace
    { namespace: [], expected: "$" },
    // Simple object key
    { namespace: ["foo"], expected: "foo" },
    // Nested object keys with dot notation
    { namespace: ["foo", "bar", "baz"], expected: "foo.bar.baz" },
    // Array indices with bracket notation
    { namespace: ["items", "0"], expected: "items[0]" },
    { namespace: ["data", "123"], expected: "data[123]" },
    // Keys with special characters using bracket notation
    { namespace: ["foo-bar"], expected: '["foo-bar"]' },
    { namespace: ["foo.bar"], expected: '["foo.bar"]' },
    { namespace: ["foo bar"], expected: '["foo bar"]' },
    // Keys starting with numbers using bracket notation
    { namespace: ["0foo"], expected: '["0foo"]' },
    { namespace: ["123abc"], expected: '["123abc"]' },
    // Mixed paths with objects, arrays, and special keys
    {
      namespace: ["data", "items", "0", "name"],
      expected: "data.items[0].name",
    },
    {
      namespace: ["root", "special-key", "0", "value"],
      expected: 'root["special-key"][0].value',
    },
    // Null values in namespace are skipped
    { namespace: [null], expected: "" },
    { namespace: ["foo", null, "bar"], expected: "foo.bar" },
    // Valid identifiers with underscore and dollar sign
    { namespace: ["_private", "$ref"], expected: "_private.$ref" },
    // Empty string keys use bracket notation
    { namespace: [""], expected: '[""]' },
    { namespace: ["foo", ""], expected: 'foo[""]' },
    { namespace: ["", "bar"], expected: '[""].bar' },
    // Keys with double quotes are escaped
    { namespace: ['foo"bar'], expected: '["foo\\"bar"]' },
    { namespace: ['a"b"c'], expected: '["a\\"b\\"c"]' },
    // Keys with backslashes are escaped
    { namespace: ["foo\\bar"], expected: '["foo\\\\bar"]' },
    { namespace: ["a\\b\\c"], expected: '["a\\\\b\\\\c"]' },
    // Keys with both quotes and backslashes
    { namespace: ['foo\\"bar'], expected: '["foo\\\\\\"bar"]' },
  ])("formats $namespace as $expected", ({ namespace, expected }) => {
    expect(formatJsonPath(namespace)).toBe(expected)
  })
})

describe("useJsonTooltip", () => {
  it("initializes with null tooltip", () => {
    const { result } = renderHook(() => useJsonTooltip())

    expect(result.current.tooltip).toBeNull()
  })

  it("sets up and cleans up mousedown listener", () => {
    const addEventListenerSpy = vi.spyOn(document, "addEventListener")
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener")

    const { unmount } = renderHook(() => useJsonTooltip())

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "mousedown",
      expect.any(Function)
    )

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "mousedown",
      expect.any(Function)
    )

    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it("updates tooltip state when handleSelect is called", () => {
    const { result } = renderHook(() => useJsonTooltip())

    // Simulate a mousedown to set the position
    act(() => {
      document.dispatchEvent(
        new MouseEvent("mousedown", { clientX: 100, clientY: 200 })
      )
    })

    // Call handleSelect with mock OnSelectProps
    act(() => {
      result.current.handleSelect({
        name: "value",
        namespace: ["root", "nested"],
        value: "test",
        type: "string",
      })
    })

    expect(result.current.tooltip).toEqual({
      path: "root.nested.value",
      x: 100,
      y: 200,
    })
  })

  it("clears tooltip when clearTooltip is called", () => {
    const { result } = renderHook(() => useJsonTooltip())

    // Set up tooltip
    act(() => {
      document.dispatchEvent(
        new MouseEvent("mousedown", { clientX: 50, clientY: 75 })
      )
    })

    act(() => {
      result.current.handleSelect({
        name: "key",
        namespace: ["obj"],
        value: "value",
        type: "string",
      })
    })

    expect(result.current.tooltip).not.toBeNull()

    // Clear tooltip
    act(() => {
      result.current.clearTooltip()
    })

    expect(result.current.tooltip).toBeNull()
  })

  it("tracks mouse position from mousedown events", () => {
    const { result } = renderHook(() => useJsonTooltip())

    // First mousedown
    act(() => {
      document.dispatchEvent(
        new MouseEvent("mousedown", { clientX: 10, clientY: 20 })
      )
    })

    act(() => {
      result.current.handleSelect({
        name: "a",
        namespace: [],
        value: 1,
        type: "number",
      })
    })

    expect(result.current.tooltip).toEqual({ path: "a", x: 10, y: 20 })

    // Clear and update with new position
    act(() => {
      result.current.clearTooltip()
    })

    act(() => {
      document.dispatchEvent(
        new MouseEvent("mousedown", { clientX: 300, clientY: 400 })
      )
    })

    act(() => {
      result.current.handleSelect({
        name: "b",
        namespace: [],
        value: 2,
        type: "number",
      })
    })

    expect(result.current.tooltip).toEqual({ path: "b", x: 300, y: 400 })
  })
})
