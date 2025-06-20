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

import { renderHook, waitFor } from "@testing-library/react"

import useOnInPutChange from "./useOnInputChange"

describe("useOnInputChange", () => {
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
        fromUi: true,
      })
    })
  })
  it("should not call the setValueWithSource callback because it is not in a form", async () => {
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
})
