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

function createUiValueRef(initialValue: string | null = ""): {
  current: string | null
} {
  return { current: initialValue }
}

describe("useNativeInputValueChange", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each(["input", "change"] as const)(
    "forwards non-bubbling native %s events immediately when DOM value differs",
    eventType => {
      const onChange = vi.fn()
      const inputRef = {
        current: document.createElement("input"),
      }

      renderHook(() =>
        useNativeInputValueChange({
          inputRef,
          disabled: false,
          uiValueRef: createUiValueRef(""),
          onChange,
        })
      )

      inputRef.current.value = "autofilled@example.com"

      act(() => {
        inputRef.current.dispatchEvent(
          new Event(eventType, { bubbles: false })
        )
      })

      // Non-bubbling events are processed immediately (React won't see them).
      expect(onChange).toHaveBeenCalledWith({
        target: { value: "autofilled@example.com" },
      })
    }
  )

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
        uiValueRef: createUiValueRef(""),
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

  it("does not double-process onChange for bubbling events already handled by React", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const inputRef = {
      current: document.createElement("input"),
    }

    const uiValueRef = createUiValueRef("")
    renderHook(() =>
      useNativeInputValueChange({
        inputRef,
        disabled: false,
        uiValueRef,
        onChange,
      })
    )

    inputRef.current.value = "same-value"

    act(() => {
      inputRef.current.dispatchEvent(new Event("input", { bubbles: true }))
    })
    uiValueRef.current = "same-value"
    act(() => {
      vi.runAllTimers()
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it("calls onCommit for change events already handled by React onChange", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onCommit = vi.fn()
    const inputRef = {
      current: document.createElement("input"),
    }

    const uiValueRef = createUiValueRef("")
    renderHook(() =>
      useNativeInputValueChange({
        inputRef,
        disabled: false,
        uiValueRef,
        onChange,
        onCommit,
      })
    )

    inputRef.current.value = "autofilled-value"

    // Password managers typically dispatch both input and change events.
    // Simulate the input event being handled by React first.
    act(() => {
      inputRef.current.dispatchEvent(new Event("input", { bubbles: true }))
    })
    uiValueRef.current = "autofilled-value"

    // Then the change event arrives — this signals a completed fill.
    act(() => {
      inputRef.current.dispatchEvent(new Event("change", { bubbles: true }))
    })
    act(() => {
      vi.runAllTimers()
    })

    // onChange should NOT be double-called (React already handled it)
    expect(onChange).not.toHaveBeenCalled()
    // But onCommit SHOULD fire because a "change" event indicates a
    // completed value change (e.g. password manager fill)
    expect(onCommit).toHaveBeenCalledWith("autofilled-value")
  })

  it("does not call onCommit for input events already handled by React onChange", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onCommit = vi.fn()
    const inputRef = {
      current: document.createElement("input"),
    }

    const uiValueRef = createUiValueRef("")
    renderHook(() =>
      useNativeInputValueChange({
        inputRef,
        disabled: false,
        uiValueRef,
        onChange,
        onCommit,
      })
    )

    inputRef.current.value = "a"

    act(() => {
      // Only an "input" event (regular keystroke) — no "change" event
      inputRef.current.dispatchEvent(new Event("input", { bubbles: true }))
    })
    uiValueRef.current = "a"
    act(() => {
      vi.runAllTimers()
    })

    // Neither onChange nor onCommit should fire — React handled the input
    // event and the normal dirty→blur→commit flow applies for typing
    expect(onChange).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
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
        uiValueRef: createUiValueRef(""),
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

    const uiValueRef = createUiValueRef("")
    const { rerender, unmount } = renderHook(() =>
      useNativeInputValueChange({
        inputRef,
        disabled: false,
        uiValueRef,
        onChange,
      })
    )

    uiValueRef.current = "a"
    rerender()
    uiValueRef.current = "ab"
    rerender()
    uiValueRef.current = "abc"
    rerender()

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
          uiValueRef: createUiValueRef(""),
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

  it.each([
    { bubbles: false, label: "non-bubbling (immediate)" },
    { bubbles: true, label: "bubbling (deferred)" },
  ])(
    "calls onCommit after onChange for $label native events",
    ({ bubbles }) => {
      vi.useFakeTimers()
      const onChange = vi.fn()
      const onCommit = vi.fn()
      const inputRef = {
        current: document.createElement("input"),
      }

      renderHook(() =>
        useNativeInputValueChange({
          inputRef,
          disabled: false,
          uiValueRef: createUiValueRef(""),
          onChange,
          onCommit,
        })
      )

      inputRef.current.value = "autofilled@example.com"

      act(() => {
        inputRef.current.dispatchEvent(new Event("input", { bubbles }))
      })
      act(() => {
        vi.runAllTimers()
      })

      expect(onChange).toHaveBeenCalledWith({
        target: { value: "autofilled@example.com" },
      })
      expect(onCommit).toHaveBeenCalledWith("autofilled@example.com")
    }
  )

  it("does not call onCommit when value is rejected by maxChars", () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    const inputRef = {
      current: document.createElement("input"),
    }

    renderHook(() =>
      useNativeInputValueChange({
        inputRef,
        disabled: false,
        uiValueRef: createUiValueRef(""),
        maxChars: 3,
        onChange,
        onCommit,
      })
    )

    inputRef.current.value = "TOOLONG"

    act(() => {
      inputRef.current.dispatchEvent(new Event("input", { bubbles: false }))
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it("clears pending deferred reconciliation on unmount", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const inputRef = {
      current: document.createElement("input"),
    }

    const uiValueRef = createUiValueRef("")
    const { unmount } = renderHook(() =>
      useNativeInputValueChange({
        inputRef,
        disabled: false,
        uiValueRef,
        onChange,
      })
    )

    // Use a bubbling event so the handler defers via timeout (non-bubbling
    // events are processed immediately and cannot be cancelled by unmount).
    inputRef.current.value = "deferred-value"
    act(() => {
      inputRef.current.dispatchEvent(new Event("input", { bubbles: true }))
    })
    // Simulate React NOT updating uiValue (so the deferred check would fire).
    uiValueRef.current = ""

    unmount()
    act(() => {
      vi.runAllTimers()
    })

    expect(onChange).not.toHaveBeenCalled()
  })
})
