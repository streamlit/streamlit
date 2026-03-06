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

import { act, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  LabelVisibility as LabelVisibilityProto,
  NumberInput as NumberInputProto,
} from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import NumberInput, { Props } from "./NumberInput"

const getProps = (elementProps: Partial<NumberInputProto> = {}): Props => ({
  element: NumberInputProto.create({
    label: "Label",
    default: 0,
    hasMin: true,
    hasMax: true,
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
})

const getIntProps = (elementProps: Partial<NumberInputProto> = {}): Props => {
  return getProps({
    dataType: NumberInputProto.DataType.INT,
    default: 10,
    min: 0,
    max: 100,
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
    max: 100.0,
    ...elementProps,
  })
}

describe("NumberInput widget", () => {
  beforeEach(() => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  it("renders without crashing", () => {
    const props = getIntProps()
    render(<NumberInput {...props} />)
    const numberInput = screen.getByTestId("stNumberInput")
    expect(numberInput).toBeInTheDocument()
    expect(numberInput).toHaveClass("stNumberInput")
  })

  it("adds a focused class when running onFocus", async () => {
    const user = userEvent.setup()
    const props = getIntProps()
    render(<NumberInput {...props} />)

    await user.click(screen.getByTestId("stNumberInputField"))
    expect(screen.getByTestId("stNumberInputContainer")).toHaveClass("focused")
  })

  it("removes the focused class when running onBlur", async () => {
    const user = userEvent.setup()
    const props = getIntProps()
    render(<NumberInput {...props} />)

    await user.click(screen.getByTestId("stNumberInputField"))
    expect(screen.getByTestId("stNumberInputContainer")).toHaveClass("focused")

    await user.tab()
    expect(screen.getByTestId("stNumberInputContainer")).not.toHaveClass(
      "focused"
    )
  })

  it("commits typed value when input loses focus (blur)", async () => {
    // This tests when user types and blurs, the TYPED value
    // should be committed to widgetMgr
    const user = userEvent.setup()
    const props = getFloatProps({ default: 10.0 })
    vi.spyOn(props.widgetMgr, "setDoubleValue")

    render(<NumberInput {...props} />)
    const numberInput = screen.getByTestId("stNumberInputField")

    // Clear and type a new value
    await user.clear(numberInput)
    await user.type(numberInput, "42.5")

    // Blur to commit
    await user.tab()

    // Verify the TYPED value (42.5) was committed, not the old value (10.0)
    expect(props.widgetMgr.setDoubleValue).toHaveBeenLastCalledWith(
      props.element,
      42.5,
      { fromUi: true },
      undefined
    )
    expect(numberInput).toHaveValue(42.5)
  })

  it("commits typed INT value when input loses focus (blur)", async () => {
    const user = userEvent.setup()
    const props = getIntProps({ default: 10 })
    vi.spyOn(props.widgetMgr, "setIntValue")

    render(<NumberInput {...props} />)
    const numberInput = screen.getByTestId("stNumberInputField")

    await user.clear(numberInput)
    await user.type(numberInput, "42")
    await user.tab()

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      42,
      { fromUi: true },
      undefined
    )
    expect(numberInput).toHaveValue(42)
  })

  it("applies value from setValue correctly", () => {
    // Verify that when backend sends setValue=true with a value,
    // the widget displays that value
    const props = getIntProps({ setValue: true, value: 42, default: 10 })
    render(<NumberInput {...props} />)

    expect(screen.getByTestId("stNumberInputField")).toHaveValue(42)
  })

  it("applies FLOAT value from setValue correctly", () => {
    const props = getFloatProps({ setValue: true, value: 3.14, default: 1.0 })
    render(<NumberInput {...props} />)

    expect(screen.getByTestId("stNumberInputField")).toHaveValue(3.14)
  })

  it("handles malformed format strings without crashing", () => {
    // This format string is malformed (it should be %0.2f)
    const props = getFloatProps({
      default: 5.0,
      format: "%0.2",
    })
    render(<NumberInput {...props} />)

    expect(screen.getByTestId("stNumberInput")).toBeInTheDocument()
    expect(screen.getByTestId("stNumberInputField")).toHaveValue(5.0)
  })

  it("shows a label", () => {
    const props = getIntProps()
    render(<NumberInput {...props} />)

    expect(screen.getByText(props.element.label)).toBeVisible()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getIntProps({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
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
        value: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<NumberInput {...props} />)

    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("sets input mode to empty string", () => {
    const props = getIntProps()
    render(<NumberInput {...props} />)

    const numberInput = screen.getByTestId("stNumberInputField")

    expect(numberInput).toHaveAttribute("inputmode", "")
  })

  it("sets input type to number", () => {
    const props = getIntProps()
    render(<NumberInput {...props} />)

    const numberInput = screen.getByTestId("stNumberInputField")

    expect(numberInput).toHaveAttribute("type", "number")
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
    const numberInput = screen.getByTestId("stNumberInputField")

    expect(numberInput).toHaveAttribute("min", "0")
    expect(numberInput).toHaveAttribute("max", "10")
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()
    // Create a widget in a clearOnSubmit form
    const props = getIntProps({ formId: "form", default: 10 })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setIntValue")
    render(<NumberInput {...props} />)

    const numberInput = screen.getByTestId("stNumberInputField")
    await user.clear(numberInput)
    await user.type(numberInput, "15")

    // "Submit" the form
    act(() => {
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    expect(numberInput).toHaveValue(props.element.default)
    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
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
    const props = getIntProps()
    render(<NumberInput {...props} />)
    const numberInput = screen.getByTestId("stNumberInputField")

    // userEvent necessary to trigger dirty state
    await user.click(numberInput)
    await user.keyboard("{backspace}5")

    expect(screen.getByText("Press Enter to apply")).toBeVisible()
  })

  it("shows Input Instructions if in form that allows submit on enter", async () => {
    const user = userEvent.setup()
    const props = getIntProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<NumberInput {...props} />)
    const numberInput = screen.getByTestId("stNumberInputField")

    // userEvent necessary to trigger dirty state
    await user.click(numberInput)
    await user.keyboard("{backspace}5")

    expect(screen.getByText("Press Enter to submit form")).toBeVisible()
  })

  it("shows Input Instructions if focused again and in form that allows submit on enter", async () => {
    const user = userEvent.setup()
    const props = getIntProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<NumberInput {...props} />)
    const numberInput = screen.getByTestId("stNumberInputField")

    // userEvent necessary to trigger dirty state
    await user.click(numberInput)
    await user.keyboard("{backspace}5")

    await user.tab()
    expect(screen.queryByTestId("InputInstructions")).not.toBeInTheDocument()

    await user.click(numberInput)
    expect(screen.getByText("Press Enter to submit form")).toBeVisible()
  })

  it("hides Input Instructions if in form that doesn't allow submit on enter", async () => {
    const user = userEvent.setup()
    const props = getIntProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(false)

    render(<NumberInput {...props} />)
    const numberInput = screen.getByTestId("stNumberInputField")

    // userEvent necessary to trigger dirty state
    await user.click(numberInput)
    await user.keyboard("{backspace}5")

    expect(screen.queryByTestId("InputInstructions")).toHaveTextContent("")
  })

  it("renders an emoji icon when provided", () => {
    const props = getFloatProps({ icon: "💵" })
    render(<NumberInput {...props} />)
    // Dynamic Icon parent element
    expect(screen.getByTestId("stNumberInputIcon")).toBeInTheDocument()
    // Element rendering emoji icon
    const emojiIcon = screen.getByTestId("stIconEmoji")
    expect(emojiIcon).toHaveTextContent("💵")
  })

  it("renders a material icon when provided", () => {
    const props = getFloatProps({ icon: ":material/attach_money:" })
    render(<NumberInput {...props} />)
    // Dynamic Icon parent element
    expect(screen.getByTestId("stNumberInputIcon")).toBeInTheDocument()
    // Element rendering material icon
    const materialIcon = screen.getByTestId("stIconMaterial")
    expect(materialIcon).toHaveTextContent("attach_money")
  })

  describe("FloatData", () => {
    it("changes state on ArrowDown", async () => {
      const user = userEvent.setup()
      const props = getFloatProps({
        format: "%0.2f",
        default: 11.0,
        step: 0.1,
      })

      render(<NumberInput {...props} />)
      const numberInput = screen.getByTestId("stNumberInputField")

      await user.type(numberInput, "{arrowdown}")

      expect(numberInput).toHaveValue(10.9)
    })

    it("sets widget value on mount", () => {
      const props = getFloatProps()
      vi.spyOn(props.widgetMgr, "setDoubleValue")

      render(<NumberInput {...props} />)

      expect(props.widgetMgr.setDoubleValue).toHaveBeenCalledWith(
        props.element,
        props.element.default,
        {
          fromUi: false,
        },
        undefined
      )
    })

    it("sets value on Enter", async () => {
      const user = userEvent.setup()
      const props = getFloatProps({ default: 10 })
      vi.spyOn(props.widgetMgr, "setDoubleValue")

      render(<NumberInput {...props} />)

      await user.type(screen.getByTestId("stNumberInputField"), "{enter}")

      expect(props.widgetMgr.setDoubleValue).toHaveBeenCalled()
    })

    it("sets initialValue from widgetMgr", () => {
      const props = getFloatProps({ default: 10.0 })
      props.widgetMgr.getDoubleValue = vi.fn(() => 15.0)
      render(<NumberInput {...props} />)

      expect(screen.getByTestId("stNumberInputField")).toHaveValue(15.0)
    })

    describe("Formatting", () => {
      it("allows explicit formatting string", () => {
        const props = getFloatProps({
          default: 1.11111,
          format: "%0.4f",
        })
        render(<NumberInput {...props} />)

        expect(screen.getByTestId("stNumberInput")).toBeInTheDocument()
        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          "1.1111"
        )
      })
    })

    it("allows formatting a float as an integer", () => {
      const props = getFloatProps({
        default: 1.11111,
        format: "%d",
      })

      render(<NumberInput {...props} />)

      expect(screen.getByTestId("stNumberInput")).toBeInTheDocument()
      expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue("1")
    })

    it("automatically sets formatting when none provided based on step", () => {
      const props = getFloatProps({
        default: 1.0,
        step: 0.005,
      })

      render(<NumberInput {...props} />)

      expect(screen.getByTestId("stNumberInput")).toBeInTheDocument()
      expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
        "1.000"
      )
    })

    it("does not automatically format when a format is explicitly provided", () => {
      const props = getFloatProps({
        default: 1.0,
        step: 0.1,
        format: "%0.2f",
      })

      render(<NumberInput {...props} />)

      expect(screen.getByTestId("stNumberInput")).toBeInTheDocument()
      expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
        "1.00"
      )
    })

    it("does not automatically format when the step size is integer", () => {
      const props = getFloatProps({
        default: 1.0,
        step: 1,
      })

      render(<NumberInput {...props} />)

      expect(screen.getByTestId("stNumberInput")).toBeInTheDocument()
      expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue("1")
    })

    it("resets its formatted value when form is cleared", async () => {
      const user = userEvent.setup()
      const props = getFloatProps({
        formId: "form",
        default: 5.5,
        format: "%0.3f",
      })
      props.widgetMgr.setFormSubmitBehaviors("form", true)

      render(<NumberInput {...props} />)
      const numberInput = screen.getByTestId("stNumberInputField")

      // Modify the value so that the widget becomes dirty.
      await user.clear(numberInput)
      await user.type(numberInput, "8.123")

      expect(numberInput).toHaveDisplayValue("8.123")

      // "Submit" the form – this should trigger the widget reset.
      act(() => {
        props.widgetMgr.submitForm("form", undefined)
      })

      // The displayed value should reset to the default value.
      // Note: The formatValue function correctly applies "%0.3f" to produce "5.500",
      // but HTML <input type="number"> automatically normalizes values by removing
      // trailing zeros, so "5.500" is displayed as "5.5". This is standard browser behavior.
      expect(numberInput).toHaveDisplayValue("5.5")
    })

    it("resets dirty state and formatted value via onFormCleared callback", async () => {
      const user = userEvent.setup()
      const props = getFloatProps({
        formId: "form",
        default: 10.0,
        format: "%0.2f",
      })
      props.widgetMgr.setFormSubmitBehaviors("form", true)
      vi.spyOn(props.widgetMgr, "setDoubleValue")

      render(<NumberInput {...props} />)
      const numberInput = screen.getByTestId("stNumberInputField")

      // Initial state: formatted value should be "10.00"
      expect(numberInput).toHaveDisplayValue("10.00")

      // Make the widget dirty by typing a new value
      await user.clear(numberInput)
      await user.type(numberInput, "25.75")
      await user.tab() // Blur to commit

      // Verify the new value was committed
      expect(numberInput).toHaveDisplayValue("25.75")
      expect(props.widgetMgr.setDoubleValue).toHaveBeenLastCalledWith(
        props.element,
        25.75,
        { fromUi: true },
        undefined
      )

      // Submit the form – this should trigger onFormCleared
      act(() => {
        props.widgetMgr.submitForm("form", undefined)
      })

      // After form clear:
      // 1. Formatted value should reset to default.
      // Note: formatValue correctly applies "%0.2f" format, but HTML <input type="number">
      // normalizes "10.00" to "10" by removing trailing zeros. This is standard browser behavior.
      expect(numberInput).toHaveDisplayValue("10")

      // 2. Verify that the default value was set in widgetMgr (dirty state was reset)
      expect(props.widgetMgr.setDoubleValue).toHaveBeenLastCalledWith(
        props.element,
        10.0,
        { fromUi: true },
        undefined
      )

      // 3. Verify we can interact with the widget again after form clear
      await user.clear(numberInput)
      await user.type(numberInput, "15.5")
      await user.tab()

      // New value should be committed successfully. The browser normalizes "15.50" to "15.5".
      expect(numberInput).toHaveDisplayValue("15.5")
      expect(props.widgetMgr.setDoubleValue).toHaveBeenLastCalledWith(
        props.element,
        15.5,
        { fromUi: true },
        undefined
      )
    })
  })

  describe("IntData", () => {
    it("passes a default value", () => {
      const props = getIntProps({ default: 10 })
      render(<NumberInput {...props} />)

      expect(screen.getByTestId("stNumberInputField")).toHaveValue(10)
    })

    it("sets widget value on mount", () => {
      const props = getIntProps()
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<NumberInput {...props} />)

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        props.element.default,
        {
          fromUi: false,
        },
        undefined
      )
    })

    it("handles changes properly", async () => {
      const user = userEvent.setup()
      const props = getIntProps({ default: 10, max: 20 })
      render(<NumberInput {...props} />)
      const numberInput = screen.getByTestId("stNumberInputField")

      await user.click(numberInput)
      await user.keyboard("{backspace}{backspace}15")

      // Check that the value is updated & state dirty
      expect(screen.getByTestId("stNumberInputField")).toHaveValue(15)
      expect(screen.getByText("Press Enter to apply")).toBeVisible()
    })

    it("sets value on Enter", async () => {
      const user = userEvent.setup()
      const props = getIntProps({ default: 10 })
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<NumberInput {...props} />)

      await user.type(screen.getByTestId("stNumberInputField"), "{enter}")

      expect(props.widgetMgr.setIntValue).toHaveBeenCalled()
    })

    it("can pass fragmentId to setIntValue", async () => {
      const user = userEvent.setup()
      const props = {
        ...getIntProps({ default: 10 }),
        fragmentId: "myFragmentId",
      }
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<NumberInput {...props} />)

      await user.type(screen.getByTestId("stNumberInputField"), "{enter}")

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        expect.anything(),
        10,
        { fromUi: false },
        "myFragmentId"
      )
    })

    it("sets initialValue from widgetMgr", () => {
      const props = getIntProps({ default: 10 })
      props.widgetMgr.getIntValue = vi.fn(() => 15)

      render(<NumberInput {...props} />)

      expect(screen.getByTestId("stNumberInputField")).toHaveValue(15)
    })
  })

  describe("Step", () => {
    describe("rapid interactions", () => {
      it("handles stepUp button clicks correctly", async () => {
        const user = userEvent.setup()
        const props = getIntProps({ default: 10, step: 1 })
        render(<NumberInput {...props} />)

        const stepUpButton = screen.getByTestId("stNumberInputStepUp")
        for (let i = 0; i < 5; i++) {
          await user.click(stepUpButton)
        }
        expect(screen.getByTestId("stNumberInputField")).toHaveValue(15)
      })

      it("handles stepDown button clicks correctly", async () => {
        const user = userEvent.setup()
        const props = getIntProps({ default: 10, step: 1 })
        render(<NumberInput {...props} />)

        const stepDownButton = screen.getByTestId("stNumberInputStepDown")
        for (let i = 0; i < 5; i++) {
          await user.click(stepDownButton)
        }
        expect(screen.getByTestId("stNumberInputField")).toHaveValue(5)
      })
    })

    it("passes the step prop", async () => {
      const user = userEvent.setup()
      const props = getIntProps({ default: 10, step: 1 })
      render(<NumberInput {...props} />)

      // Increment
      await user.click(screen.getByTestId("stNumberInputStepUp"))

      // Check step properly enforced
      expect(screen.getByTestId("stNumberInputField")).toHaveValue(11)
    })

    it("changes state on ArrowUp", async () => {
      const user = userEvent.setup()
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      render(<NumberInput {...props} />)

      const numberInput = screen.getByTestId("stNumberInputField")
      await user.type(numberInput, "{arrowup}")
      expect(numberInput).toHaveValue(11)
    })

    it("changes state on ArrowDown", async () => {
      const user = userEvent.setup()
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      render(<NumberInput {...props} />)

      const numberInput = screen.getByTestId("stNumberInputField")
      await user.type(numberInput, "{arrowdown}")
      expect(numberInput).toHaveValue(9)
    })

    it("handles stepDown button clicks", async () => {
      const user = userEvent.setup()
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      render(<NumberInput {...props} />)

      // Decrement
      await user.click(screen.getByTestId("stNumberInputStepDown"))
      expect(screen.getByTestId("stNumberInputField")).toHaveValue(9)
    })

    it("handles stepUp button clicks", async () => {
      const user = userEvent.setup()
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      render(<NumberInput {...props} />)

      // Increment
      await user.click(screen.getByTestId("stNumberInputStepUp"))
      expect(screen.getByTestId("stNumberInputField")).toHaveValue(11)
    })

    it("disables stepDown button when at min", async () => {
      const user = userEvent.setup()
      const props = getIntProps({ default: 1, step: 1, min: 0, hasMin: true })
      render(<NumberInput {...props} />)

      const stepDownButton = screen.getByTestId("stNumberInputStepDown")
      expect(stepDownButton).not.toBeDisabled()

      await user.click(stepDownButton)

      expect(screen.getByTestId("stNumberInputField")).toHaveValue(0)
      expect(stepDownButton).toBeDisabled()
    })

    it("disables stepUp button when at max", async () => {
      const user = userEvent.setup()
      const props = getIntProps({ default: 1, step: 1, max: 2, hasMax: true })
      render(<NumberInput {...props} />)

      const stepUpButton = screen.getByTestId("stNumberInputStepUp")
      expect(stepUpButton).not.toBeDisabled()

      await user.click(stepUpButton)

      expect(screen.getByTestId("stNumberInputField")).toHaveValue(2)
      expect(stepUpButton).toBeDisabled()
    })

    it("updates button enabled state based on typed value, not committed value", async () => {
      const user = userEvent.setup()
      const props = getIntProps({
        default: 5,
        step: 1,
        min: 0,
        max: 10,
        hasMin: true,
        hasMax: true,
      })
      render(<NumberInput {...props} />)

      const numberInput = screen.getByTestId("stNumberInputField")
      const stepUpButton = screen.getByTestId("stNumberInputStepUp")
      const stepDownButton = screen.getByTestId("stNumberInputStepDown")

      // Initially at 5, both buttons should be enabled
      expect(stepUpButton).not.toBeDisabled()
      expect(stepDownButton).not.toBeDisabled()

      // Type "10" (at max) - stepUp should become disabled immediately
      await user.clear(numberInput)
      await user.type(numberInput, "10")
      expect(stepUpButton).toBeDisabled()
      expect(stepDownButton).not.toBeDisabled()

      // Type "0" (at min) - stepDown should become disabled immediately
      await user.clear(numberInput)
      await user.type(numberInput, "0")
      expect(stepUpButton).not.toBeDisabled()
      expect(stepDownButton).toBeDisabled()

      // Type "5" (in range) - both should be enabled
      await user.clear(numberInput)
      await user.type(numberInput, "5")
      expect(stepUpButton).not.toBeDisabled()
      expect(stepDownButton).not.toBeDisabled()
    })

    it("hides stepUp and stepDown buttons when width is smaller than 120px", () => {
      vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
        elementRef: { current: null },
        values: [100],
      })

      const props = getIntProps({ default: 1, step: 1, max: 2, hasMax: true })
      render(<NumberInput {...props} />)

      expect(
        screen.queryByTestId("stNumberInputStepUp")
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTestId("stNumberInputStepDown")
      ).not.toBeInTheDocument()
    })

    it("shows stepUp and stepDown buttons when width is bigger than 120px", () => {
      const props = getIntProps({ default: 1, step: 1, max: 2, hasMax: true })
      render(<NumberInput {...props} />)

      expect(screen.getByTestId("stNumberInputStepUp")).toBeInTheDocument()
      expect(screen.getByTestId("stNumberInputStepDown")).toBeInTheDocument()
    })

    it("hides Please enter to apply text when width is smaller than 120px", async () => {
      vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
        elementRef: { current: null },
        values: [100],
      })

      const user = userEvent.setup()
      const props = getIntProps({ default: 1, step: 1, max: 20, hasMax: true })
      render(<NumberInput {...props} />)
      const numberInput = screen.getByTestId("stNumberInputField")

      // userEvent necessary to trigger dirty state
      await user.click(numberInput)
      await user.keyboard("20")

      expect(screen.queryByTestId("InputInstructions")).not.toBeInTheDocument()
    })

    it("shows Please enter to apply text when width is bigger than 120px", async () => {
      const user = userEvent.setup()
      const props = getIntProps({ default: 1, step: 1, max: 20, hasMax: true })
      render(<NumberInput {...props} />)
      const numberInput = screen.getByTestId("stNumberInputField")

      // userEvent necessary to trigger dirty state
      await user.click(numberInput)
      await user.keyboard("20")

      expect(screen.getByText("Press Enter to apply")).toBeVisible()
    })
  })

  it("focuses input when clicking label", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<NumberInput {...props} />)
    const numberInput = screen.getByTestId("stNumberInputField")
    expect(numberInput).not.toHaveFocus()
    const label = screen.getByText(props.element.label)
    await user.click(label)
    expect(numberInput).toHaveFocus()
  })

  it("ensures id doesn't change on rerender", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<NumberInput {...props} />)

    const numberInputLabel1 = screen.getByTestId("stWidgetLabel")
    const forId1 = numberInputLabel1.getAttribute("for")

    // Make some change to cause a rerender
    const numberInput = screen.getByTestId("stNumberInputField")
    // Change the widget value
    await user.clear(numberInput)
    await user.type(numberInput, "15")
    expect(screen.getByTestId("stNumberInputField")).toHaveValue(15)

    const numberInputLabel2 = screen.getByTestId("stWidgetLabel")
    const forId2 = numberInputLabel2.getAttribute("for")

    expect(forId2).toBe(forId1)
  })

  describe("formattedValue", () => {
    describe("Initial state formatting", () => {
      it.each([
        {
          description: "formats initial INT value correctly",
          propsFactory: () => getIntProps({ default: 42 }),
          expected: "42",
        },
        {
          description: "formats initial FLOAT value correctly",
          propsFactory: () => getFloatProps({ default: 42.5 }),
          expected: "42.50",
        },
        {
          description: "handles null initial value",
          propsFactory: () => getIntProps({ default: null }),
          expected: "",
        },
        {
          description: "formats initial value with custom format string",
          propsFactory: () =>
            getFloatProps({
              default: 42.123456,
              format: "%0.2f",
            }),
          expected: "42.12",
        },
        {
          description: "handles malformed format string gracefully",
          propsFactory: () =>
            getFloatProps({
              default: 42.123456,
              format: "%invalid",
            }),
          expected: "",
        },
        {
          description: "formats initial negative value",
          propsFactory: () => getIntProps({ default: -42, min: -100 }),
          expected: "-42",
        },
        {
          description: "formats initial zero value",
          propsFactory: () => getIntProps({ default: 0 }),
          expected: "0",
        },
        {
          description: "formats initial value with custom step",
          propsFactory: () =>
            getFloatProps({
              default: 1.0,
              step: 0.001,
            }),
          expected: "1.000",
        },
      ])("$description", ({ propsFactory, expected }) => {
        const props = propsFactory()
        render(<NumberInput {...props} />)

        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          expected
        )
      })

      it("uses value from widgetMgr when available", () => {
        const props = getIntProps({ default: 10 })
        props.widgetMgr.getIntValue = vi.fn(() => 25)
        render(<NumberInput {...props} />)

        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          "25"
        )
      })
    })

    describe("commitValue formatting", () => {
      it("formats value after committing valid INT", async () => {
        const user = userEvent.setup()
        const props = getIntProps({ default: 10, min: 0, max: 100 })
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.clear(input)
        await user.type(input, "25")
        await user.keyboard("{enter}")

        expect(input).toHaveDisplayValue("25")
      })

      it("formats value after committing valid FLOAT", async () => {
        const user = userEvent.setup()
        const props = getFloatProps({
          default: 10.0,
          min: 0,
          max: 100,
          format: "%0.1f",
        })
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.clear(input)
        await user.type(input, "25.7")
        await user.keyboard("{enter}")

        expect(input).toHaveDisplayValue("25.7")
      })

      it("formats value with custom format after commit", async () => {
        const user = userEvent.setup()
        const props = getFloatProps({
          default: 10.0,
          min: 0,
          max: 100,
          format: "%0.3f",
        })
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.clear(input)
        await user.type(input, "25.1")
        await user.keyboard("{enter}")

        expect(input).toHaveDisplayValue("25.1")
      })

      it("formats null value after clearing", async () => {
        const user = userEvent.setup()
        const props = getIntProps({ default: null, min: 0, max: 100 })
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.type(input, "25")
        await user.clear(input)
        await user.keyboard("{enter}")

        expect(input).toHaveDisplayValue("")
      })

      it("reverts to default when committing null with default value", async () => {
        const user = userEvent.setup()
        const props = getIntProps({ default: 42, min: 0, max: 100 })
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.clear(input)
        await user.keyboard("{enter}")

        expect(input).toHaveDisplayValue("42")
      })

      it("handles out-of-range values by not updating formatted value", async () => {
        const user = userEvent.setup()
        const props = getIntProps({ default: 10, min: 0, max: 50 })

        // Mock reportValidity to track if it's called
        const mockReportValidity = vi.fn()
        HTMLInputElement.prototype.reportValidity = mockReportValidity

        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.clear(input)
        await user.type(input, "100") // Above max
        await user.keyboard("{enter}")

        // Should not change the formatted value and call reportValidity
        expect(input).toHaveDisplayValue("100") // Still shows the invalid input
        expect(mockReportValidity).toHaveBeenCalled()

        // Cleanup
        HTMLInputElement.prototype.reportValidity = () => true
      })

      it.each([
        {
          description: "formats value after increment",
          step: 5,
          action: async (user: ReturnType<typeof userEvent.setup>) =>
            user.click(screen.getByTestId("stNumberInputStepUp")),
          expected: "15",
        },
        {
          description: "formats value after decrement",
          step: 3,
          action: async (user: ReturnType<typeof userEvent.setup>) =>
            user.click(screen.getByTestId("stNumberInputStepDown")),
          expected: "7",
        },
      ])("$description", async ({ step, action, expected }) => {
        const user = userEvent.setup()
        const props = getIntProps({ default: 10, step })
        render(<NumberInput {...props} />)

        await action(user)

        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          expected
        )
      })

      it("formats value when using arrow keys", async () => {
        const user = userEvent.setup()
        const props = getFloatProps({
          default: 10.0,
          step: 0.5,
          format: "%0.1f",
        })
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.type(input, "{arrowup}")

        expect(input).toHaveDisplayValue("10.5")
      })
    })

    describe("onChange formatting", () => {
      it("sets formatted value to null when input is empty", async () => {
        const user = userEvent.setup()
        const props = getIntProps({ default: 10 })
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.clear(input)

        expect(input).toHaveDisplayValue("")
      })

      it.each([
        {
          description: "sets formatted value to raw input for valid INT",
          propsFactory: () => getIntProps({ default: 10 }),
          inputValue: "25",
          expected: "25",
        },
        {
          description: "sets formatted value to raw input for valid FLOAT",
          propsFactory: () => getFloatProps({ default: 10.0 }),
          inputValue: "25.75",
          expected: "25.75",
        },
        {
          description: "handles negative number input",
          propsFactory: () => getIntProps({ default: 10, min: -100 }),
          inputValue: "-25",
          expected: "-25",
        },
        {
          description: "handles decimal input for INT type",
          propsFactory: () => getIntProps({ default: 10 }),
          inputValue: "25.7",
          expected: "25",
        },
        {
          description: "handles very long number input",
          propsFactory: () => getIntProps({ default: 10 }),
          inputValue: "123456789012345",
          expected: "123456789012345",
        },
        {
          description: "handles leading zeros",
          propsFactory: () => getIntProps({ default: 10 }),
          inputValue: "007",
          expected: "7",
        },
        {
          description: "handles scientific notation input",
          propsFactory: () => getFloatProps({ default: 10.0 }),
          inputValue: "1.5e3",
          expected: "1500",
        },
      ])("$description", async ({ propsFactory, inputValue, expected }) => {
        const user = userEvent.setup()
        const props = propsFactory()
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.clear(input)
        await user.type(input, inputValue)
        await user.type(input, "{enter}")

        expect(input).toHaveDisplayValue(expected)
      })
    })

    describe("updateFromProtobuf formatting", () => {
      it("formats value when updating from protobuf with setValue=true", () => {
        const props = getIntProps({ default: 10, value: 25, setValue: true })
        render(<NumberInput {...props} />)

        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          "25"
        )
      })

      it("formats FLOAT value from protobuf with custom format", () => {
        const props = getFloatProps({
          default: 10.0,
          value: 25.123,
          setValue: true,
          format: "%0.2f",
        })
        render(<NumberInput {...props} />)

        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          "25.12"
        )
      })

      it("formats null value from protobuf", () => {
        const props = getIntProps({
          default: 10,
          value: null,
          setValue: true,
        })
        render(<NumberInput {...props} />)

        // When value is null but default exists, it uses the default
        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          "10"
        )
      })

      it("formats value with step from protobuf", () => {
        const props = getFloatProps({
          default: 10.0,
          value: 25.0,
          setValue: true,
          step: 0.01,
        })
        render(<NumberInput {...props} />)

        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          "25.00"
        )
      })
    })

    describe("Edge cases and special values", () => {
      it.each([
        {
          description: "handles very small decimal numbers",
          propsFactory: () =>
            getFloatProps({
              default: 0.000001,
              format: "%0.6f",
            }),
          expected: "0.000001",
        },
        {
          description: "handles very large numbers",
          propsFactory: () =>
            getIntProps({
              default: 999999999999,
            }),
          expected: "999999999999",
        },
        {
          description: "handles formatting with different data types",
          propsFactory: () =>
            getIntProps({
              default: 42,
              format: "%0.2f",
            }),
          expected: "42.00",
        },
      ])("$description", ({ propsFactory, expected }) => {
        const props = propsFactory()
        render(<NumberInput {...props} />)

        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          expected
        )
      })

      it("handles multiple decimal points gracefully", async () => {
        const user = userEvent.setup()
        const props = getFloatProps({ default: 10.0 })
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.clear(input)
        await user.type(input, "25.5.5")

        // HTML number inputs normalize multiple decimal points
        expect(input).toHaveDisplayValue("25.55")
      })

      it("handles form clearing with formatted values", () => {
        const props = getFloatProps({
          formId: "form",
          default: 42.123,
          format: "%0.2f",
        })
        props.widgetMgr.setFormSubmitBehaviors("form", true)

        render(<NumberInput {...props} />)

        // Submit the form to trigger clearing
        act(() => {
          props.widgetMgr.submitForm("form", undefined)
        })

        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          "42.12"
        )
      })

      it("handles step changes and reformatting", () => {
        const props = getFloatProps({
          default: 1.0,
          step: 0.1,
        })
        const { rerender } = render(<NumberInput {...props} />)

        // Initially formatted with 1 decimal place
        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          "1.0"
        )

        // Change step to require more precision
        const newProps = getFloatProps({
          default: 1.0,
          step: 0.001,
        })
        rerender(<NumberInput {...newProps} />)

        // Should automatically reformat with new step precision
        expect(screen.getByTestId("stNumberInputField")).toHaveDisplayValue(
          "1.000"
        )
      })

      it("handles rapid user input changes", async () => {
        const user = userEvent.setup()
        const props = getIntProps({ default: 10 })
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")

        // Rapidly change values
        await user.clear(input)
        await user.type(input, "1")
        expect(input).toHaveDisplayValue("1")

        await user.type(input, "23")
        expect(input).toHaveDisplayValue("123")

        await user.keyboard("{backspace}{backspace}")
        expect(input).toHaveDisplayValue("1")
      })
    })

    describe("Typing behavior (FLOAT)", () => {
      it("does not reformat while focused when typing digits", async () => {
        const user = userEvent.setup()
        const props = getFloatProps({ default: 0.0, step: 0.01 })
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.clear(input)
        await user.type(input, "123")

        // Should show raw typed value without forcing decimal formatting yet
        expect(input).toHaveDisplayValue("123")
      })

      it("supports backspace correctly when typing a decimal value", async () => {
        const user = userEvent.setup()
        const props = getFloatProps({ default: 0.0 })
        render(<NumberInput {...props} />)

        const input = screen.getByTestId("stNumberInputField")
        await user.clear(input)
        await user.type(input, "12.3")
        expect(input).toHaveDisplayValue("12.3")

        await user.keyboard("{backspace}")
        expect(input).toHaveDisplayValue("12")
      })
    })
  })

  describe("Floating point precision", () => {
    // Note: Arithmetic correctness is tested in utils.test.ts.
    // These integration tests verify the component uses precise arithmetic
    // through different UI interaction paths.

    it("uses precise arithmetic via step buttons", async () => {
      const user = userEvent.setup()
      const props = getFloatProps({
        default: 0.1,
        step: 0.01,
        min: 0,
        max: 1,
      })
      render(<NumberInput {...props} />)

      const input = screen.getByTestId("stNumberInputField")
      const stepUpButton = screen.getByTestId("stNumberInputStepUp")

      // One click is enough to verify integration - arithmetic tested in utils
      await user.click(stepUpButton)

      // Should be 0.11, not 0.11000000000000001
      expect(input).toHaveValue(0.11)
    })

    it("uses precise arithmetic via arrow keys", async () => {
      const user = userEvent.setup()
      const props = getFloatProps({
        default: 0.3,
        step: 0.1,
        min: 0,
        max: 1,
      })
      render(<NumberInput {...props} />)

      const input = screen.getByTestId("stNumberInputField")
      await user.type(input, "{arrowdown}")

      // Should be 0.2, not 0.19999999999999998
      expect(input).toHaveValue(0.2)
    })

    it("maintains precision across mixed increment/decrement sequence", async () => {
      // This tests that precision is maintained when alternating operations,
      // which exercises the full component state cycle
      const user = userEvent.setup()
      const props = getFloatProps({
        default: 0.5,
        step: 0.01,
        min: 0,
        max: 1,
      })
      render(<NumberInput {...props} />)

      const input = screen.getByTestId("stNumberInputField")
      const stepUpButton = screen.getByTestId("stNumberInputStepUp")
      const stepDownButton = screen.getByTestId("stNumberInputStepDown")

      await user.click(stepUpButton) // 0.51
      await user.click(stepUpButton) // 0.52
      await user.click(stepDownButton) // 0.51

      expect(input).toHaveValue(0.51)
    })
  })
})

