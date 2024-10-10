/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { FC } from "react"

import { act, renderHook } from "@testing-library/react-hooks"
import { fireEvent, render, screen } from "@testing-library/react"

import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { Form } from "@streamlit/lib/src/components/widgets/Form"
import { ScriptRunState } from "@streamlit/lib/src/ScriptRunState"
import { RootStyleProvider } from "@streamlit/lib/src/RootStyleProvider"
import { getDefaultTheme } from "@streamlit/lib/src/theme"

import useWidgetManagerElementState from "./useWidgetManagerElementState"

const elementId = "elementId"

describe("useWidgetManagerElementState hook", () => {
  it("should initialize correctly with initial state", () => {
    const widgetMgr = new WidgetStateManager({
      formsDataChanged: jest.fn(),
      sendRerunBackMsg: jest.fn(),
    })

    const { result } = renderHook(() =>
      useWidgetManagerElementState<number | null>({
        widgetMgr,
        id: elementId,
        key: "key",
        defaultValue: 42,
      })
    )

    const [state] = result.current

    // Initial state is set correctly
    expect(state).toEqual(42)
    expect(widgetMgr.getElementState(elementId, "key")).toEqual(42)
  })

  it("should set state correctly", () => {
    const widgetMgr = new WidgetStateManager({
      formsDataChanged: jest.fn(),
      sendRerunBackMsg: jest.fn(),
    })

    const { result } = renderHook(() =>
      useWidgetManagerElementState<number | null>({
        widgetMgr,
        id: elementId,
        key: "key",
        defaultValue: 42,
      })
    )

    const [, setState] = result.current

    act(() => {
      setState(24)
    })

    const state = result.current[0]
    expect(state).toEqual(24)
    expect(widgetMgr.getElementState(elementId, "key")).toEqual(24)
  })

  it("should properly clear state on form clear", async () => {
    const formId = "formId"
    const stateKey = "stateKey"
    const defaultValue = "initial"
    const newValue = "new value"
    const testInputAriaLabel = "test input"

    const widgetMgr = new WidgetStateManager({
      formsDataChanged: jest.fn(),
      sendRerunBackMsg: jest.fn(),
    })

    const TestComponent: FC = () => {
      const [state, setState] = useWidgetManagerElementState<string>({
        widgetMgr,
        id: elementId,
        formId,
        key: stateKey,
        defaultValue,
      })

      return (
        <RootStyleProvider theme={getDefaultTheme()}>
          <Form
            formId={formId}
            clearOnSubmit={true}
            enterToSubmit={false}
            width={0}
            hasSubmitButton={true}
            widgetMgr={widgetMgr}
            border={false}
            scriptRunState={ScriptRunState.NOT_RUNNING}
          >
            <input
              aria-label={testInputAriaLabel}
              type="text"
              value={state}
              onChange={e => setState(e.currentTarget.value)}
            />
          </Form>
        </RootStyleProvider>
      )
    }

    render(<TestComponent />)

    // verify default value
    const inputElement = screen.getByLabelText(
      testInputAriaLabel
    ) as HTMLInputElement
    expect(inputElement.value).toBe(defaultValue)

    expect(widgetMgr.getElementState(elementId, stateKey)).toBe(defaultValue)

    // change the input value
    fireEvent.change(inputElement, { target: { value: newValue } })

    // verify new value is set
    expect(inputElement.value).toBe(newValue)
    expect(widgetMgr.getElementState(elementId, stateKey)).toBe(newValue)

    // submit the form
    // note: struggled using default html form submission, so manually triggering our submission logic here
    await act(() => {
      widgetMgr.submitForm(formId, undefined)
    })

    // verify the value is reset to the default
    expect(widgetMgr.getElementState(elementId, stateKey)).toBe(defaultValue)
    expect(inputElement.value).toBe(defaultValue)
  })
})
