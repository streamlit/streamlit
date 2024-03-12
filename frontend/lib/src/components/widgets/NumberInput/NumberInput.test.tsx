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
import React from "react"
import "@testing-library/jest-dom"
import { screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  NumberInput as NumberInputProto,
} from "@streamlit/lib/src/proto"

import { render } from "@streamlit/lib/src/test_util"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"

import { NumberInput, Props } from "./NumberInput"

const getProps = (elementProps: Partial<NumberInputProto> = {}): Props => ({
  element: NumberInputProto.create({
    label: "Label",
    default: 0,
    hasMin: false,
    hasMax: false,
    ...elementProps,
  }),
  width: 300,
  disabled: false,
  theme: mockTheme.emotion,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

const getIntProps = (elementProps: Partial<NumberInputProto> = {}): Props => {
  return getProps({
    dataType: NumberInputProto.DataType.INT,
    default: 10,
    min: 0,
    max: 0,
    ...elementProps,
  })
}

const getFloatProps = (
  elementProps: Partial<NumberInputProto> = {}
): Props => {
  return getProps({
    dataType: NumberInputProto.DataType.FLOAT,
    default: 10.0,
    min: 0.0,
    max: 0.0,
    ...elementProps,
  })
}

describe("NumberInput widget", () => {
  it("renders without crashing", () => {
    const props = getIntProps()
    render(<NumberInput {...props} />)

    expect(screen.getByTestId("stNumberInput")).toBeInTheDocument()
  })

  it("adds a focused class when running onFocus", () => {
    const props = getIntProps()
    render(<NumberInput {...props} />)

    fireEvent.focus(screen.getByTestId("stNumberInput-Input"))
    expect(screen.getByTestId("stNumberInputContainer")).toHaveClass("focused")
  })

  it("removes the focused class when running onBlur", () => {
    const props = getIntProps()
    render(<NumberInput {...props} />)

    fireEvent.focus(screen.getByTestId("stNumberInput-Input"))
    expect(screen.getByTestId("stNumberInputContainer")).toHaveClass("focused")

    fireEvent.blur(screen.getByTestId("stNumberInput-Input"))
    expect(screen.getByTestId("stNumberInputContainer")).not.toHaveClass(
      "focused"
    )
  })

  it("handles malformed format strings without crashing", () => {
    // This format string is malformed (it should be %0.2f)
    const props = getFloatProps({
      default: 5.0,
      format: "%0.2",
    })
    render(<NumberInput {...props} />)

    expect(screen.getByTestId("stNumberInput")).toBeInTheDocument()
    expect(screen.getByTestId("stNumberInput-Input")).toHaveValue(5.0)
  })

  it("shows a label", () => {
    const props = getIntProps()
    render(<NumberInput {...props} />)

    expect(screen.getByTestId("stWidgetLabel")).toHaveTextContent(
      props.element.label
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getIntProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<NumberInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getIntProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<NumberInput {...props} />)

    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("sets min/max defaults", () => {
    const props = getIntProps()
    render(<NumberInput {...props} />)

    const numberInput = screen.getByTestId("stNumberInput-Input")

    expect(numberInput).toHaveAttribute("min", "-Infinity")
    expect(numberInput).toHaveAttribute("max", "Infinity")
  })

  it("sets min/max values", () => {
    const props = getIntProps({
      hasMin: true,
      hasMax: true,
      default: 10,
      min: 0,
      max: 10,
    })
    render(<NumberInput {...props} />)
    const numberInput = screen.getByTestId("stNumberInput-Input")

    expect(numberInput).toHaveAttribute("min", "0")
    expect(numberInput).toHaveAttribute("max", "10")
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getIntProps({ formId: "form", default: 10 })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setIntValue")
    render(<NumberInput {...props} />)

    const numberInput = screen.getByTestId("stNumberInput-Input")
    // Change the widget value
    fireEvent.change(numberInput, {
      target: { value: 15 },
    })

    // "Submit" the form
    props.widgetMgr.submitForm("form")

    // Our widget should be reset, and the widgetMgr should be updated
    expect(numberInput).toHaveValue(props.element.default)
    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })

  describe("FloatData", () => {
    it("changes state on ArrowDown", () => {
      const props = getFloatProps({
        format: "%0.2f",
        default: 11.0,
        step: 0.1,
      })

      render(<NumberInput {...props} />)
      const numberInput = screen.getByTestId("stNumberInput-Input")

      fireEvent.keyDown(numberInput, {
        key: "ArrowDown",
      })

      expect(numberInput).toHaveValue(10.9)
    })

    it("sets widget value on mount", () => {
      const props = getFloatProps()
      jest.spyOn(props.widgetMgr, "setDoubleValue")

      render(<NumberInput {...props} />)

      expect(props.widgetMgr.setDoubleValue).toHaveBeenCalledWith(
        props.element,
        props.element.default,
        {
          fromUi: false,
        }
      )
    })

    it("sets value on Enter", () => {
      const props = getFloatProps({ default: 10 })
      jest.spyOn(props.widgetMgr, "setDoubleValue")

      render(<NumberInput {...props} />)

      fireEvent.keyPress(screen.getByTestId("stNumberInput-Input"), {
        key: "Enter",
      })

      expect(props.widgetMgr.setDoubleValue).toHaveBeenCalled()
    })

    it("sets initialValue from widgetMgr", () => {
      const props = getFloatProps({ default: 10.0 })
      props.widgetMgr.getDoubleValue = jest.fn(() => 15.0)
      render(<NumberInput {...props} />)

      expect(screen.getByTestId("stNumberInput-Input")).toHaveValue(15.0)
    })
  })

  describe("IntData", () => {
    it("passes a default value", () => {
      const props = getIntProps({ default: 10 })
      render(<NumberInput {...props} />)

      expect(screen.getByTestId("stNumberInput-Input")).toHaveValue(10)
    })

    it("sets widget value on mount", () => {
      const props = getIntProps()
      jest.spyOn(props.widgetMgr, "setIntValue")

      render(<NumberInput {...props} />)

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        props.element.default,
        {
          fromUi: false,
        }
      )
    })

    it("handles changes properly", async () => {
      const user = userEvent.setup()
      const props = getIntProps({ default: 10, max: 20 })
      render(<NumberInput {...props} />)
      const numberInput = screen.getByTestId("stNumberInput-Input")

      // userEvent necessary to trigger dirty state
      await user.click(numberInput)
      await user.keyboard("{backspace}{backspace}15")

      // Check that the value is updated & state dirty
      expect(screen.getByTestId("stNumberInput-Input")).toHaveValue(15)
      expect(screen.getByTestId("InputInstructions")).toHaveTextContent(
        "Press Enter to apply"
      )
    })

    it("sets value on Enter", () => {
      const props = getIntProps({ default: 10 })
      jest.spyOn(props.widgetMgr, "setIntValue")

      render(<NumberInput {...props} />)

      fireEvent.keyPress(screen.getByTestId("stNumberInput-Input"), {
        key: "Enter",
      })

      expect(props.widgetMgr.setIntValue).toHaveBeenCalled()
    })

    it("sets initialValue from widgetMgr", () => {
      const props = getIntProps({ default: 10 })
      props.widgetMgr.getIntValue = jest.fn(() => 15)

      render(<NumberInput {...props} />)

      expect(screen.getByTestId("stNumberInput-Input")).toHaveValue(15)
    })
  })

  describe("Step", () => {
    it("passes the step prop", () => {
      const props = getIntProps({ default: 10, step: 1 })
      render(<NumberInput {...props} />)

      // Increment
      fireEvent.click(screen.getByTestId("stNumberInput-StepUp"))

      // Check step properly enforced
      expect(screen.getByTestId("stNumberInput-Input")).toHaveValue(11)
    })

    it("changes state on ArrowUp", () => {
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      render(<NumberInput {...props} />)

      const numberInput = screen.getByTestId("stNumberInput-Input")
      fireEvent.keyDown(numberInput, {
        key: "ArrowUp",
      })
      expect(numberInput).toHaveValue(11)
    })

    it("changes state on ArrowDown", () => {
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      render(<NumberInput {...props} />)

      const numberInput = screen.getByTestId("stNumberInput-Input")
      fireEvent.keyDown(numberInput, {
        key: "ArrowDown",
      })
      expect(numberInput).toHaveValue(9)
    })

    it("handles stepDown button clicks", () => {
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      render(<NumberInput {...props} />)

      // Decrement
      fireEvent.click(screen.getByTestId("stNumberInput-StepDown"))
      expect(screen.getByTestId("stNumberInput-Input")).toHaveValue(9)
    })

    it("handles stepUp button clicks", () => {
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      render(<NumberInput {...props} />)

      // Increment
      fireEvent.click(screen.getByTestId("stNumberInput-StepUp"))
      expect(screen.getByTestId("stNumberInput-Input")).toHaveValue(11)
    })

    it("disables stepDown button when at min", () => {
      const props = getIntProps({ default: 1, step: 1, min: 0, hasMin: true })
      render(<NumberInput {...props} />)

      const stepDownButton = screen.getByTestId("stNumberInput-StepDown")
      expect(stepDownButton).not.toBeDisabled()

      fireEvent.click(stepDownButton)

      expect(screen.getByTestId("stNumberInput-Input")).toHaveValue(0)
      expect(stepDownButton).toBeDisabled()
    })

    it("disables stepUp button when at max", () => {
      const props = getIntProps({ default: 1, step: 1, max: 2, hasMax: true })
      render(<NumberInput {...props} />)

      const stepUpButton = screen.getByTestId("stNumberInput-StepUp")
      expect(stepUpButton).not.toBeDisabled()

      fireEvent.click(stepUpButton)

      expect(screen.getByTestId("stNumberInput-Input")).toHaveValue(2)
      expect(stepUpButton).toBeDisabled()
    })

    it("hides stepUp and stepDown buttons when width is smaller than 120px", () => {
      const props = getIntProps({ default: 1, step: 1, max: 2, hasMax: true })
      render(<NumberInput {...props} width={100} />)

      expect(
        screen.queryByTestId("stNumberInput-StepUp")
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTestId("stNumberInput-StepDown")
      ).not.toBeInTheDocument()
    })

    it("shows stepUp and stepDown buttons when width is bigger than 120px", () => {
      const props = getIntProps({ default: 1, step: 1, max: 2, hasMax: true })
      render(<NumberInput {...props} width={185} />)

      expect(screen.getByTestId("stNumberInput-StepUp")).toBeInTheDocument()
      expect(screen.getByTestId("stNumberInput-StepDown")).toBeInTheDocument()
    })

    it("hides Please enter to apply text when width is smaller than 120px", async () => {
      const user = userEvent.setup()
      const props = getIntProps({ default: 1, step: 1, max: 20, hasMax: true })
      render(<NumberInput {...props} width={100} />)
      const numberInput = screen.getByTestId("stNumberInput-Input")

      // userEvent necessary to trigger dirty state
      await user.click(numberInput)
      await user.keyboard("20")

      expect(screen.queryByTestId("InputInstructions")).not.toBeInTheDocument()
    })

    it("shows Please enter to apply text when width is bigger than 120px", async () => {
      const user = userEvent.setup()
      const props = getIntProps({ default: 1, step: 1, max: 20, hasMax: true })
      render(<NumberInput {...props} width={185} />)
      const numberInput = screen.getByTestId("stNumberInput-Input")

      // userEvent necessary to trigger dirty state
      await user.click(numberInput)
      await user.keyboard("20")

      expect(screen.getByTestId("InputInstructions")).toHaveTextContent(
        "Press Enter to apply"
      )
    })
  })

  it("focuses input when clicking label", async () => {
    const props = getProps()
    render(<NumberInput {...props} />)
    const numberInput = screen.getByTestId("stNumberInput-Input")
    expect(numberInput).not.toHaveFocus()
    const label = screen.getByText(props.element.label)
    const user = userEvent.setup()
    await user.click(label)
    expect(numberInput).toHaveFocus()
  })

  it("ensures id doesn't change on rerender", () => {
    const props = getProps()
    render(<NumberInput {...props} />)

    const numberInputLabel1 = screen.getByTestId("stWidgetLabel")
    const forId1 = numberInputLabel1.getAttribute("for")

    // Make some change to cause a rerender
    const numberInput = screen.getByTestId("stNumberInput-Input")
    // Change the widget value
    fireEvent.change(numberInput, {
      target: { value: 15 },
    })
    expect(screen.getByTestId("stNumberInput-Input")).toHaveValue(15)

    const numberInputLabel2 = screen.getByTestId("stWidgetLabel")
    const forId2 = numberInputLabel2.getAttribute("for")

    expect(forId2).toBe(forId1)
  })
})
