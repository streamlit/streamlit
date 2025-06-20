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

import { WidgetStateManager } from "~lib/WidgetStateManager"

import useSubmitFormViaEnterKey from "./useSubmitFormViaEnterKey"

const widgetMgr = new WidgetStateManager({
  sendRerunBackMsg: vi.fn(),
  formsDataChanged: vi.fn(),
})
describe("useSubmitFormViaEnterKey", () => {
  it("should call commitWidgetValue and submitForm when Enter is pressed", async () => {
    const commitWidgetValue = vi.fn()
    const allowFormEnterToSubmit = vi.fn((_: string) => true)
    const submitForm = vi.fn()
    widgetMgr.allowFormEnterToSubmit = allowFormEnterToSubmit
    widgetMgr.submitForm = submitForm

    const { result: onInputChange } = renderHook(() =>
      useSubmitFormViaEnterKey(
        "someFormId",
        commitWidgetValue,
        true,
        widgetMgr,
        "someFragmentId",
        false
      )
    )

    onInputChange.current({
      key: "Enter",
      metaKey: false,
      ctrlKey: false,
      keyCode: 0,
      nativeEvent: undefined as never,
      preventDefault: vi.fn(),
    })
    await waitFor(() => {
      expect(commitWidgetValue).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(allowFormEnterToSubmit).toHaveBeenCalledWith("someFormId")
    })
    await waitFor(() => {
      expect(submitForm).toHaveBeenCalledWith("someFormId", "someFragmentId")
    })
  })

  it("should not call anything when Enter is not pressed", async () => {
    const commitWidgetValue = vi.fn()
    const allowFormEnterToSubmit = vi.fn((_: string) => true)
    const submitForm = vi.fn()
    widgetMgr.allowFormEnterToSubmit = allowFormEnterToSubmit
    widgetMgr.submitForm = submitForm

    const { result: onInputChange } = renderHook(() =>
      useSubmitFormViaEnterKey(
        "someFormId",
        commitWidgetValue,
        true,
        widgetMgr,
        "someFragmentId",
        false
      )
    )

    onInputChange.current({
      key: "SomeOtherKey",
      metaKey: false,
      ctrlKey: false,
      keyCode: 0,
      nativeEvent: undefined as never,
      preventDefault: vi.fn(),
    })
    await waitFor(() => {
      expect(commitWidgetValue).not.toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(allowFormEnterToSubmit).not.toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(submitForm).not.toHaveBeenCalled()
    })
  })

  it("should not call anything when Enter is pressed but command key is required", async () => {
    const commitWidgetValue = vi.fn()
    const allowFormEnterToSubmit = vi.fn((_: string) => true)
    const submitForm = vi.fn()
    widgetMgr.allowFormEnterToSubmit = allowFormEnterToSubmit
    widgetMgr.submitForm = submitForm

    const { result: onInputChange } = renderHook(() =>
      useSubmitFormViaEnterKey(
        "someFormId",
        commitWidgetValue,
        true,
        widgetMgr,
        "someFragmentId",
        true
      )
    )

    onInputChange.current({
      key: "Enter",
      metaKey: false,
      ctrlKey: false,
      keyCode: 0,
      nativeEvent: undefined as never,
      preventDefault: vi.fn(),
    })
    await waitFor(() => {
      expect(commitWidgetValue).not.toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(allowFormEnterToSubmit).not.toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(submitForm).not.toHaveBeenCalled()
    })
  })

  it.each([
    [true, true],
    [true, false],
    [false, true],
  ])(
    "should call commitWidgetValue and submitForm when Enter and command key (metaKey: %s, ctrlKey: %s) are pressed",
    async (metaKey: boolean, ctrlKey: boolean) => {
      const commitWidgetValue = vi.fn()
      const allowFormEnterToSubmit = vi.fn((_: string) => true)
      const submitForm = vi.fn()
      widgetMgr.allowFormEnterToSubmit = allowFormEnterToSubmit
      widgetMgr.submitForm = submitForm

      const { result: onInputChange } = renderHook(() =>
        useSubmitFormViaEnterKey(
          "someFormId",
          commitWidgetValue,
          true,
          widgetMgr,
          "someFragmentId",
          true
        )
      )

      onInputChange.current({
        key: "Enter",
        metaKey: metaKey,
        ctrlKey: ctrlKey,
        keyCode: 0,
        nativeEvent: undefined as never,
        preventDefault: vi.fn(),
      })
      await waitFor(() => {
        expect(commitWidgetValue).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(allowFormEnterToSubmit).toHaveBeenCalledWith("someFormId")
      })
      await waitFor(() => {
        expect(submitForm).toHaveBeenCalledWith("someFormId", "someFragmentId")
      })
    }
  )

  it("should call commitWidgetValue but not submitForm when allowFormEnterToSubmit returns false", async () => {
    const commitWidgetValue = vi.fn()
    const allowFormEnterToSubmit = vi.fn((_: string) => false)
    const submitForm = vi.fn()
    widgetMgr.allowFormEnterToSubmit = allowFormEnterToSubmit
    widgetMgr.submitForm = submitForm

    const { result: onInputChange } = renderHook(() =>
      useSubmitFormViaEnterKey(
        "someFormId",
        commitWidgetValue,
        true,
        widgetMgr,
        "",
        false
      )
    )

    onInputChange.current({
      key: "Enter",
      metaKey: false,
      ctrlKey: false,
      keyCode: 0,
      nativeEvent: undefined as never,
      preventDefault: vi.fn(),
    })
    await waitFor(() => {
      expect(commitWidgetValue).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(allowFormEnterToSubmit).toHaveBeenCalledWith("someFormId")
    })
    await waitFor(() => {
      expect(submitForm).not.toHaveBeenCalled()
    })
  })

  it("should neither call commitWidgetValue nor submitForm", async () => {
    const commitWidgetValue = vi.fn()
    const allowFormEnterToSubmit = vi.fn((_: string) => false)
    const submitForm = vi.fn()
    widgetMgr.allowFormEnterToSubmit = allowFormEnterToSubmit
    widgetMgr.submitForm = submitForm

    const { result: onInputChange } = renderHook(() =>
      useSubmitFormViaEnterKey(
        "",
        commitWidgetValue,
        false,
        widgetMgr,
        "",
        false
      )
    )

    onInputChange.current({
      key: "Enter",
      metaKey: false,
      ctrlKey: false,
      keyCode: 0,
      nativeEvent: undefined as never,
      preventDefault: vi.fn(),
    })
    await waitFor(() => {
      expect(commitWidgetValue).not.toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(allowFormEnterToSubmit).toHaveBeenCalledWith("")
    })
    await waitFor(() => {
      expect(submitForm).not.toHaveBeenCalled()
    })
  })
})