describe("NumberInput query param binding", () => {
  it("registers query param binding on mount when queryParamKey is set", () => {
    const props = getIntProps({ queryParamKey: "my_number" })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<NumberInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_number",
      "double_value",
      props.element.default,
      false,
      undefined
    )
  })

  it("unregisters query param binding on unmount", () => {
    const props = getIntProps({ queryParamKey: "my_number" })
    const unregisterSpy = vi.spyOn(
      props.widgetMgr,
      "unregisterQueryParamBinding"
    )

    const { unmount } = render(<NumberInput {...props} />)

    // Clear any calls from React Strict Mode's initial mount/unmount/remount cycle
    unregisterSpy.mockClear()

    unmount()

    expect(props.widgetMgr.unregisterQueryParamBinding).toHaveBeenCalledWith(
      props.element.id
    )
  })

  it("does not register query param binding when queryParamKey is not set", () => {
    const props = getIntProps()
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<NumberInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
  })

  it("registers with float default value", () => {
    const props = getProps({
      queryParamKey: "my_float",
      dataType: NumberInputProto.DataType.FLOAT,
      default: 3.14,
    })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<NumberInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_float",
      "double_value",
      3.14,
      false,
      undefined
    )
  })

  it("registers with clearable=true when no default", () => {
    const props = getProps({
      queryParamKey: "my_number",
      default: null,
    })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<NumberInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_number",
      "double_value",
      null,
      true,
      undefined
    )
  })
})
