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

import { renderHook, waitFor } from "@testing-library/react"

import useOnInPutChange from "./useOnInputChange"

/**
 * Strings and their length in UTF-16 code units, which the browser counts as
 * `value.length` and the server as `widget_checks.utf16_length`. The same
 * strings are in `_MAX_CHARS_PARITY` in
 * lib/tests/streamlit/runtime/state/widget_checks_test.py, which checks the
 * server's count, and in `MAX_CHARS_PARITY` in ChatInput.test.tsx. Change all
 * three together.
 */
const MAX_CHARS_PARITY: [name: string, text: string, units: number][] = [
  ["ascii", "abcde", 5],
  // 漢字のテスト, in the Basic Multilingual Plane.
  ["cjk", "\u6f22\u5b57\u306e\u30c6\u30b9\u30c8", 6],
  // Three grinning faces, each a surrogate pair.
  ["astral_emoji", "\u{1F600}\u{1F600}\u{1F600}", 6],
  // "e" and a combining acute accent, twice.
  ["combining_marks", "e\u0301e\u0301", 4],
  // A family: woman, zero-width joiner, woman, zero-width joiner, girl.
  ["zwj_sequence", "\u{1F469}\u200D\u{1F469}\u200D\u{1F467}", 8],
  // The German flag, two regional indicator symbols.
  ["flag", "\u{1F1E9}\u{1F1EA}", 4],
  ["line_breaks", "a\nb\nc", 5],
  ["mixed", "a\u{1F600}e\u0301\n\u6f22", 7],
]

