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

import React from "react"

import { screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  Element,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  TextArea as TextAreaProto,
} from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import TextArea, { Props } from "./TextArea"

// Mock Element for tests
class MockElement implements Element {
  constructor() {}

  toJSON(): MockElement {
    return this
  }
}

const getProps = (
  elementProps: Partial<TextAreaProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: TextAreaProto.create({
    id: "1",
    label: "Label",
    default: "",
    placeholder: "Placeholder",
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  outerElement: new MockElement(),
  ...widgetProps,
})

describe("TextArea widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toBeInTheDocument()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
  })

  it("can pass fragmentId to setStringValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      "myFragmentId"
    )
  })

  it("has correct className", () => {
    const props = getProps()
    render(<TextArea {...props} />)
    const textArea = screen.getByTestId("stTextArea")

    expect(textArea).toHaveClass("stTextArea")
  })

  it("renders a label", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const widgetLabel = screen.getByText(`${props.element.label}`)
    expect(widgetLabel).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<TextArea {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<TextArea {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("has a default value", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toHaveValue(props.element.default)
  })

  it("renders a placeholder", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toHaveAttribute("placeholder", props.element.placeholder)
  })

  it("can be disabled", () => {
    const props = getProps({}, { disabled: true })
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toBeDisabled()
  })

  it("sets widget value on blur", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "testing")
    // Blur the textarea
    await user.tab()

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("sets widget value when ctrl+enter is pressed", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "testing")
    await user.keyboard("{Control>}{Enter}")

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("limits the length if max_chars is passed", async () => {
    const user = userEvent.setup()
    const props = getProps({
      height: 500,
      maxChars: 10,
    })
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "0123456789")
    expect(textArea).toHaveValue("0123456789")

    await user.type(textArea, "a")
    expect(textArea).toHaveValue("0123456789")
  })

  it("does not update widget value on text changes when outside of a form", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "TEST")

    // Check that the last call was in componentDidMount.
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: false,
      },
      undefined
    )
  })

  it("hides Please enter to apply text when width is smaller than 180px", async () => {
    const user = userEvent.setup()
    const props = getProps({}, {})
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [100],
    })

    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.click(textArea)

    expect(screen.queryByTestId("InputInstructions")).not.toBeInTheDocument()
  })

  it("shows Please enter to apply text when width is bigger than 180px", async () => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [190],
    })

    const user = userEvent.setup()
    const props = getProps({}, {})
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.click(textArea)

    expect(screen.getByTestId("InputInstructions")).toBeInTheDocument()
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextArea {...props} />)

    // Change the widget value
    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "TEST")
    expect(textArea).toHaveValue("TEST")

    // "Submit" the form
    props.widgetMgr.submitForm("form", undefined)

    // Our widget should be reset, and the widgetMgr should be updated
    await waitFor(() => expect(textArea).toHaveValue(props.element.default))
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("shows Input Instructions on dirty state when not in form (by default)", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<TextArea {...props} />)

    // Trigger dirty state
    const textArea = screen.getByRole("textbox")
    await user.click(textArea)
    await user.keyboard("TEST")

    expect(screen.getByText("Press ⌘+Enter to apply")).toBeVisible()
  })

  it("shows Input Instructions if in form that allows submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<TextArea {...props} />)

    // Trigger dirty state
    const textArea = screen.getByRole("textbox")
    await user.click(textArea)
    await user.keyboard("TEST")

    expect(screen.getByText("Press ⌘+Enter to submit form")).toBeVisible()
  })

  // For this scenario https://github.com/streamlit/streamlit/issues/7079
  it("shows Input Instructions if focused again in form that allows submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.click(textArea)
    await user.keyboard("TEST")

    // Remove focus
    textArea.blur()
    await waitFor(() => {
      expect(screen.queryByTestId("InputInstructions")).not.toBeInTheDocument()
    })

    // Then focus again
    textArea.focus()
    await waitFor(() => {
      expect(screen.getByText("Press ⌘+Enter to submit form")).toBeVisible()
    })
  })

  it("hides Input Instructions if in form that doesn't allow submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(false)

    render(<TextArea {...props} />)

    // Trigger dirty state
    const textArea = screen.getByRole("textbox")
    await user.click(textArea)
    await user.keyboard("TEST")

    expect(screen.queryByTestId("InputInstructions")).toHaveTextContent("")
  })

  it("focuses input when clicking label", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<TextArea {...props} />)
    const textArea = screen.getByRole("textbox")
    expect(textArea).not.toHaveFocus()
    const label = screen.getByText(props.element.label)
    await user.click(label)
    expect(textArea).toHaveFocus()
  })

  describe("on mac", () => {
    Object.defineProperty(navigator, "platform", {
      value: "MacIntel",
      writable: true,
    })

    it("sets widget value when ⌘+enter is pressed", async () => {
      const user = userEvent.setup()
      const props = getProps()
      vi.spyOn(props.widgetMgr, "setStringValue")
      render(<TextArea {...props} />)
      const textArea = screen.getByRole("textbox")
      await user.type(textArea, "testing")
      await user.keyboard("{Meta>}{Enter}")

      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "testing",
        {
          fromUi: true,
        },
        undefined
      )
    })
  })

  it("ensures id doesn't change on rerender", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<TextArea {...props} />)

    const textAreaLabel1 = screen.getByTestId("stWidgetLabel")
    const forId1 = textAreaLabel1.getAttribute("for")

    // Make some change to cause a rerender
    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "testing")
    textArea.blur()

    const textAreaLabel2 = screen.getByTestId("stWidgetLabel")
    const forId2 = textAreaLabel2.getAttribute("for")

    expect(forId2).toBe(forId1)
  })
})
