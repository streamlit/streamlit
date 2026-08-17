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

import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Selectbox as SelectboxProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Selectbox, { Props } from "./Selectbox"

const getProps = (
  elementProps: Partial<SelectboxProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: SelectboxProto.create({
    id: "1",
    label: "Label",
    default: 0,
    options: ["a", "b", "c"],
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...widgetProps,
})

const pickOption = async (
  _selectbox: HTMLElement,
  value: string
): Promise<void> => {
  const user = userEvent.setup()
  // Click the open button to open the dropdown
  const openButton = screen.getByRole("button", { name: "Open" })
  await user.click(openButton)
  // Find the desired option by role and click it
  const valueElement = screen.getByRole("option", { name: value })
  await user.click(valueElement)
  // Click outside the widget to close the dropdown
  await user.click(document.body)
}

describe("Selectbox widget", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<Selectbox {...props} />)
    const selectbox = screen.getByTestId("stSelectbox")
    expect(selectbox).toBeInTheDocument()
    expect(selectbox).toHaveClass("stSelectbox")
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.options[props.element.default ?? 0],
      { fromUi: false },
      undefined
    )
  })

  it("gets correct value from proto", () => {
    const props = getProps({
      rawValue: "c",
      setValue: true,
    })
    render(<Selectbox {...props} />)

    expect(screen.getByDisplayValue("c")).toBeVisible()
  })

  it("can pass fragmentId to setStringValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.options[props.element.default ?? 0],
      { fromUi: false },
      "myFragmentId"
    )
  })

  it("handles the onChange event", async () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)

    const selectbox = screen.getByRole("combobox")

    await pickOption(selectbox, "b")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "b",
      { fromUi: true },
      undefined
    )
    expect(screen.getByDisplayValue("b")).toBeVisible()
  })

  it("resets its value when form is cleared", async () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)

    const selectbox = screen.getByRole("combobox")
    await pickOption(selectbox, "b")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "b",
      { fromUi: true },
      undefined
    )

    // "Submit" the form
    act(() => {
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    await waitFor(() => {
      expect(screen.getByDisplayValue("a")).toBeVisible()
    })
    expect(screen.queryByDisplayValue("b")).not.toBeInTheDocument()
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.options[props.element.default ?? 0],
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("renders a placeholder with null default", () => {
    const props = getProps({
      placeholder: "Please select an option...",
      default: null,
    })
    render(<Selectbox {...props} />)

    expect(
      screen.getByPlaceholderText("Please select an option...")
    ).toBeInTheDocument()
  })
})

describe("Selectbox query param binding", () => {
  it("registers query param binding on mount when queryParamKey is set", () => {
    const props = getProps({ queryParamKey: "my_select" })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<Selectbox {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_select",
      "string_value",
      "a",
      false,
      undefined
    )
  })

  it("unregisters query param binding on unmount", () => {
    const props = getProps({ queryParamKey: "my_select" })
    const unregisterSpy = vi.spyOn(
      props.widgetMgr,
      "unregisterQueryParamBinding"
    )

    const { unmount } = render(<Selectbox {...props} />)

    // Clear any calls from React Strict Mode's initial mount/unmount/remount cycle
    unregisterSpy.mockClear()

    unmount()

    expect(props.widgetMgr.unregisterQueryParamBinding).toHaveBeenCalledWith(
      props.element.id
    )
  })

  it("does not register query param binding when queryParamKey is not set", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<Selectbox {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
  })

  it("registers with clearable=true when no default", () => {
    const props = getProps({ queryParamKey: "my_select", default: null })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<Selectbox {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_select",
      "string_value",
      null,
      true,
      undefined
    )
  })
})
