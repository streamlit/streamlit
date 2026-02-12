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

import useStringInputHandlers from "./useStringInputHandlers"

function getDefaultProps(
  overrides: Record<string, unknown> = {}
): Parameters<typeof useStringInputHandlers>[0] {
  return {
    inputRef: { current: document.createElement("input") },
    disabled: false,
    formId: "",
    maxChars: 0,
    uiValue: "",
    dirty: false,
    setDirty: vi.fn(),
    setUiValue: vi.fn(),
    setValueWithSource: vi.fn(),
    setFocused: vi.fn(),
    ...overrides,
  }
}

describe("useStringInputHandlers", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // -- commitWidgetValue ---------------------------------------------------

  describe("commitWidgetValue", () => {
    it("commits current ui value by default", () => {
      const props = getDefaultProps({ uiValue: "abc" })
      const { result } = renderHook(() => useStringInputHandlers(props))

      act(() => {
        result.current.commitWidgetValue()
      })

      expect(props.setDirty).toHaveBeenCalledWith(false)
      expect(props.setValueWithSource).toHaveBeenCalledWith({
        value: "abc",
        fromUi: true,
      })
      expect(props.setUiValue).not.toHaveBeenCalled()
      expect(props.setFocused).not.toHaveBeenCalled()
    })

    it("commits an explicit override value when provided", () => {
      const props = getDefaultProps({ uiValue: "abc" })
      const { result } = renderHook(() => useStringInputHandlers(props))

      act(() => {
        result.current.commitWidgetValue("override")
      })

      expect(props.setValueWithSource).toHaveBeenCalledWith({
        value: "override",
        fromUi: true,
      })
    })
  })

  // -- onBlur reconciliation -----------------------------------------------

  describe("onBlur", () => {
    it.each([
      {
        dirty: false,
        domValue: "autofilled@example.com",
        uiValue: "",
        label: "not dirty",
      },
      {
        dirty: true,
        domValue: "autofilled-dom-value",
        uiValue: "typed-value",
        label: "dirty",
      },
    ])(
      "reconciles and commits DOM value on blur when $label and DOM diverges",
      ({ dirty, domValue, uiValue }) => {
        const inputRef = { current: document.createElement("input") }
        inputRef.current.value = domValue
        const props = getDefaultProps({ inputRef, uiValue, dirty })

        const { result } = renderHook(() => useStringInputHandlers(props))

        act(() => {
          result.current.onBlur()
        })

        // DOM value takes precedence because it's what the user actually sees.
        expect(props.setUiValue).toHaveBeenCalledWith(domValue)
        expect(props.setDirty).toHaveBeenCalledWith(false)
        expect(props.setValueWithSource).toHaveBeenCalledWith({
          value: domValue,
          fromUi: true,
        })
        expect(props.setFocused).toHaveBeenCalledWith(false)
      }
    )

    it("commits existing ui value on blur when dirty and DOM matches", () => {
      const inputRef = { current: document.createElement("input") }
      inputRef.current.value = "typed-value"
      const props = getDefaultProps({
        inputRef,
        uiValue: "typed-value",
        dirty: true,
      })

      const { result } = renderHook(() => useStringInputHandlers(props))

      act(() => {
        result.current.onBlur()
      })

      expect(props.setValueWithSource).toHaveBeenCalledWith({
        value: "typed-value",
        fromUi: true,
      })
      expect(props.setUiValue).not.toHaveBeenCalled()
      expect(props.setFocused).toHaveBeenCalledWith(false)
    })

    it("does not commit when not dirty and DOM matches ui value", () => {
      const inputRef = { current: document.createElement("input") }
      inputRef.current.value = "same"
      const props = getDefaultProps({
        inputRef,
        uiValue: "same",
        dirty: false,
      })

      const { result } = renderHook(() => useStringInputHandlers(props))

      act(() => {
        result.current.onBlur()
      })

      expect(props.setValueWithSource).not.toHaveBeenCalled()
      expect(props.setUiValue).not.toHaveBeenCalled()
      expect(props.setDirty).not.toHaveBeenCalled()
      expect(props.setFocused).toHaveBeenCalledWith(false)
    })

    it("does not reconcile when DOM value exceeds maxChars", () => {
      const inputRef = { current: document.createElement("input") }
      inputRef.current.value = "12345"
      const props = getDefaultProps({
        inputRef,
        uiValue: "",
        dirty: false,
        maxChars: 3,
      })

      const { result } = renderHook(() => useStringInputHandlers(props))

      act(() => {
        result.current.onBlur()
      })

      expect(props.setUiValue).not.toHaveBeenCalled()
      expect(props.setValueWithSource).not.toHaveBeenCalled()
      expect(props.setDirty).not.toHaveBeenCalled()
      expect(props.setFocused).toHaveBeenCalledWith(false)
      // DOM value should be restored to the controlled value so the user
      // doesn't see the rejected value lingering after blur.
      expect(inputRef.current).toHaveValue("")
    })

    it("commits dirty uiValue when DOM value exceeds maxChars", () => {
      const inputRef = { current: document.createElement("input") }
      inputRef.current.value = "toolong-injected"
      const props = getDefaultProps({
        inputRef,
        uiValue: "ok",
        dirty: true,
        maxChars: 5,
      })

      const { result } = renderHook(() => useStringInputHandlers(props))

      act(() => {
        result.current.onBlur()
      })

      // The over-limit DOM value should be rejected and restored.
      expect(inputRef.current).toHaveValue("ok")
      // But the pre-existing valid dirty uiValue should still be committed.
      expect(props.setDirty).toHaveBeenCalledWith(false)
      expect(props.setValueWithSource).toHaveBeenCalledWith({
        value: "ok",
        fromUi: true,
      })
      // The uiValue itself doesn't change — we commit the existing one.
      expect(props.setUiValue).not.toHaveBeenCalled()
      expect(props.setFocused).toHaveBeenCalledWith(false)
    })
  })

  // -- onFocus -------------------------------------------------------------

  describe("onFocus", () => {
    it("sets focused to true", () => {
      const props = getDefaultProps()
      const { result } = renderHook(() => useStringInputHandlers(props))

      act(() => {
        result.current.onFocus()
      })

      expect(props.setFocused).toHaveBeenCalledWith(true)
    })
  })

  // -- onChange (delegates to useOnInputChange) -----------------------------

  describe("onChange", () => {
    it("sets dirty and updates ui value on change", () => {
      const props = getDefaultProps()
      const { result } = renderHook(() => useStringInputHandlers(props))

      act(() => {
        result.current.onChange({ target: { value: "hello" } })
      })

      expect(props.setDirty).toHaveBeenCalledWith(true)
      expect(props.setUiValue).toHaveBeenCalledWith("hello")
    })

    it("rejects values exceeding maxChars", () => {
      const props = getDefaultProps({ maxChars: 3 })
      const { result } = renderHook(() => useStringInputHandlers(props))

      act(() => {
        result.current.onChange({ target: { value: "toolong" } })
      })

      expect(props.setDirty).not.toHaveBeenCalled()
      expect(props.setUiValue).not.toHaveBeenCalled()
    })

    it("immediately syncs to widget state in form mode", () => {
      const props = getDefaultProps({ formId: "myForm" })
      const { result } = renderHook(() => useStringInputHandlers(props))

      act(() => {
        result.current.onChange({ target: { value: "form-value" } })
      })

      expect(props.setDirty).toHaveBeenCalledWith(true)
      expect(props.setUiValue).toHaveBeenCalledWith("form-value")
      expect(props.setValueWithSource).toHaveBeenCalledWith({
        value: "form-value",
        fromUi: true,
      })
    })

    it("calls additionalOnChangeAction when provided", () => {
      const additionalOnChangeAction = vi.fn()
      const props = getDefaultProps({ additionalOnChangeAction })
      const { result } = renderHook(() => useStringInputHandlers(props))

      act(() => {
        result.current.onChange({ target: { value: "x" } })
      })

      expect(additionalOnChangeAction).toHaveBeenCalledTimes(1)
    })
  })

  // -- native DOM event bridging (integration) -----------------------------

  describe("native DOM event bridging", () => {
    it("forwards non-bubbling native input events through onChange", () => {
      const inputRef = { current: document.createElement("input") }
      const props = getDefaultProps({ inputRef })

      renderHook(() => useStringInputHandlers(props))

      inputRef.current.value = "autofilled@example.com"
      act(() => {
        inputRef.current.dispatchEvent(new Event("input", { bubbles: false }))
      })

      // Non-bubbling events are processed immediately.
      expect(props.setDirty).toHaveBeenCalledWith(true)
      expect(props.setUiValue).toHaveBeenCalledWith("autofilled@example.com")
    })

    it("does not attach native listeners when disabled", () => {
      vi.useFakeTimers()
      const inputRef = { current: document.createElement("input") }
      const props = getDefaultProps({ inputRef, disabled: true })

      renderHook(() => useStringInputHandlers(props))

      inputRef.current.value = "autofilled@example.com"
      act(() => {
        inputRef.current.dispatchEvent(new Event("input"))
        inputRef.current.dispatchEvent(new Event("change"))
        vi.runAllTimers()
      })

      expect(props.setDirty).not.toHaveBeenCalled()
    })

    it("rejects native values exceeding maxChars and restores DOM", () => {
      vi.useFakeTimers()
      const inputRef = { current: document.createElement("input") }
      const props = getDefaultProps({ inputRef, maxChars: 3 })

      renderHook(() => useStringInputHandlers(props))

      inputRef.current.value = "TOOLONG"
      act(() => {
        inputRef.current.dispatchEvent(new Event("input", { bubbles: false }))
        vi.runAllTimers()
      })

      expect(props.setDirty).not.toHaveBeenCalled()
      expect(inputRef.current).toHaveValue("")
    })

    it.each([
      { bubbles: false, label: "non-bubbling (immediate)" },
      { bubbles: true, label: "bubbling (deferred)" },
    ])(
      "commits value immediately on $label native input (non-form)",
      ({ bubbles }) => {
        vi.useFakeTimers()
        const inputRef = { current: document.createElement("input") }
        const props = getDefaultProps({ inputRef, formId: "" })

        renderHook(() => useStringInputHandlers(props))

        inputRef.current.value = "autofilled-password"
        act(() => {
          inputRef.current.dispatchEvent(new Event("input", { bubbles }))
        })
        act(() => {
          vi.runAllTimers()
        })

        // Native programmatic changes (e.g. password manager autofill) should
        // commit the value immediately — not just mark dirty and wait for blur.
        expect(props.setValueWithSource).toHaveBeenCalledWith({
          value: "autofilled-password",
          fromUi: true,
        })
      }
    )

    it("commits value when change event is handled by React onChange (non-form)", () => {
      vi.useFakeTimers()
      const inputRef = { current: document.createElement("input") }
      const setDirty = vi.fn()
      const setUiValue = vi.fn()
      const setValueWithSource = vi.fn()
      const setFocused = vi.fn()

      const { rerender } = renderHook(
        ({ uiValue }: { uiValue: string | null }) =>
          useStringInputHandlers({
            inputRef,
            disabled: false,
            formId: "",
            maxChars: 0,
            uiValue,
            dirty: false,
            setDirty,
            setUiValue,
            setValueWithSource,
            setFocused,
          }),
        {
          initialProps: { uiValue: "" },
        }
      )

      inputRef.current.value = "autofilled-password"
      act(() => {
        // Password managers dispatch both input and change events
        inputRef.current.dispatchEvent(new Event("input", { bubbles: true }))
      })
      // Simulate React having processed the onChange and updated uiValue
      rerender({ uiValue: "autofilled-password" })
      act(() => {
        // The change event signals a completed fill
        inputRef.current.dispatchEvent(new Event("change", { bubbles: true }))
      })
      act(() => {
        vi.runAllTimers()
      })

      // The value should be committed because a "change" event was dispatched,
      // indicating a completed value change (e.g. password manager fill).
      expect(setValueWithSource).toHaveBeenCalledWith({
        value: "autofilled-password",
        fromUi: true,
      })
    })
  })
})
