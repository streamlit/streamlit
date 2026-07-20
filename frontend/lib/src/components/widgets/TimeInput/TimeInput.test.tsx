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
  TimeInput as TimeInputProto,
} from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import TimeInput, { Props } from "./TimeInput"

const getProps = (
  elementProps: Partial<TimeInputProto> = {},
  disabled = false
): Props => ({
  element: TimeInputProto.create({
    id: "123",
    label: "Label",
    default: "12:45",
    step: 900,
    ...elementProps,
  }),
  disabled: disabled,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
})

describe("TimeInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<TimeInput {...props} />)
    const timeDisplay = screen.getByTestId("stTimeInputTimeDisplay")
    expect(timeDisplay).toBeInTheDocument()
  })

  it("shows a label", () => {
    const props = getProps()
    render(<TimeInput {...props} />)
    const widgetLabel = screen.getByText(props.element.label)
    expect(widgetLabel).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<TimeInput {...props} />)

    const widgetLabel = screen.getByTestId("stWidgetLabel")
    expect(widgetLabel).toHaveStyle("visibility: hidden")
    expect(widgetLabel).not.toBeVisible()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<TimeInput {...props} />)

    const widgetLabel = screen.getByTestId("stWidgetLabel")
    expect(widgetLabel).toHaveStyle("display: none")
    expect(widgetLabel).not.toBeVisible()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
  })

  it("can pass fragmentId to setStringValue", () => {
    const props = { ...getProps(), fragmentId: "myFragmentId" }
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      "myFragmentId"
    )
  })

  it("has correct className", () => {
    const props = getProps()
    render(<TimeInput {...props} />)

    const timeInput = screen.getByTestId("stTimeInput")
    expect(timeInput).toHaveClass("stTimeInput")
  })

  it("can be disabled", () => {
    const props = getProps({}, true)
    render(<TimeInput {...props} />)
    const widgetLabel = screen.getByTestId("stWidgetLabel")
    expect(widgetLabel).toHaveAttribute("disabled")

    // React Aria sets data-disabled on the DateInput container when isDisabled
    const timeDisplay = screen.getByTestId("stTimeInputTimeDisplay")
    expect(timeDisplay).toHaveAttribute("data-disabled")

    // Spinbuttons themselves must also be disabled
    const spinbuttons = screen.getAllByRole("spinbutton")
    for (const seg of spinbuttons) {
      expect(seg).toHaveAttribute("data-disabled")
      expect(seg).toHaveAttribute("aria-disabled", "true")
    }
  })

  it("has the correct default value", () => {
    const props = getProps()
    render(<TimeInput {...props} />)

    // React Aria renders hour and minute as individual spinbutton segments.
    // aria-valuenow holds the numeric value for each.
    const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
    expect(hourSegment).toHaveAttribute("aria-valuenow", "12")
    expect(minuteSegment).toHaveAttribute("aria-valuenow", "45")
  })

  it("shows only hour and minute segments (no seconds)", () => {
    const props = getProps()
    render(<TimeInput {...props} />)

    // Default step=900s (divisible by 60) → granularity="minute" → 2 spinbuttons
    const segments = screen.getAllByRole("spinbutton")
    expect(segments).toHaveLength(2)
  })

  it("always shows hour and minute segments even when step is divisible by 3600", () => {
    const props = getProps({ step: 3600 })
    render(<TimeInput {...props} />)

    const segments = screen.getAllByRole("spinbutton")
    expect(segments).toHaveLength(2)
  })

  it("has 24-hour format", () => {
    const props = getProps()
    render(<TimeInput {...props} />)

    // With hourCycle=24 there should be no AM/PM (dayPeriod) segment
    const timeDisplay = screen.getByTestId("stTimeInputTimeDisplay")
    const dayPeriodSegment = timeDisplay.querySelector(
      '[data-type="dayPeriod"]'
    )
    expect(dayPeriodSegment).toBeNull()

    // The hour spinbutton should have a 0–23 range
    const [hourSegment] = screen.getAllByRole("spinbutton")
    expect(hourSegment).toHaveAttribute("aria-valuemin", "0")
    expect(hourSegment).toHaveAttribute("aria-valuemax", "23")
  })

  it("sets the widget value on change", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TimeInput {...props} />)

    // Decrement the hour segment from 12 to 11
    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.keyboard("{ArrowDown}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "11:45",
      { fromUi: true },
      undefined
    )
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TimeInput {...props} />)

    // Change the hour from 12 to 11
    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.keyboard("{ArrowDown}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "11:45",
      { fromUi: true },
      undefined
    )

    // Submit the form
    act(() => {
      props.widgetMgr.submitForm("form", undefined)
    })

    // Widget should reset to the default value
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      { fromUi: true },
      undefined
    )

    // Segments should reflect the reset value
    const [hourAfter, minuteAfter] = screen.getAllByRole("spinbutton")
    expect(hourAfter).toHaveAttribute("aria-valuenow", "12")
    expect(minuteAfter).toHaveAttribute("aria-valuenow", "45")
  })

  it("snaps minute ArrowUp to next step boundary (on-step value)", async () => {
    const user = userEvent.setup()
    // step=900s → stepMins=15. value=12:45 → next boundary up = 13:00
    const props = getProps({ default: "12:45", step: 900 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(minuteSegment)
    await user.keyboard("{ArrowUp}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "13:00",
      { fromUi: true },
      undefined
    )
  })

  it("snaps minute ArrowDown to previous step boundary (on-step value)", async () => {
    const user = userEvent.setup()
    // step=900s → stepMins=15. value=12:45 → next boundary down = 12:30
    const props = getProps({ default: "12:45", step: 900 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(minuteSegment)
    await user.keyboard("{ArrowDown}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "12:30",
      { fromUi: true },
      undefined
    )
  })

  it("snaps minute ArrowUp toward nearest boundary above for off-step values", async () => {
    const user = userEvent.setup()
    // step=900s → stepMins=15. value=12:07 (off-step) → boundary above = 12:15
    const props = getProps({ default: "12:07", step: 900 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(minuteSegment)
    await user.keyboard("{ArrowUp}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "12:15",
      { fromUi: true },
      undefined
    )
  })

  it("snaps minute ArrowDown toward nearest boundary below for off-step values", async () => {
    const user = userEvent.setup()
    // step=900s → stepMins=15. value=12:07 (off-step) → boundary below = 12:00
    const props = getProps({ default: "12:07", step: 900 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(minuteSegment)
    await user.keyboard("{ArrowDown}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "12:00",
      { fromUi: true },
      undefined
    )
  })

  it("wraps forward past midnight on minute ArrowUp", async () => {
    const user = userEvent.setup()
    // step=900s → stepMins=15. value=23:45 → ArrowUp → 00:00 (wraps)
    const props = getProps({ default: "23:45", step: 900 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(minuteSegment)
    await user.keyboard("{ArrowUp}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "00:00",
      { fromUi: true },
      undefined
    )
  })

  it("wraps backward past midnight on minute ArrowDown", async () => {
    const user = userEvent.setup()
    // step=900s → stepMins=15. value=00:00 → ArrowDown → 23:45 (wraps)
    const props = getProps({ default: "00:00", step: 900 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(minuteSegment)
    await user.keyboard("{ArrowDown}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "23:45",
      { fromUi: true },
      undefined
    )
  })

  it("falls through to react-aria ±1 default when step=60 (stepMins=1)", async () => {
    const user = userEvent.setup()
    // step=60s → stepMins=1: our guard returns early; react-aria decrements by 1
    const props = getProps({ default: "12:45", step: 60 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(minuteSegment)
    await user.keyboard("{ArrowDown}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "12:44",
      { fromUi: true },
      undefined
    )
  })

  it("does not intercept hour segment ArrowDown (react-aria default ±1 hour)", async () => {
    const user = userEvent.setup()
    // step=900s: hour segment is not intercepted; react-aria does ±1 hour
    const props = getProps({ default: "12:45", step: 900 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.keyboard("{ArrowDown}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "11:45",
      { fromUi: true },
      undefined
    )
  })

  it("does not commit null for non-clearable widget when a segment is cleared mid-edit", async () => {
    const user = userEvent.setup()
    // Widget with a default is non-clearable
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)

    // Clear the spy's mount call
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    // Backspace clears a segment, which causes React Aria to fire onChange(null)
    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.keyboard("{Backspace}")

    // The null guard must prevent setStringValue from being called with null
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalledWith(
      props.element,
      null,
      expect.any(Object),
      expect.anything()
    )
  })
})

describe("TimeInput query param binding", () => {
  it("registers query param binding on mount when queryParamKey is set", () => {
    const props = getProps({ queryParamKey: "my_time" })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<TimeInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_time",
      "string_value",
      "12:45",
      false,
      undefined
    )
  })

  it("unregisters query param binding on unmount", () => {
    const props = getProps({ queryParamKey: "my_time" })
    const unregisterSpy = vi.spyOn(
      props.widgetMgr,
      "unregisterQueryParamBinding"
    )

    const { unmount } = render(<TimeInput {...props} />)

    unregisterSpy.mockClear()
    unmount()

    expect(props.widgetMgr.unregisterQueryParamBinding).toHaveBeenCalledWith(
      props.element.id
    )
  })

  it("does not register query param binding when queryParamKey is not set", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<TimeInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
  })

  it("registers with clearable=true when default is empty", () => {
    const props = getProps({ queryParamKey: "my_time", default: undefined })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<TimeInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_time",
      "string_value",
      null,
      true,
      undefined
    )
  })
})

describe("TimeInput clearable behavior", () => {
  it("shows clear button and clears the value when clicked", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: undefined })
    vi.spyOn(props.widgetMgr, "setStringValue")
    // Simulate a pre-existing value (e.g., set via query param or previous interaction)
    vi.spyOn(props.widgetMgr, "getStringValue").mockReturnValue("12:00")
    render(<TimeInput {...props} />)

    // Clear button should be visible because the widget has a value but no default
    const clearButton = screen.getByTestId("stTimeInputClearButton")
    expect(clearButton).toBeVisible()

    await user.click(clearButton)

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      null,
      { fromUi: true },
      undefined
    )
  })

  it("does not render clear button when widget has a default", () => {
    const props = getProps({ default: "10:30" })
    render(<TimeInput {...props} />)

    // Clear button must not be present when clearable is false
    expect(screen.queryByTestId("stTimeInputClearButton")).toBeNull()
  })

  it("reads value from element when set_value flag is true", () => {
    const props = getProps({
      default: "10:30",
      value: "16:00",
      setValue: true,
    })
    render(<TimeInput {...props} />)

    const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
    expect(hourSegment).toHaveAttribute("aria-valuenow", "16")
    expect(minuteSegment).toHaveAttribute("aria-valuenow", "0")
  })
})