describe("useOnInputChange", () => {
  it.each(MAX_CHARS_PARITY)(
    "accepts %s text at maxChars and refuses it one unit past, as the server counts",
    (_name, text, units) => {
      expect(text.length).toBe(units)
      const accept = (maxChars: number): boolean => {
        const setUiValue = vi.fn()
        const { result: onInputChange } = renderHook(() =>
          useOnInPutChange({
            formId: undefined,
            maxChars,
            setDirty: vi.fn(),
            setUiValue,
            setValueWithSource: vi.fn(),
          })
        )
        onInputChange.current({ target: { value: text } })
        return setUiValue.mock.calls.some(([value]) => value === text)
      }

      expect(accept(units)).toBe(true)
      expect(accept(units - 1)).toBe(false)
    }
  )

  it("should call the setDirty, setUiValue, setValueWithSource callbacks because its in a form", async () => {
    const setDirtyCallback = vi.fn()
    const setUiValueCallback = vi.fn()
    const setValueWithSource = vi.fn()

    const { result: onInputChange } = renderHook(() =>
      useOnInPutChange({
        formId: "someFormId",
        maxChars: 0,
        setDirty: setDirtyCallback,
        setUiValue: setUiValueCallback,
        setValueWithSource,
      })
    )

    onInputChange.current({ target: { value: "someValue" } })

    await waitFor(() => {
      expect(setDirtyCallback).toHaveBeenCalledWith(true)
    })
    await waitFor(() => {
      expect(setUiValueCallback).toHaveBeenCalledWith("someValue")
    })
    await waitFor(() => {
      expect(setValueWithSource).toHaveBeenCalledWith({
        value: "someValue",
        fromUser: true,
      })
    })
  })
  it("should not call the setValueWithSource callback because it is not in a form", async () => {
    const setDirtyCallback = vi.fn()
    const setUiValueCallback = vi.fn()
    const setValueWithSource = vi.fn()

    const { result: onInPutChange } = renderHook(() =>
      useOnInPutChange({
        formId: undefined,
        maxChars: 0,
        setDirty: setDirtyCallback,
        setUiValue: setUiValueCallback,
        setValueWithSource,
      })
    )

    onInPutChange.current({ target: { value: "someValue" } })

    await waitFor(() => {
      expect(setDirtyCallback).toHaveBeenCalledWith(true)
    })
    await waitFor(() => {
      expect(setUiValueCallback).toHaveBeenCalledWith("someValue")
    })
    await waitFor(() => {
      expect(setValueWithSource).not.toHaveBeenCalled()
    })
  })

  it("should not call any callbacks if value exceeds maxChars", async () => {
    const setDirtyCallback = vi.fn()
    const setUiValueCallback = vi.fn()
    const setValueWithSource = vi.fn()

    const { result: onInputChange } = renderHook(() =>
      useOnInPutChange({
        formId: undefined,
        maxChars: 1,
        setDirty: setDirtyCallback,
        setUiValue: setUiValueCallback,
        setValueWithSource,
      })
    )

    onInputChange.current({ target: { value: "someValue" } })

    await waitFor(() => {
      expect(setDirtyCallback).not.toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(setUiValueCallback).not.toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(setValueWithSource).not.toHaveBeenCalled()
    })
  })

  it("should call an additional action after main logic", async () => {
    const setDirtyCallback = vi.fn()
    const setUiValueCallback = vi.fn()
    const setValueWithSource = vi.fn()
    const additionalAction = vi.fn()

    const { result: onInPutChange } = renderHook(() =>
      useOnInPutChange({
        formId: "someFormId",
        maxChars: 0,
        setDirty: setDirtyCallback,
        setUiValue: setUiValueCallback,
        setValueWithSource,
        additionalAction,
      })
    )

    onInPutChange.current({ target: { value: "someValue" } })

    await waitFor(() => {
      expect(setDirtyCallback).toHaveBeenCalledWith(true)
    })
    await waitFor(() => {
      expect(setUiValueCallback).toHaveBeenCalledWith("someValue")
    })
    await waitFor(() => {
      expect(setValueWithSource).toHaveBeenCalledWith({
        value: "someValue",
        fromUser: true,
      })
    })
    await waitFor(() => {
      expect(additionalAction).toHaveBeenCalledWith("someValue")
    })
  })

  it("should work without additional actions (default behavior)", async () => {
    const setDirtyCallback = vi.fn()
    const setUiValueCallback = vi.fn()
    const setValueWithSource = vi.fn()

    const { result: onInputChange } = renderHook(() =>
      useOnInPutChange({
        formId: undefined,
        maxChars: 0,
        setDirty: setDirtyCallback,
        setUiValue: setUiValueCallback,
        setValueWithSource,
      })
    )

    onInputChange.current({ target: { value: "someValue" } })

    await waitFor(() => {
      expect(setDirtyCallback).toHaveBeenCalledWith(true)
    })
    await waitFor(() => {
      expect(setUiValueCallback).toHaveBeenCalledWith("someValue")
    })
    // Should not call setValueWithSource since not in form
    await waitFor(() => {
      expect(setValueWithSource).not.toHaveBeenCalled()
    })
  })

  it("should not call additional actions if value exceeds maxChars", async () => {
    const setDirtyCallback = vi.fn()
    const setUiValueCallback = vi.fn()
    const setValueWithSource = vi.fn()
    const additionalAction = vi.fn()

    const { result: onInputChange } = renderHook(() =>
      useOnInPutChange({
        formId: undefined,
        maxChars: 1,
        setDirty: setDirtyCallback,
        setUiValue: setUiValueCallback,
        setValueWithSource,
        additionalAction: additionalAction,
      })
    )

    onInputChange.current({ target: { value: "someValue" } })

    await waitFor(() => {
      expect(setDirtyCallback).not.toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(setUiValueCallback).not.toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(setValueWithSource).not.toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(additionalAction).not.toHaveBeenCalled()
    })
  })

  it("should call additional actions even when not in form", async () => {
    const setDirtyCallback = vi.fn()
    const setUiValueCallback = vi.fn()
    const setValueWithSource = vi.fn()
    const additionalAction = vi.fn()

    const { result: onInputChange } = renderHook(() =>
      useOnInPutChange({
        formId: undefined, // Not in form
        maxChars: 0,
        setDirty: setDirtyCallback,
        setUiValue: setUiValueCallback,
        setValueWithSource,
        additionalAction: additionalAction,
      })
    )

    onInputChange.current({ target: { value: "someValue" } })

    await waitFor(() => {
      expect(setDirtyCallback).toHaveBeenCalledWith(true)
    })
    await waitFor(() => {
      expect(setUiValueCallback).toHaveBeenCalledWith("someValue")
    })
    await waitFor(() => {
      expect(setValueWithSource).not.toHaveBeenCalled() // Not in form
    })
    await waitFor(() => {
      expect(additionalAction).toHaveBeenCalledWith("someValue")
    })
  })
})
