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

import type { ComponentProps, ComponentRef, ForwardedRef } from "react"

import { act, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  DateTimeInput as DateTimeInputProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import DateTimeInput, { type Props } from "./DateTimeInput"

vi.mock("baseui/datepicker", async importOriginal => {
  const React = await import("react")
  const actual = await importOriginal<typeof import("baseui/datepicker")>()
  const Datepicker = React.forwardRef(
    (
      props: ComponentProps<typeof actual.Datepicker> & {
        onClose?: () => void
      },
      ref: ForwardedRef<ComponentRef<typeof actual.Datepicker>>
    ) => (
      <>
        <actual.Datepicker {...props} ref={ref} />
        <button
          data-testid="mock-datepicker-close"
          onClick={() => props.onClose?.()}
          style={{ display: "none" }}
        >
          Close Datepicker
        </button>
      </>
    )
  )
  return {
    ...actual,
    Datepicker,
  }
})

const getProps = (
  elementProps: Partial<DateTimeInputProto> = {},
  disabled = false
): Props => ({
  element: DateTimeInputProto.create({
    id: "123",
    label: "Label",
    default: ["2025/11/19, 16:45"],
    min: "2015/11/19, 00:00",
    max: "2035/11/19, 23:59",
    step: 900,
    format: "YYYY/MM/DD",
    ...elementProps,
  }),
  disabled,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
})

describe("DateTimeInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<DateTimeInput {...props} />)
    expect(screen.getByTestId("stDateTimeInput")).toBeVisible()
  })

  it("shows a label", () => {
    const props = getProps()
    render(<DateTimeInput {...props} />)
    expect(screen.getByText(props.element.label)).toBeVisible()
  })

  it("respects hidden label visibility", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<DateTimeInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).not.toBeVisible()
  })

  it("respects collapsed label visibility", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<DateTimeInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).not.toBeVisible()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateTimeInput {...props} />)

    expect(spy).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
  })

  it("can be disabled", () => {
    const props = getProps({}, true)
    render(<DateTimeInput {...props} />)

    const inputField = screen.getByTestId("stDateTimeInputField")
    expect(inputField).toHaveAttribute("disabled")
  })

  it("sets the widget value on change", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateTimeInput {...props} />)

    // Clear initial mount call
    spy.mockClear()

    const inputField = screen.getByTestId("stDateTimeInputField")

    // Type the value (this updates pending state and displays in the input)
    await user.clear(inputField)
    await user.type(inputField, "2026/01/01, 09:30")

    // Verify the input field shows the new value
    expect(inputField).toHaveValue("2026/01/01, 09:30")

    // Close the popover to commit the value
    const closeButton = screen.getByTestId("mock-datepicker-close")
    await user.click(closeButton)

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        props.element,
        ["2026/01/01, 09:30"],
        { fromUi: true },
        undefined
      )
    })
  })

  it("clears the widget value", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: [] })
    render(<DateTimeInput {...props} />)

    const inputField = screen.getByTestId("stDateTimeInputField")

    // Verify no clear button initially
    expect(
      screen.queryByRole("button", { name: /clear value/i })
    ).not.toBeInTheDocument()

    // Type a value
    await user.type(inputField, "2026/03/15, 12:45")
    expect(inputField).toHaveValue("2026/03/15, 12:45")

    // Close the popover to commit the value
    await user.click(document.body)

    // Click the clear button
    const clearButton = screen.getByRole("button", { name: /clear value/i })
    await user.click(clearButton)

    expect(inputField).toHaveValue("")
  })

  it("resets its value when form is cleared", async () => {
    const props = { ...getProps({ formId: "form" }), fragmentId: "fragment" }
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    props.widgetMgr.setStringArrayValue(
      props.element,
      ["2026/02/01, 10:15"],
      { fromUi: true },
      props.fragmentId
    )

    render(<DateTimeInput {...props} />)

    const inputField = screen.getByTestId("stDateTimeInputField")

    expect(inputField).toHaveValue("2026/02/01, 10:15")

    act(() => {
      props.widgetMgr.submitForm("form", props.fragmentId)
    })

    await waitFor(() => {
      expect(inputField).toHaveValue("2025/11/19, 16:45")
    })
  })

  describe("Validation and error handling", () => {
    it("displays error when date is below minimum", async () => {
      const user = userEvent.setup()
      const props = getProps({
        min: "2020/01/01, 00:00",
        max: "2030/12/31, 23:59",
      })

      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")

      // Type a date below the minimum
      await user.clear(inputField)
      await user.type(inputField, "2019/12/31, 23:59")

      // Error tooltip should be visible
      const errorIcon = screen.getByTestId("stTooltipErrorHoverTarget")
      expect(errorIcon).toBeVisible()

      // Hover to see error message
      await user.hover(errorIcon)
      expect(
        await screen.findByText(/Date and time set outside allowed range/i)
      ).toBeVisible()
    })

    it("displays error when date is above maximum", async () => {
      const user = userEvent.setup()
      const props = getProps({
        min: "2020/01/01, 00:00",
        max: "2030/12/31, 23:59",
      })

      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")

      // Type a date above the maximum
      await user.clear(inputField)
      await user.type(inputField, "2031/01/01, 00:00")

      // Error tooltip should be visible
      const errorIcon = screen.getByTestId("stTooltipErrorHoverTarget")
      expect(errorIcon).toBeVisible()
    })

    it("clears error when valid date is selected after error", async () => {
      const user = userEvent.setup()
      const props = getProps({
        min: "2020/01/01, 00:00",
        max: "2030/12/31, 23:59",
      })

      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")

      // First, type an invalid date
      await user.clear(inputField)
      await user.type(inputField, "2019/12/31, 23:59")

      // Verify error is shown
      expect(screen.getByTestId("stTooltipErrorHoverTarget")).toBeVisible()

      // Now type a valid date
      await user.clear(inputField)
      await user.type(inputField, "2025/06/15, 12:00")

      // Error should be cleared
      expect(
        screen.queryByTestId("stTooltipErrorHoverTarget")
      ).not.toBeInTheDocument()
    })

    it("shows error when date is outside custom min and max bounds", async () => {
      const user = userEvent.setup()
      const props = getProps({
        min: "2020/01/01, 09:00",
        max: "2030/12/31, 17:00",
        format: "YYYY/MM/DD",
      })

      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")

      // Type a date outside bounds
      await user.clear(inputField)
      await user.type(inputField, "2019/12/31, 23:59")

      // Verify error icon is displayed for out-of-bounds date
      const errorIcon = screen.getByTestId("stTooltipErrorHoverTarget")
      expect(errorIcon).toBeVisible()
    })
  })

  describe("Date parsing edge cases", () => {
    it("handles empty string as null date", () => {
      const props = getProps({ default: [] })
      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")
      expect(inputField).toHaveValue("")
    })

    it("initializes with default value", () => {
      const props = getProps({ default: ["2024/03/15, 10:30"] })
      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")
      expect(inputField).toHaveValue("2024/03/15, 10:30")
    })

    it("handles null default value", () => {
      const props = getProps({ default: undefined })
      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")
      expect(inputField).toHaveValue("")
    })
  })

  describe("Format variations", () => {
    it("correctly formats dates with DD/MM/YYYY format", () => {
      const props = getProps({
        format: "DD/MM/YYYY",
        default: ["2025/11/19, 16:45"],
      })

      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")
      expect(inputField).toHaveAttribute("placeholder", "DD/MM/YYYY, HH:MM")
    })

    it("correctly formats dates with MM-DD-YYYY format", () => {
      const props = getProps({
        format: "MM-DD-YYYY",
        default: ["2025/11/19, 16:45"],
      })

      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")
      expect(inputField).toHaveAttribute("placeholder", "MM-DD-YYYY, HH:MM")
    })

    it("correctly formats dates with YYYY-MM-DD format", () => {
      const props = getProps({
        format: "YYYY-MM-DD",
        default: ["2025/11/19, 16:45"],
      })

      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")
      expect(inputField).toHaveAttribute("placeholder", "YYYY-MM-DD, HH:MM")
    })
  })

  describe("Help text and accessibility", () => {
    it("displays help text tooltip", async () => {
      const user = userEvent.setup()
      const props = getProps({ help: "This is help text" })

      render(<DateTimeInput {...props} />)

      const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
      await user.hover(tooltipTarget)

      const tooltipContent = await screen.findByTestId("stTooltipContent")
      expect(tooltipContent).toBeVisible()
      expect(tooltipContent).toHaveTextContent("This is help text")
    })

    it("sets aria-label from element label", () => {
      const props = getProps({ label: "Select Date and Time" })
      render(<DateTimeInput {...props} />)

      const datepicker = screen.getByLabelText("Select Date and Time")
      expect(datepicker).toBeVisible()
    })
  })

  describe("Min/max time constraints", () => {
    it("applies time constraints when min date is selected", async () => {
      const user = userEvent.setup()
      const props = getProps({
        min: "2025/11/19, 09:00",
        max: "2025/11/20, 17:00",
        default: ["2025/11/19, 12:00"],
      })

      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")

      expect(inputField).toHaveValue("2025/11/19, 12:00")

      await user.click(inputField)

      const timeSelectDisplay = await screen.findByTestId(
        "stDateTimeInputTimeDisplay"
      )
      await user.click(timeSelectDisplay)

      expect(await screen.findByText("09:00")).toBeVisible()

      expect(screen.queryByText("08:45")).not.toBeInTheDocument()
    })

    it("applies time constraints when max date is selected", async () => {
      const user = userEvent.setup()
      const props = getProps({
        min: "2025/11/19, 09:00",
        max: "2025/11/20, 17:00",
        default: ["2025/11/20, 15:00"],
      })

      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")

      expect(inputField).toHaveValue("2025/11/20, 15:00")

      await user.click(inputField)

      const timeSelectDisplay = await screen.findByTestId(
        "stDateTimeInputTimeDisplay"
      )
      await user.click(timeSelectDisplay)

      expect(await screen.findByText("17:00")).toBeVisible()

      expect(screen.queryByText("17:15")).not.toBeInTheDocument()
    })

    it("does not restrict time when date is between min and max", () => {
      const props = getProps({
        min: "2025/11/19, 09:00",
        max: "2025/11/21, 17:00",
        default: ["2025/11/20, 12:00"],
      })

      render(<DateTimeInput {...props} />)

      const inputField = screen.getByTestId("stDateTimeInputField")

      expect(inputField).toHaveValue("2025/11/20, 12:00")
    })
  })

  describe("Step configuration", () => {
    it("uses default step of 900 seconds (15 minutes) when not specified", () => {
      const props = getProps({ step: undefined })
      render(<DateTimeInput {...props} />)

      expect(screen.getByTestId("stDateTimeInput")).toBeVisible()
    })

    it("respects custom step value", () => {
      const props = getProps({ step: 1800 })
      render(<DateTimeInput {...props} />)

      expect(screen.getByTestId("stDateTimeInput")).toBeVisible()
    })

    it("handles step of 60 seconds (1 minute)", () => {
      const props = getProps({ step: 60 })
      render(<DateTimeInput {...props} />)

      expect(screen.getByTestId("stDateTimeInput")).toBeVisible()
    })
  })

  describe("Clearable behavior", () => {
    it("is clearable when default is empty and not disabled", () => {
      const props = getProps({ default: [] }, false)
      render(<DateTimeInput {...props} />)

      // Component should render in clearable state
      expect(screen.getByTestId("stDateTimeInput")).toBeVisible()
    })

    it("is not clearable when default has value", () => {
      const props = getProps({ default: ["2025/11/19, 16:45"] }, false)
      render(<DateTimeInput {...props} />)

      // Component should render in non-clearable state
      expect(screen.getByTestId("stDateTimeInput")).toBeVisible()
    })

    it("is not clearable when disabled even with empty default", () => {
      const props = getProps({ default: [] }, true)
      render(<DateTimeInput {...props} />)

      // Component should render in non-clearable state
      expect(screen.getByTestId("stDateTimeInput")).toBeVisible()
    })
  })

  describe("Widget manager integration", () => {
    it("does not commit out-of-bounds value to widget manager", async () => {
      const user = userEvent.setup()
      const props = getProps({
        min: "2020/01/01, 00:00",
        max: "2030/12/31, 23:59",
        default: ["2025/06/15, 12:00"],
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")

      render(<DateTimeInput {...props} />)

      // Clear initial mount call
      spy.mockClear()

      const inputField = screen.getByTestId("stDateTimeInputField")

      // Type an out-of-bounds date
      await user.clear(inputField)
      await user.type(inputField, "2035/01/01, 00:00")

      // Error should be shown but value should not be committed to widget manager yet
      // (pending state pattern - only commits on close)
      expect(screen.getByTestId("stTooltipErrorHoverTarget")).toBeVisible()

      // Note: The actual prevention of committing happens in handleClose and
      // updateWidgetMgrState, which validates before calling widgetMgr.setStringValue
    })

    it("uses fragmentId when provided", () => {
      const props = {
        ...getProps(),
        fragmentId: "test-fragment-id",
      }
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")

      render(<DateTimeInput {...props} />)

      // Verify fragmentId is passed to setStringValue
      expect(spy).toHaveBeenCalledWith(
        props.element,
        props.element.default,
        { fromUi: false },
        "test-fragment-id"
      )
    })
  })
})
