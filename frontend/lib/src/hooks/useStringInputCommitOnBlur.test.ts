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

import useStringInputCommitOnBlur from "./useStringInputCommitOnBlur"

describe("useStringInputCommitOnBlur", () => {
  it("commits current ui value by default", () => {
    const setDirty = vi.fn()
    const setUiValue = vi.fn()
    const setValueWithSource = vi.fn()
    const setFocused = vi.fn()
    const inputRef = { current: document.createElement("input") }

    const { result } = renderHook(() =>
      useStringInputCommitOnBlur({
        inputRef,
        uiValue: "abc",
        dirty: false,
        maxChars: 0,
        setDirty,
        setUiValue,
        setValueWithSource,
        setFocused,
      })
    )

    act(() => {
      result.current.commitWidgetValue()
    })

    expect(setDirty).toHaveBeenCalledWith(false)
    expect(setValueWithSource).toHaveBeenCalledWith({
      value: "abc",
      fromUi: true,
    })
    expect(setUiValue).not.toHaveBeenCalled()
    expect(setFocused).not.toHaveBeenCalled()
  })

  it("reconciles and commits DOM value on blur when not dirty", () => {
    const setDirty = vi.fn()
    const setUiValue = vi.fn()
    const setValueWithSource = vi.fn()
    const setFocused = vi.fn()
    const inputRef = { current: document.createElement("input") }
    inputRef.current.value = "autofilled@example.com"

    const { result } = renderHook(() =>
      useStringInputCommitOnBlur({
        inputRef,
        uiValue: "",
        dirty: false,
        maxChars: 0,
        setDirty,
        setUiValue,
        setValueWithSource,
        setFocused,
      })
    )

    act(() => {
      result.current.onBlur()
    })

    expect(setUiValue).toHaveBeenCalledWith("autofilled@example.com")
    expect(setDirty).toHaveBeenCalledWith(false)
    expect(setValueWithSource).toHaveBeenCalledWith({
      value: "autofilled@example.com",
      fromUi: true,
    })
    expect(setFocused).toHaveBeenCalledWith(false)
  })

  it("reconciles DOM value on blur even when dirty if DOM diverges", () => {
    const setDirty = vi.fn()
    const setUiValue = vi.fn()
    const setValueWithSource = vi.fn()
    const setFocused = vi.fn()
    const inputRef = { current: document.createElement("input") }
    // Simulate password manager overwriting the DOM after user typed.
    inputRef.current.value = "autofilled-dom-value"

    const { result } = renderHook(() =>
      useStringInputCommitOnBlur({
        inputRef,
        uiValue: "typed-value",
        dirty: true,
        maxChars: 0,
        setDirty,
        setUiValue,
        setValueWithSource,
        setFocused,
      })
    )

    act(() => {
      result.current.onBlur()
    })

    // DOM value takes precedence because it's what the user actually sees.
    expect(setUiValue).toHaveBeenCalledWith("autofilled-dom-value")
    expect(setValueWithSource).toHaveBeenCalledWith({
      value: "autofilled-dom-value",
      fromUi: true,
    })
    expect(setFocused).toHaveBeenCalledWith(false)
  })

  it("commits existing ui value on blur when dirty and DOM matches", () => {
    const setDirty = vi.fn()
    const setUiValue = vi.fn()
    const setValueWithSource = vi.fn()
    const setFocused = vi.fn()
    const inputRef = { current: document.createElement("input") }
    inputRef.current.value = "typed-value"

    const { result } = renderHook(() =>
      useStringInputCommitOnBlur({
        inputRef,
        uiValue: "typed-value",
        dirty: true,
        maxChars: 0,
        setDirty,
        setUiValue,
        setValueWithSource,
        setFocused,
      })
    )

    act(() => {
      result.current.onBlur()
    })

    expect(setValueWithSource).toHaveBeenCalledWith({
      value: "typed-value",
      fromUi: true,
    })
    expect(setUiValue).not.toHaveBeenCalled()
    expect(setFocused).toHaveBeenCalledWith(false)
  })

  it("does not reconcile when DOM value exceeds maxChars", () => {
    const setDirty = vi.fn()
    const setUiValue = vi.fn()
    const setValueWithSource = vi.fn()
    const setFocused = vi.fn()
    const inputRef = { current: document.createElement("input") }
    inputRef.current.value = "12345"

    const { result } = renderHook(() =>
      useStringInputCommitOnBlur({
        inputRef,
        uiValue: "",
        dirty: false,
        maxChars: 3,
        setDirty,
        setUiValue,
        setValueWithSource,
        setFocused,
      })
    )

    act(() => {
      result.current.onBlur()
    })

    expect(setUiValue).not.toHaveBeenCalled()
    expect(setValueWithSource).not.toHaveBeenCalled()
    expect(setDirty).not.toHaveBeenCalled()
    expect(setFocused).toHaveBeenCalledWith(false)
  })
})
