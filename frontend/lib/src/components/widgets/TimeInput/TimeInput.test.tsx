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

    // The wrapper receives data-disabled explicitly from our component
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

    // granularity is always "minute" (2 spinbuttons) regardless of step
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

  it("preserves pending edit when external value changes before blur", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    const { rerender } = render(<TimeInput {...props} />)

    // Type a new hour (not committed — deferred to blur)
    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.keyboard("1")
    await user.keyboard("1")

    // Simulate external value change (e.g. fragment rerun)
    const updatedElement = TimeInputProto.create({
      ...props.element,
      default: "10:00",
      value: "10:00",
    })
    rerender(<TimeInput {...props} element={updatedElement} />)

    // Pending edit should be preserved, not overwritten by external update
    expect(hourSegment).toHaveAttribute("aria-valuenow", "11")
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

  it("snaps hour ArrowUp to next step boundary when step is multiple of hours (step=7200)", async () => {
    const user = userEvent.setup()
    // step=7200s → stepHours=2. value=12:45 → ArrowUp → 14:00 (minutes zeroed to grid)
    const props = getProps({ default: "12:45", step: 7200 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.keyboard("{ArrowUp}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "14:00",
      { fromUi: true },
      undefined
    )
  })

  it("snaps hour ArrowDown to previous step boundary when step is multiple of hours (step=7200)", async () => {
    const user = userEvent.setup()
    // step=7200s → stepHours=2. value=12:45 → ArrowDown → 10:00 (minutes zeroed to grid)
    const props = getProps({ default: "12:45", step: 7200 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.keyboard("{ArrowDown}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "10:00",
      { fromUi: true },
      undefined
    )
  })

  it("wraps minute ArrowUp to 00:00 for non-divisor step (step=4200, 70 min)", async () => {
    const user = userEvent.setup()
    // step=4200s → stepMins=70. value=23:20 (last boundary) → ArrowUp wraps to 00:00
    const props = getProps({ default: "23:20", step: 4200 })
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

  it("wraps minute ArrowDown to last boundary for non-divisor step (step=4200, 70 min)", async () => {
    const user = userEvent.setup()
    // step=4200s → stepMins=70. value=00:00 → ArrowDown wraps to 23:20 (last 70-min boundary)
    const props = getProps({ default: "00:00", step: 4200 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(minuteSegment)
    await user.keyboard("{ArrowDown}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "23:20",
      { fromUi: true },
      undefined
    )
  })

  it("wraps hour ArrowUp to 00 for non-divisor step (step=18000, 5 hours)", async () => {
    const user = userEvent.setup()
    // step=18000s → stepHours=5. value=20:30 → ArrowUp wraps to 00:00 (minutes zeroed)
    const props = getProps({ default: "20:30", step: 18000 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.keyboard("{ArrowUp}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "00:00",
      { fromUi: true },
      undefined
    )
  })

  it("wraps hour ArrowDown to last boundary for non-divisor step (step=18000, 5 hours)", async () => {
    const user = userEvent.setup()
    // step=18000s → stepHours=5. value=00:30 → ArrowDown wraps to 20:00 (minutes zeroed)
    const props = getProps({ default: "00:30", step: 18000 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.keyboard("{ArrowDown}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "20:00",
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
      undefined
    )
  })

  it("commits null for clearable widget when clear button is activated", async () => {
    const user = userEvent.setup()
    // No default + setValue → clearable widget with a current value
    const props = getProps({
      default: undefined,
      value: "12:45",
      setValue: true,
    })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    // The clear button is accessible via aria-label even though tabIndex={-1}
    const clearButton = screen.getByRole("button", { name: "Clear time" })
    await user.click(clearButton)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      null,
      { fromUi: true },
      undefined
    )

    // Segments should show placeholders after clearing
    const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
    expect(hourSegment).toHaveTextContent("HH")
    expect(minuteSegment).toHaveTextContent("mm")
  })

  it("does not commit on blur when value is unchanged", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    // Focus the last segment and tab out of the entire wrapper
    const segments = screen.getAllByRole("spinbutton")
    const lastSegment = segments[segments.length - 1]
    await user.click(lastSegment)
    await user.tab()

    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("commits value immediately when Enter is pressed on a spinbutton", async () => {
    const user = userEvent.setup()
    // Use step=900 so ArrowDown on the minute segment changes the value;
    // then verify Enter on the minute segment commits the updated display value.
    const props = getProps({ default: "12:45", step: 900 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [, minuteSegment] = screen.getAllByRole("spinbutton")

    // Arrow key changes the value immediately (committed via commitImmediatelyRef).
    await user.click(minuteSegment)
    await user.keyboard("{ArrowDown}")
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "12:30",
      { fromUi: true },
      undefined
    )
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    // Typed digits remain local until Enter commits them.
    await user.keyboard("10")
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()

    await user.keyboard("{Enter}")
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "12:10",
      { fromUi: true },
      undefined
    )
  })

  it("commits value on blur after a typed edit (deferred commit path)", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    // Focus the last segment (minute) so a single Tab leaves the wrapper entirely
    const segments = screen.getAllByRole("spinbutton")
    const minuteSegment = segments[segments.length - 1]
    await user.click(minuteSegment)

    // Type a new value — displayValue updates but commit is deferred to blur.
    await user.keyboard("30")
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()

    // Tab out from the last segment to blur the entire wrapper — triggers commit.
    await user.tab()
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "12:30",
      { fromUi: true },
      undefined
    )
  })

  it("writes to WidgetStateManager synchronously on blur when inside a form", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45", formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const segments = screen.getAllByRole("spinbutton")
    const minuteSegment = segments[segments.length - 1]
    await user.click(minuteSegment)
    await user.keyboard("30")

    // Before blur: no write yet (typing defers to blur)
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()

    // Blur triggers both the deferred path AND the synchronous form write
    await user.tab()
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "12:30",
      { fromUi: true },
      undefined
    )
    // Synchronous write ensures value is available before form submit runs
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(2)
  })

  it("does not double-write on blur when NOT inside a form", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const segments = screen.getAllByRole("spinbutton")
    const minuteSegment = segments[segments.length - 1]
    await user.click(minuteSegment)
    await user.keyboard("30")
    await user.tab()

    // Only the deferred effect write — no synchronous form write
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("does not double-commit when arrow key is followed by blur", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45", step: 900 })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const segments = screen.getAllByRole("spinbutton")
    const minuteSegment = segments[segments.length - 1]
    await user.click(minuteSegment)

    // Arrow key commits immediately
    await user.keyboard("{ArrowUp}")
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "13:00",
      { fromUi: true },
      undefined
    )
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    // Blur after arrow commit must NOT trigger a second commit
    await user.tab()
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("accepts pasted HH:MM values", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("08:30")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "08:30",
      { fromUi: true },
      undefined
    )
  })

  it("accepts pasted HHMM values without colon", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("0830")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "08:30",
      { fromUi: true },
      undefined
    )
  })

  it("accepts pasted 3-digit HMM values without colon", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("930")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "09:30",
      { fromUi: true },
      undefined
    )
  })

  it.each([
    {
      desc: "bare HHMM (2599)",
      paste: "2599",
      segment: "hour",
      expectedHour: "25",
      expectedMinute: "99",
    },
    {
      desc: "colon HH:MM (25:00)",
      paste: "25:00",
      segment: "hour",
      expectedHour: "25",
      expectedMinute: "00",
    },
    {
      desc: "partial minute (75)",
      paste: "75",
      segment: "minute",
      expectedHour: "12",
      expectedMinute: "75",
    },
  ])(
    "shows error and does not commit for out-of-range paste: $desc",
    async ({ paste, segment, expectedHour, expectedMinute }) => {
      const user = userEvent.setup()
      const props = getProps({ default: "12:45" })
      vi.spyOn(props.widgetMgr, "setStringValue")
      render(<TimeInput {...props} />)
      vi.mocked(props.widgetMgr.setStringValue).mockClear()

      const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
      const target = segment === "hour" ? hourSegment : minuteSegment
      await user.click(target)
      await user.paste(paste)

      expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()
      expect(screen.getByTestId("stTimeInputError")).toBeVisible()
      expect(hourSegment).toHaveTextContent(expectedHour)
      expect(minuteSegment).toHaveTextContent(expectedMinute)
    }
  )

  it("accepts partial paste of digits into the minute segment", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(minuteSegment)
    await user.paste("22")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "12:22",
      { fromUi: true },
      undefined
    )
  })

  it("accepts partial paste of digits into the hour segment", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("8")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "08:45",
      { fromUi: true },
      undefined
    )
  })

  it("does not commit and shows error for unrecognized paste formats", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")

    // Non-time text: silently ignored (no error, no commit)
    await user.click(hourSegment)
    await user.paste("not-a-time")
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()
    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()

    // Time-like text with colon but non-numeric: shows error
    await user.paste("ab:cd")
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()
    expect(screen.getByTestId("stTimeInputError")).toBeVisible()
  })

  it("clears paste override and error on next valid change", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("25:00")

    // Error is active
    expect(screen.getByTestId("stTimeInputError")).toBeVisible()
    expect(hourSegment).toHaveTextContent("25")

    // Now type a valid value — should clear the override and error
    await user.click(hourSegment)
    await user.paste("08:30")

    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
    expect(hourSegment).toHaveTextContent("08")
    expect(minuteSegment).toHaveTextContent("30")
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "08:30",
      { fromUi: true },
      undefined
    )
  })

  it("arrow key reverts to prior valid value when paste override is active", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(minuteSegment)
    await user.paste("08:99")

    // Override is active, showing invalid digits
    expect(hourSegment).toHaveTextContent("08")
    expect(minuteSegment).toHaveTextContent("99")
    expect(screen.getByTestId("stTimeInputError")).toBeVisible()

    // Press ArrowUp — should revert to prior value (12:45), not compute a step
    await user.keyboard("{ArrowUp}")

    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
    expect(hourSegment).toHaveTextContent("12")
    expect(minuteSegment).toHaveTextContent("45")
    // No new commit — just reverted display
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("shows both error icon and clear button on clearable input with invalid paste", async () => {
    const user = userEvent.setup()
    // No default → clearable
    const props = getProps({ default: undefined, value: "10:00" })
    render(<TimeInput {...props} />)

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("08:99")

    // Both icons should be visible
    expect(screen.getByTestId("stTimeInputError")).toBeVisible()
    expect(screen.getByTestId("stTimeInputClearButton")).toBeVisible()
    // Pasted digits displayed
    expect(hourSegment).toHaveTextContent("08")
    const [, minuteSegment] = screen.getAllByRole("spinbutton")
    expect(minuteSegment).toHaveTextContent("99")
  })

  it("clear button dismisses paste override on clearable input", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: undefined })
    vi.spyOn(props.widgetMgr, "setStringValue")
    vi.spyOn(props.widgetMgr, "getStringValue").mockReturnValue("10:00")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("25:00")

    expect(screen.getByTestId("stTimeInputError")).toBeVisible()

    // Click clear
    await user.click(screen.getByTestId("stTimeInputClearButton"))

    // Error and override should be gone
    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
    // Value committed as null (cleared)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      null,
      { fromUi: true },
      undefined
    )
  })

  it("clear button on empty value dismisses paste error without triggering rerun", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: undefined, value: undefined })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("25:00")

    expect(screen.getByTestId("stTimeInputError")).toBeVisible()

    // Click clear — value is already null so no value write should happen
    await user.click(screen.getByTestId("stTimeInputClearButton"))

    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("clears paste override and error when backend value changes externally", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    const { rerender } = render(<TimeInput {...props} />)

    const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("08:99")

    expect(screen.getByTestId("stTimeInputError")).toBeVisible()
    expect(hourSegment).toHaveTextContent("08")
    expect(minuteSegment).toHaveTextContent("99")

    // Simulate external value update (e.g. session_state setValue call).
    // useBasicWidgetState detects this via element.setValue = true.
    const updatedElement = TimeInputProto.create({
      id: "123",
      label: "Label",
      default: "12:45",
      value: "15:30",
      setValue: true,
      step: 900,
    })
    rerender(
      <TimeInput
        element={updatedElement}
        disabled={false}
        widgetMgr={props.widgetMgr}
      />
    )

    // Error and override should be cleared
    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
    expect(hourSegment).toHaveTextContent("15")
    expect(minuteSegment).toHaveTextContent("30")
  })

  it("clears paste error on external update even with uncommitted local edits", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    const { rerender } = render(<TimeInput {...props} />)

    const [hourSegment] = screen.getAllByRole("spinbutton")

    // Type a digit (changes displayValue, creating uncommitted local edit)
    await user.click(hourSegment)
    await user.keyboard("11")

    // Now paste invalid — sets pasteOverride + validationError
    await user.paste("25:00")
    expect(screen.getByTestId("stTimeInputError")).toBeVisible()

    // External value update arrives while local edit + paste error are active
    const updatedElement = TimeInputProto.create({
      id: "123",
      label: "Label",
      default: "12:45",
      value: "15:30",
      setValue: true,
      step: 900,
    })
    rerender(
      <TimeInput
        element={updatedElement}
        disabled={false}
        widgetMgr={props.widgetMgr}
      />
    )

    // Paste error should be cleared even though displayValue !== prevValue
    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
  })

  it("typed input after arrow-key revert still defers commit to blur", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(minuteSegment)
    await user.paste("08:99")

    expect(screen.getByTestId("stTimeInputError")).toBeVisible()

    // Arrow revert
    await user.keyboard("{ArrowUp}")
    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()

    // Now type a digit into the hour segment — should NOT commit immediately
    await user.click(hourSegment)
    await user.keyboard("1")

    // The typed digit should update the display but NOT commit (deferred to blur)
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("renders visually-hidden alert with error message for screen readers", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    render(<TimeInput {...props} />)

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("25:00")

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(
      "Error: time 25:00 is invalid. Time is out of range. Hours must be 0–23, minutes 0–59."
    )
  })

  it("alert includes displayed digits when they differ from accessible value", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    render(<TimeInput {...props} />)

    const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("25:99")

    // Accessible values still reflect the last valid time
    expect(hourSegment).toHaveAttribute("aria-valuenow", "12")
    expect(minuteSegment).toHaveAttribute("aria-valuenow", "45")
    // But alert communicates what is visually displayed
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("time 25:99 is invalid")
  })

  it("alert uses generic message when no paste override is active", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" })
    render(<TimeInput {...props} />)

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("ab:cd")

    // Unrecognized colon format — error without pasteOverride
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(
      "Error: Invalid time format. Please use HH:MM."
    )
    expect(alert).not.toHaveTextContent("is invalid")
  })

  it("accepts paste into an empty (cleared) field", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: undefined, value: undefined })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("16:45")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "16:45",
      { fromUi: true },
      undefined
    )
    expect(hourSegment).toHaveTextContent("16")
    expect(minuteSegment).toHaveTextContent("45")
  })

  it("clears paste error state when form is cleared", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form", default: "12:45" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)
    render(<TimeInput {...props} />)

    const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("25:00")

    expect(screen.getByTestId("stTimeInputError")).toBeVisible()
    expect(hourSegment).toHaveTextContent("25")

    // Submit form (triggers form clear)
    act(() => {
      props.widgetMgr.submitForm("form", undefined)
    })

    // Paste error and override should be cleared
    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
    expect(hourSegment).toHaveTextContent("12")
    expect(minuteSegment).toHaveTextContent("45")
  })

  it("ignores paste when widget is disabled", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "12:45" }, true)
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("08:30")

    // Should not commit and not show error — paste is silently ignored
    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()
    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
    expect(hourSegment).toHaveAttribute("aria-valuenow", "12")
  })

  it("arrow key dismisses paste error on empty (cleared) field", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: undefined, value: undefined })
    render(<TimeInput {...props} />)

    const [hourSegment, minuteSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("25:99")

    // Error is active on an empty field
    expect(screen.getByTestId("stTimeInputError")).toBeVisible()
    expect(hourSegment).toHaveTextContent("25")
    expect(minuteSegment).toHaveTextContent("99")

    // Arrow key should dismiss the error even though displayValue is null
    await user.keyboard("{ArrowUp}")
    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
  })

  it("blur clears paste error state", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<TimeInput {...props} />)

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("25:00")

    // Error is active
    expect(screen.getByTestId("stTimeInputError")).toBeVisible()

    // Blur the widget by tabbing out
    await user.tab()
    await user.tab()

    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
  })

  it("blur clears paste error and commits typed value when both are pending", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)
    vi.mocked(props.widgetMgr.setStringValue).mockClear()

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)

    // Type a digit (changes displayValue but doesn't commit yet)
    await user.keyboard("11")

    // Now paste an invalid value — sets pasteOverride + validationError
    await user.paste("25:00")
    expect(screen.getByTestId("stTimeInputError")).toBeVisible()

    // Blur commits the typed value AND clears paste error
    await user.tab()
    await user.tab()

    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
    // The typed value (11:45) was committed
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "11:45",
      { fromUi: true },
      undefined
    )
  })

  it("Enter clears paste error state", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<TimeInput {...props} />)

    const [hourSegment] = screen.getAllByRole("spinbutton")
    await user.click(hourSegment)
    await user.paste("25:00")

    // Error is active
    expect(screen.getByTestId("stTimeInputError")).toBeVisible()

    // Enter should dismiss the paste error
    await user.keyboard("{Enter}")
    expect(screen.queryByTestId("stTimeInputError")).not.toBeInTheDocument()
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

  it("shows HH:mm placeholder text when value is null", () => {
    const props = getProps({ default: undefined })
    render(<TimeInput {...props} />)

    const segments = screen.getAllByRole("spinbutton")
    expect(segments[0]).toHaveTextContent("HH")
    expect(segments[1]).toHaveTextContent("mm")
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
