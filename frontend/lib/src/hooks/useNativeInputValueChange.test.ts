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

import useNativeInputValueChange from "./useNativeInputValueChange"

describe("useNativeInputValueChange", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("forwards deferred native input events when DOM value differs", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const inputRef = {
      current: document.createElement("input"),
    }

    renderHook(() =>
      useNativeInputValueChange({
        inputRef,
        disabled: false,
        uiValue: "",
        onChange,
      })
    )

    inputRef.current.value = "autofilled@example.com"

    act(() => {
      inputRef.current.dispatchEvent(new Event("input", { bubbles: false }))
    })

    expect(onChange).not.toHaveBeenCalled()
    act(() => {
      vi.runAllTimers()
    })

    expect(onChange).toHaveBeenCalledWith({
      target: { value: "autofilled@example.com" },
    })
  })

  it("forwards deferred native change events when DOM value differs", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const inputRef = {
      current: document.createElement("input"),
    }

    renderHook(() =>
      useNativeInputValueChange({
        inputRef,
        disabled: false,
        uiValue: "",
        onChange,
      })
    )

    inputRef.current.value = "changed@example.com"

    act(() => {
      inputRef.current.dispatchEvent(new Event("change", { bubbles: false }))
    })

    expect(onChange).not.toHaveBeenCalled()
    act(() => {
      vi.runAllTimers()
    })

    expect(onChange).toHaveBeenCalledWith({
      target: { value: "changed@example.com" },
    })
  })

  it("rejects deferred native values that exceed maxChars", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const inputRef = {
      current: document.createElement("input"),
    }

    renderHook(() =>
      useNativeInputValueChange({
        inputRef,
        disabled: false,
        uiValue: "",
        maxChars: 3,
        onChange,
      })
    )

    inputRef.current.value = "TOOLONG"

    act(() => {
      inputRef.current.dispatchEvent(new Event("input", { bubbles: false }))
      vi.runAllTimers()
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(inputRef.current).toHaveValue("")
  })

  it("does not double-process bubbling events already handled by React", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const inputRef = {
      current: document.createElement("input"),
    }

    const { rerender } = renderHook(
      ({ uiValue }: { uiValue: string | null }) =>
        useNativeInputValueChange({
          inputRef,
          disabled: false,
          uiValue,
          onChange,
        }),
      {
        initialProps: { uiValue: "" },
      }
    )

    inputRef.current.value = "same-value"

    act(() => {
      inputRef.current.dispatchEvent(new Event("input", { bubbles: true }))
    })
    rerender({ uiValue: "same-value" })
    act(() => {
      vi.runAllTimers()
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not attach listeners when disabled", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const inputRef = {
      current: document.createElement("input"),
    }

    renderHook(() =>
      useNativeInputValueChange({
        inputRef,
        disabled: true,
        uiValue: "",
        onChange,
      })
    )

    inputRef.current.value = "autofilled@example.com"

    act(() => {
      inputRef.current.dispatchEvent(new Event("input"))
      inputRef.current.dispatchEvent(new Event("change"))
      vi.runAllTimers()
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not re-register native listeners on rerender", () => {
    const inputRef = {
      current: document.createElement("input"),
    }
    const addEventListenerSpy = vi.spyOn(inputRef.current, "addEventListener")
    const removeEventListenerSpy = vi.spyOn(
      inputRef.current,
      "removeEventListener"
    )
    const onChange = vi.fn()

    const { rerender, unmount } = renderHook(
      ({ uiValue }: { uiValue: string | null }) =>
        useNativeInputValueChange({
          inputRef,
          disabled: false,
          uiValue,
          onChange,
        }),
      {
        initialProps: { uiValue: "" },
      }
    )

    rerender({ uiValue: "a" })
    rerender({ uiValue: "ab" })
    rerender({ uiValue: "abc" })

    const nativeEventTypes = new Set(["input", "change"])
    const addCallsForInput = addEventListenerSpy.mock.calls.filter(call =>
      nativeEventTypes.has(String(call[0]))
    )
    const removeCallsForInput = removeEventListenerSpy.mock.calls.filter(
      call => nativeEventTypes.has(String(call[0]))
    )

    expect(addCallsForInput).toHaveLength(2)
    expect(removeCallsForInput).toHaveLength(0)

    unmount()

    const removeCallsAfterUnmount = removeEventListenerSpy.mock.calls.filter(
      call => nativeEventTypes.has(String(call[0]))
    )
    expect(removeCallsAfterUnmount).toHaveLength(2)
  })

  it("uses latest onChange callback for deferred reconciliation", () => {
    vi.useFakeTimers()
    const inputRef = {
      current: document.createElement("input"),
    }
    const firstOnChange = vi.fn()
    const secondOnChange = vi.fn()

    const { rerender } = renderHook(
      ({
        onChange,
      }: {
        onChange: (event: { target: { value: string } }) => void
      }) =>
        useNativeInputValueChange({
          inputRef,
          disabled: false,
          uiValue: "",
          onChange,
        }),
      {
        initialProps: { onChange: firstOnChange },
      }
    )

    rerender({ onChange: secondOnChange })
    inputRef.current.value = "latest-value"

    act(() => {
      inputRef.current.dispatchEvent(new Event("input", { bubbles: false }))
      vi.runAllTimers()
    })

    expect(firstOnChange).not.toHaveBeenCalled()
    expect(secondOnChange).toHaveBeenCalledWith({
      target: { value: "latest-value" },
    })
  })

  it("clears pending deferred reconciliation on unmount", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const inputRef = {
      current: document.createElement("input"),
    }

    const { unmount } = renderHook(() =>
      useNativeInputValueChange({
        inputRef,
        disabled: false,
        uiValue: "",
        onChange,
      })
    )

    inputRef.current.value = "autofilled@example.com"
    act(() => {
      inputRef.current.dispatchEvent(new Event("input", { bubbles: false }))
    })

    unmount()
    act(() => {
      vi.runAllTimers()
    })

    expect(onChange).not.toHaveBeenCalled()
  })
})
