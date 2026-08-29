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

import { act, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  DateTimeInput as DateTimeInputProto,
  LabelVisibility as LabelVisibilityProto,
} from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import DateTimeInput, { type Props } from "./DateTimeInput"

/** Backspaces a segment back to its empty placeholder state.
 * React Aria removes one character per Backspace, so we need
 * one keypress per displayed digit. */
const clearSegment = async (
  user: ReturnType<typeof userEvent.setup>,
  segment: HTMLElement
): Promise<void> => {
  await user.click(segment)
  const digitCount = segment.textContent?.length ?? 0
  for (let i = 0; i < digitCount; i++) {
    await user.keyboard("{Backspace}")
  }
}

const getProps = (
  elementProps: Partial<DateTimeInputProto> = {},
  disabled = false
): Props => ({
  element: DateTimeInputProto.create({
    id: "123",
    label: "Label",
    default: ["2025-11-19T16:45"],
    min: "2015-11-19T00:00",
    max: "2035-11-19T23:59",
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
        value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<DateTimeInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).not.toBeVisible()
  })

  it("respects collapsed label visibility", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<DateTimeInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).not.toBeVisible()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateTimeInput {...props} />)

    expect(spy).toHaveBeenCalledWith(props.element.id, props.element.default, {
      formId: props.element.formId,
      fragmentId: undefined,
      fromUser: false,
    })
  })

  it("renders date and time segments with default value", () => {
    const props = getProps({ default: ["2025-03-15T10:30"] })
    render(<DateTimeInput {...props} />)

    const segments = screen.getAllByRole("spinbutton")
    expect(segments.length).toBeGreaterThanOrEqual(5)
  })

  it("can be disabled", () => {
    const props = getProps({}, true)
    render(<DateTimeInput {...props} />)

    const field = screen.getByTestId("stDateTimeInputField")
    expect(field).toHaveAttribute("data-disabled")
  })

  it("opens calendar popover on focus", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<DateTimeInput {...props} />)

    expect(
      screen.queryByTestId("stDateTimeInputCalendar")
    ).not.toBeInTheDocument()

    const segments = screen.getAllByRole("spinbutton")
    await user.click(segments[0])

    expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()
  })

  it("Escape closes the month picker without closing the calendar", async () => {
    const user = userEvent.setup()
    render(<DateTimeInput {...getProps()} />)

    await user.click(screen.getAllByRole("spinbutton")[0])
    const calendar = screen.getByTestId("stDateTimeInputCalendar")
    await user.click(within(calendar).getByRole("button", { name: "month" }))

    expect(screen.getByTestId("stDateInputHeaderPickerPopover")).toHaveClass(
      "stDateInputHeaderPickerPopover"
    )

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputHeaderPickerPopover")
      ).not.toBeInTheDocument()
    })
    expect(calendar).toBeVisible()
  })

  // CalendarPopoverHeader is shared with st.date_input, so the year-boundary
  // regression in #16686 applies here too.
  it("year picker lists the boundary year when min/max cross a year", async () => {
    const user = userEvent.setup()
    render(
      <DateTimeInput
        {...getProps({
          min: "2024-08-03T00:00",
          max: "2025-02-03T23:59",
          default: ["2025-02-01T10:00"],
        })}
      />
    )

    await user.click(screen.getAllByRole("spinbutton")[0])
    const calendar = screen.getByTestId("stDateTimeInputCalendar")
    const yearTrigger = within(calendar).getByRole("button", { name: "year" })
    expect(yearTrigger).toHaveTextContent("2025")
    expect(yearTrigger).not.toHaveTextContent("2024")

    await user.click(yearTrigger)
    const years = (await screen.findAllByRole("option")).map(
      option => option.textContent
    )
    expect(years).toEqual(["2024", "2025"])
  })

  it("calendar selection stays open and commits on close", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: ["2025-11-19T16:45"],
      min: "2025-11-01T00:00",
      max: "2025-11-30T23:59",
    })
    const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(
      <div>
        <DateTimeInput {...props} />
        <button data-testid="outside">outside</button>
      </div>
    )
    spy.mockClear()

    // Open calendar
    const segments = screen.getAllByRole("spinbutton")
    await user.click(segments[0])
    expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

    // Click a different day (Nov 15) — popover stays open
    const day15 = screen.getByRole("button", { name: /15/ })
    await user.click(day15)
    expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

    // Close by clicking outside
    await user.click(screen.getByTestId("outside"))

    // Time (16:45) should be preserved with new date
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        props.element.id,
        ["2025-11-15T16:45"],
        { formId: props.element.formId, fragmentId: undefined, fromUser: true }
      )
    })
  })

  it("commits on blur when value changed", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: ["2025-11-19T16:45"] })
    const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateTimeInput {...props} />)
    spy.mockClear()

    // Focus a time segment (hour) and change it
    const segments = screen.getAllByRole("spinbutton")
    const hourSegment = segments.find(
      s => s.getAttribute("data-type") === "hour"
    )
    expect(hourSegment).toBeDefined()
    await user.click(hourSegment as HTMLElement)

    // Arrow up to change hour from 16 to 17
    await user.keyboard("{ArrowUp}")

    // Blur away from widget
    await user.click(document.body)

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        props.element.id,
        ["2025-11-19T17:45"],
        { formId: props.element.formId, fragmentId: undefined, fromUser: true }
      )
    })
  })

  it("clears value via clear button", async () => {
    const user = userEvent.setup()
    // Clearable widget with a setValue to provide initial value
    const props = getProps({
      default: [],
      value: ["2025-06-15T10:00"],
      setValue: true,
    })
    const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateTimeInput {...props} />)
    spy.mockClear()

    const clearButton = screen.getByTestId("stDateTimeInputClearButton")
    await user.click(clearButton)

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(props.element.id, [], {
        formId: props.element.formId,
        fragmentId: undefined,
        fromUser: true,
      })
    })
  })

  it("shows clear button when clearable and has value", () => {
    const props = getProps({ default: [] })
    render(<DateTimeInput {...props} />)

    // With empty default (clearable) but no committed value, no clear button
    expect(
      screen.queryByTestId("stDateTimeInputClearButton")
    ).not.toBeInTheDocument()
  })

  it("does not show clear button when non-clearable", () => {
    const props = getProps({ default: ["2025-11-19T16:45"] })
    render(<DateTimeInput {...props} />)

    expect(
      screen.queryByTestId("stDateTimeInputClearButton")
    ).not.toBeInTheDocument()
  })

  describe("Query param binding", () => {
    it("registers query param binding on mount when queryParamKey is set", () => {
      const props = getProps({ queryParamKey: "my_datetime" })
      vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

      render(<DateTimeInput {...props} />)

      expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
        props.element.id,
        "my_datetime",
        "string_array_value",
        expect.anything(),
        false,
        undefined
      )
    })

    it("unregisters query param binding on unmount", () => {
      const props = getProps({ queryParamKey: "my_datetime" })
      const unregisterSpy = vi.spyOn(
        props.widgetMgr,
        "unregisterQueryParamBinding"
      )

      const { unmount } = render(<DateTimeInput {...props} />)

      unregisterSpy.mockClear()
      unmount()

      expect(props.widgetMgr.unregisterQueryParamBinding).toHaveBeenCalledWith(
        props.element.id
      )
    })

    it("does not register query param binding when queryParamKey is not set", () => {
      const props = getProps()
      vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

      render(<DateTimeInput {...props} />)

      expect(props.widgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
    })

    it("registers with clearable=true when default is empty", () => {
      const props = getProps({ queryParamKey: "my_datetime", default: [] })
      vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

      render(<DateTimeInput {...props} />)

      expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
        props.element.id,
        "my_datetime",
        "string_array_value",
        null,
        true,
        undefined
      )
    })
  })

  describe("Widget manager integration", () => {
    it("uses fragmentId when provided", () => {
      const props = {
        ...getProps(),
        fragmentId: "test-fragment-id",
      }
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")

      render(<DateTimeInput {...props} />)

      expect(spy).toHaveBeenCalledWith(
        props.element.id,
        props.element.default,
        {
          formId: props.element.formId,
          fragmentId: "test-fragment-id",
          fromUser: false,
        }
      )
    })
  })

  describe("Help text and accessibility", () => {
    it("displays help tooltip icon when help text is provided", () => {
      const props = getProps({ help: "This is help text" })
      render(<DateTimeInput {...props} />)

      expect(screen.getByTestId("stTooltipHoverTarget")).toBeVisible()
    })

    it("sets aria-label from element label", () => {
      const props = getProps({ label: "Select Date and Time" })
      render(<DateTimeInput {...props} />)

      expect(screen.getByLabelText("Select Date and Time")).toBeVisible()
    })
  })

  describe("Form integration", () => {
    it("resets its value when form is cleared", async () => {
      const props = { ...getProps({ formId: "form" }), fragmentId: "fragment" }
      props.widgetMgr.setFormSubmitBehaviors("form", true)

      props.widgetMgr.setStringArrayValue(
        props.element.id,
        ["2026-02-01T10:15"],
        {
          formId: props.element.formId,
          fragmentId: props.fragmentId,
          fromUser: true,
        }
      )

      render(<DateTimeInput {...props} />)

      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")

      act(() => {
        props.widgetMgr.submitForm("form", props.fragmentId)
      })

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          props.element.default,
          {
            formId: props.element.formId,
            fragmentId: props.fragmentId,
            fromUser: true,
          }
        )
      })
    })
  })

  describe("Step configuration", () => {
    it("uses default step of 900 seconds when not specified", () => {
      const props = getProps({ step: undefined })
      render(<DateTimeInput {...props} />)
      expect(screen.getByTestId("stDateTimeInput")).toBeVisible()
    })

    it("renders with custom step value", () => {
      const props = getProps({ step: 1800 })
      render(<DateTimeInput {...props} />)
      expect(screen.getByTestId("stDateTimeInput")).toBeVisible()
    })

    it("renders with step of 60 seconds", () => {
      const props = getProps({ step: 60 })
      render(<DateTimeInput {...props} />)
      expect(screen.getByTestId("stDateTimeInput")).toBeVisible()
    })
  })

  describe("Clearable behavior", () => {
    it("is clearable when default is empty and not disabled", () => {
      const props = getProps({ default: [] }, false)
      render(<DateTimeInput {...props} />)
      expect(screen.getByTestId("stDateTimeInput")).toBeVisible()
    })

    it("is not clearable when disabled even with empty default", () => {
      const props = getProps({ default: [] }, true)
      render(<DateTimeInput {...props} />)
      expect(
        screen.queryByTestId("stDateTimeInputClearButton")
      ).not.toBeInTheDocument()
    })
  })

  describe("Segment format ordering", () => {
    it("displays segments in YYYY/MM/DD order for that format", () => {
      const props = getProps({
        default: ["2025-03-15T10:30"],
        format: "YYYY/MM/DD",
      })
      render(<DateTimeInput {...props} />)

      const segments = screen.getAllByRole("spinbutton")
      expect(segments[0]).toHaveAttribute("data-type", "year")
      expect(segments[1]).toHaveAttribute("data-type", "month")
      expect(segments[2]).toHaveAttribute("data-type", "day")
      expect(segments[3]).toHaveAttribute("data-type", "hour")
      expect(segments[4]).toHaveAttribute("data-type", "minute")
    })

    it("displays segments in DD/MM/YYYY order for that format", () => {
      const props = getProps({
        default: ["2025-03-15T10:30"],
        format: "DD/MM/YYYY",
      })
      render(<DateTimeInput {...props} />)

      const segments = screen.getAllByRole("spinbutton")
      expect(segments[0]).toHaveAttribute("data-type", "day")
      expect(segments[1]).toHaveAttribute("data-type", "month")
      expect(segments[2]).toHaveAttribute("data-type", "year")
      expect(segments[3]).toHaveAttribute("data-type", "hour")
      expect(segments[4]).toHaveAttribute("data-type", "minute")
    })
  })

  describe("Error tooltip display", () => {
    it("shows error during editing then reverts on blur when below min", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:45"],
        min: "2025-01-01T00:00",
        max: "2025-12-31T23:59",
      })
      render(<DateTimeInput {...props} />)

      const segments = screen.getAllByRole("spinbutton")
      const yearSegment = segments.find(
        s => s.getAttribute("data-type") === "year"
      )
      await user.click(yearSegment as HTMLElement)

      // ArrowDown decrements year below min — error shown during editing
      await user.keyboard("{ArrowDown}")
      await waitFor(() => {
        expect(screen.getByTestId("stDateTimeInputError")).toBeVisible()
      })

      // Blur reverts display to committed value and clears error
      await user.click(document.body)
      await waitFor(() => {
        expect(
          screen.queryByTestId("stDateTimeInputError")
        ).not.toBeInTheDocument()
      })
      expect(yearSegment).toHaveTextContent("2025")
    })
  })

  describe("Paste handling", () => {
    it("pasting a full ISO datetime string updates the value", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["2025-11-19T16:45"] })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])

      await user.paste("2025-06-15T09:30")

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-06-15T09:30"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
    })

    it("paste is ignored when widget is disabled", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["2025-11-19T16:45"] }, true)
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      const field = screen.getByTestId("stDateTimeInputField")
      await user.click(field)
      await user.paste("2025-06-15T09:30")

      expect(spy).not.toHaveBeenCalled()
    })

    it("pasting an invalid datetime is rejected", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["2025-11-19T16:45"] })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])

      await user.paste("not-a-datetime")

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe("Step-aware arrow key behavior", () => {
    it("snaps minute ArrowUp to next step boundary (step=900, 15-min)", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:00"],
        step: 900,
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">outside</button>
        </div>
      )
      spy.mockClear()

      const segments = screen.getAllByRole("spinbutton")
      const minuteSegment = segments.find(
        s => s.getAttribute("data-type") === "minute"
      )
      await user.click(minuteSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")

      await user.click(screen.getByTestId("outside"))

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T16:15"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
    })

    it("snaps minute ArrowDown to previous step boundary (step=900, 15-min)", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:30"],
        step: 900,
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">outside</button>
        </div>
      )
      spy.mockClear()

      const segments = screen.getAllByRole("spinbutton")
      const minuteSegment = segments.find(
        s => s.getAttribute("data-type") === "minute"
      )
      await user.click(minuteSegment as HTMLElement)
      await user.keyboard("{ArrowDown}")

      await user.click(screen.getByTestId("outside"))

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T16:15"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
    })

    it("snaps hour ArrowUp to next step boundary when step is multiple of hours (step=7200)", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T14:00"],
        step: 7200,
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">outside</button>
        </div>
      )
      spy.mockClear()

      const segments = screen.getAllByRole("spinbutton")
      const hourSegment = segments.find(
        s => s.getAttribute("data-type") === "hour"
      )
      await user.click(hourSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")

      await user.click(screen.getByTestId("outside"))

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T16:00"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
    })
  })

  describe("Enter key behavior", () => {
    it("commits value immediately when Enter is pressed", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:00"],
        step: 900,
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      const segments = screen.getAllByRole("spinbutton")
      const minuteSegment = segments.find(
        s => s.getAttribute("data-type") === "minute"
      )
      await user.click(minuteSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")
      await user.keyboard("{Enter}")

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T16:15"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
    })

    it("does not commit partially typed state on Enter", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:45"],
        value: ["2025-11-19T16:45"],
        setValue: true,
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      // Clear a single segment to create partial state
      const segments = screen.getAllByRole("spinbutton")
      const yearSegment = segments.find(
        s => s.getAttribute("data-type") === "year"
      )
      await user.click(yearSegment as HTMLElement)
      await user.keyboard("{Backspace}")

      await user.keyboard("{Enter}")

      // Should NOT commit since we're in a partially-typed state
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe("Blur commit behavior", () => {
    it("does not commit on blur when value is unchanged", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["2025-11-19T16:45"] })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      // Focus without changing
      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])

      // Blur
      await user.click(document.body)

      // Should not have committed since value didn't change
      expect(spy).not.toHaveBeenCalled()
    })

    it("commits pending value on blur when inside a form (race fix)", async () => {
      const user = userEvent.setup()
      const props = {
        ...getProps({
          default: ["2025-11-19T16:45"],
          formId: "form",
        }),
        fragmentId: "fragment",
      }
      props.widgetMgr.setFormSubmitBehaviors("form", true)
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      const segments = screen.getAllByRole("spinbutton")
      const hourSegment = segments.find(
        s => s.getAttribute("data-type") === "hour"
      )
      await user.click(hourSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")

      // Blur (simulates focus moving to submit button)
      await user.click(document.body)

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T17:45"],
          {
            formId: props.element.formId,
            fragmentId: "fragment",
            fromUser: true,
          }
        )
      })
    })

    it("does not commit placeholder state on blur in a form (partially typed)", async () => {
      const user = userEvent.setup()
      const props = {
        ...getProps({
          default: ["2025-11-19T16:45"],
          value: ["2025-11-19T16:45"],
          setValue: true,
          formId: "form",
        }),
        fragmentId: "fragment",
      }
      props.widgetMgr.setFormSubmitBehaviors("form", true)
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      // Clear one segment to get partial state
      const segments = screen.getAllByRole("spinbutton")
      const yearSegment = segments.find(
        s => s.getAttribute("data-type") === "year"
      )
      await user.click(yearSegment as HTMLElement)
      await user.keyboard("{Backspace}")

      // Blur
      await user.click(document.body)

      // Should not commit partial state
      expect(spy).not.toHaveBeenCalled()
    })

    it("non-clearable widget reverts to committed value on blur after clearing all segments", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:45"],
        value: ["2025-11-19T16:45"],
        setValue: true,
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      // Clear all segments (React Aria needs one Backspace per digit)
      const segments = screen.getAllByRole("spinbutton")
      for (const segment of segments) {
        await clearSegment(user, segment)
      }

      // Tab from last segment to leave the field (closes popover + blur)
      await user.tab()

      // Close-commit reverts display locally; no setStringArrayValue fires
      expect(spy).not.toHaveBeenCalled()
    })

    it("commits cleared value via clear button for clearable widget", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [],
        value: ["2025-06-15T10:00"],
        setValue: true,
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      // Use the clear button — same commit path as manual segment clear + blur
      const clearButton = screen.getByTestId("stDateTimeInputClearButton")
      await user.click(clearButton)

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(props.element.id, [], {
          formId: props.element.formId,
          fragmentId: undefined,
          fromUser: true,
        })
      })
    })
  })

  describe("Form submit on Enter", () => {
    it("calls submitForm on Enter when enter_to_submit is enabled and value is valid", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:45"],
        formId: "form",
      })
      vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)
      vi.spyOn(props.widgetMgr, "submitForm").mockImplementation(() => true)
      render(<DateTimeInput {...props} />)

      const segments = screen.getAllByRole("spinbutton")
      const hourSegment = segments.find(
        s => s.getAttribute("data-type") === "hour"
      )
      await user.click(hourSegment as HTMLElement)
      // Change value so it's different from committed
      await user.keyboard("{ArrowUp}")
      await user.keyboard("{Enter}")

      expect(props.widgetMgr.submitForm).toHaveBeenCalledTimes(1)
      expect(props.widgetMgr.submitForm).toHaveBeenCalledWith(
        "form",
        undefined
      )
    })

    it("does NOT call submitForm on Enter when enter_to_submit is disabled", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:45"],
        formId: "form",
      })
      vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(
        false
      )
      vi.spyOn(props.widgetMgr, "submitForm")
      render(<DateTimeInput {...props} />)

      const segments = screen.getAllByRole("spinbutton")
      const hourSegment = segments.find(
        s => s.getAttribute("data-type") === "hour"
      )
      await user.click(hourSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")
      await user.keyboard("{Enter}")

      expect(props.widgetMgr.submitForm).not.toHaveBeenCalled()
    })

    it("does NOT call submitForm on Enter when a validation error is showing", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:45"],
        min: "2025-11-19T00:00",
        max: "2025-11-19T18:00",
        formId: "form",
      })
      vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)
      vi.spyOn(props.widgetMgr, "submitForm")
      render(<DateTimeInput {...props} />)

      // Push the hour above max to trigger a validation error
      const segments = screen.getAllByRole("spinbutton")
      const hourSegment = segments.find(
        s => s.getAttribute("data-type") === "hour"
      )
      await user.click(hourSegment as HTMLElement)
      // Increase hour from 16 past 18 (max) — 3 presses to reach 19
      await user.keyboard("{ArrowUp}")
      await user.keyboard("{ArrowUp}")
      await user.keyboard("{ArrowUp}")

      // Verify error is showing
      await waitFor(() => {
        expect(screen.getByTestId("stDateTimeInputError")).toBeVisible()
      })

      await user.keyboard("{Enter}")

      expect(props.widgetMgr.submitForm).not.toHaveBeenCalled()
    })

    it("synchronous formCommit fires on outside-click from active calendar (race guard)", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:45"],
        formId: "form",
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">Submit</button>
        </div>
      )
      spy.mockClear()

      // Edit a segment value
      const segments = screen.getAllByRole("spinbutton")
      const hourSegment = segments.find(
        s => s.getAttribute("data-type") === "hour"
      )
      await user.click(hourSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")

      // Enter active calendar mode (focus moves into grid)
      await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

      await waitFor(() => {
        const calendar = screen.getByTestId("stDateTimeInputCalendar")
        expect(calendar).toHaveAttribute("role", "dialog")
      })

      // Click outside (simulates clicking Submit button) — formCommit must fire synchronously
      await user.click(screen.getByTestId("outside"))

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T17:45"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
    })

    it("formCommit writes new value before click fires on dismiss-target (form race guard)", async () => {
      const user = userEvent.setup()
      const props = {
        ...getProps({
          default: ["2025-11-19T16:45"],
          formId: "form",
        }),
        fragmentId: "fragment",
      }
      props.widgetMgr.setFormSubmitBehaviors("form", true)

      // Record the order of WM writes vs submit-button click
      const callLog: string[] = []
      const wmSpy = vi
        .spyOn(props.widgetMgr, "setStringArrayValue")
        .mockImplementation((_el, value) => {
          callLog.push(`wmWrite:${JSON.stringify(value)}`)
        })

      render(
        <div>
          <DateTimeInput {...props} />
          <button
            data-testid="submit"
            onClick={() => callLog.push("submitClick")}
          >
            Submit
          </button>
        </div>
      )
      wmSpy.mockClear()
      callLog.length = 0

      // Edit a value so pending differs from committed
      const segments = screen.getAllByRole("spinbutton")
      const hourSegment = segments.find(
        s => s.getAttribute("data-type") === "hour"
      )
      await user.click(hourSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")
      wmSpy.mockClear()
      callLog.length = 0

      // Popover should be open
      expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

      // Click Submit button — pointerdown fires dismiss, click fires submit
      await user.click(screen.getByTestId("submit"))

      // The sync formCommit write MUST appear before the click handler
      const writeIdx = callLog.findIndex(e =>
        e.includes('["2025-11-19T17:45"]')
      )
      const clickIdx = callLog.indexOf("submitClick")
      expect(writeIdx).toBeGreaterThanOrEqual(0)
      expect(clickIdx).toBeGreaterThanOrEqual(0)
      expect(writeIdx).toBeLessThan(clickIdx)

      wmSpy.mockRestore()
    })
  })

  describe("Dedup guard prevents redundant commits on dismissal", () => {
    it("outside-click triggers one commit (sync formCommit + async effect) in form mode", async () => {
      const user = userEvent.setup()
      const props = {
        ...getProps({
          default: ["2025-11-19T16:45"],
          formId: "form",
        }),
        fragmentId: "fragment",
      }
      props.widgetMgr.setFormSubmitBehaviors("form", true)
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">Outside</button>
        </div>
      )
      spy.mockClear()

      // Edit a value so pending differs from committed
      const segments = screen.getAllByRole("spinbutton")
      const hourSegment = segments.find(
        s => s.getAttribute("data-type") === "hour"
      )
      await user.click(hourSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")

      // Popover should be open
      expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

      // Click outside to dismiss — this triggers overlay onClose + blur
      await user.click(screen.getByTestId("outside"))

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T17:45"],
          {
            formId: props.element.formId,
            fragmentId: "fragment",
            fromUser: true,
          }
        )
      })

      // One commit = 2 WM writes (sync formCommit + async effect).
      // A duplicate commit (onClose + blur both firing) would produce 4.
      const matchingCalls = spy.mock.calls.filter(
        call =>
          JSON.stringify(call[1]) === JSON.stringify(["2025-11-19T17:45"])
      )
      expect(matchingCalls).toHaveLength(2)
    })

    it("Tab-away from last segment triggers one commit in form mode", async () => {
      const user = userEvent.setup()
      const props = {
        ...getProps({
          default: ["2025-11-19T16:45"],
          formId: "form",
        }),
        fragmentId: "fragment",
      }
      props.widgetMgr.setFormSubmitBehaviors("form", true)
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">Outside</button>
        </div>
      )
      spy.mockClear()

      // Edit a value
      const segments = screen.getAllByRole("spinbutton")
      const minuteSegment = segments.find(
        s => s.getAttribute("data-type") === "minute"
      )
      await user.click(minuteSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")

      // Popover should be open
      expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

      // Tab away from the last segment — this closes popover + triggers blur
      await user.tab()

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T17:00"],
          {
            formId: props.element.formId,
            fragmentId: "fragment",
            fromUser: true,
          }
        )
      })

      // One commit = 2 WM writes (sync formCommit + async effect)
      const matchingCalls = spy.mock.calls.filter(
        call =>
          JSON.stringify(call[1]) === JSON.stringify(["2025-11-19T17:00"])
      )
      expect(matchingCalls).toHaveLength(2)
    })

    it("Escape triggers one commit in form mode", async () => {
      const user = userEvent.setup()
      const props = {
        ...getProps({
          default: ["2025-11-19T16:45"],
          formId: "form",
        }),
        fragmentId: "fragment",
      }
      props.widgetMgr.setFormSubmitBehaviors("form", true)
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      // Edit a value
      const segments = screen.getAllByRole("spinbutton")
      const hourSegment = segments.find(
        s => s.getAttribute("data-type") === "hour"
      )
      await user.click(hourSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")

      // Popover should be open
      expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

      // Escape to dismiss
      await user.keyboard("{Escape}")

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T17:45"],
          {
            formId: props.element.formId,
            fragmentId: "fragment",
            fromUser: true,
          }
        )
      })

      // One commit = 2 WM writes (sync formCommit + async effect)
      const matchingCalls = spy.mock.calls.filter(
        call =>
          JSON.stringify(call[1]) === JSON.stringify(["2025-11-19T17:45"])
      )
      expect(matchingCalls).toHaveLength(2)
    })

    it("outside-click from popover TimeField triggers one commit in form mode", async () => {
      const user = userEvent.setup()
      const props = {
        ...getProps({
          default: ["2025-11-19T16:45"],
          formId: "form",
        }),
        fragmentId: "fragment",
      }
      props.widgetMgr.setFormSubmitBehaviors("form", true)
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">Outside</button>
        </div>
      )
      spy.mockClear()

      // Open popover and navigate to the TimeField
      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      await screen.findByTestId("stDateTimeInputCalendar")

      // Click into popover TimeField and edit time
      const timeRow = screen.getByTestId("stDateTimeInputPopoverTime")
      const popoverMinute = timeRow.querySelectorAll('[role="spinbutton"]')[1]
      await user.click(popoverMinute)
      await user.keyboard("{ArrowUp}")

      // Click outside to dismiss
      await user.click(screen.getByTestId("outside"))

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T17:00"],
          {
            formId: props.element.formId,
            fragmentId: "fragment",
            fromUser: true,
          }
        )
      })

      // One commit = 2 WM writes (sync formCommit + async effect)
      const matchingCalls = spy.mock.calls.filter(
        call =>
          JSON.stringify(call[1]) === JSON.stringify(["2025-11-19T17:00"])
      )
      expect(matchingCalls).toHaveLength(2)
    })

    it("outside-click commits exactly once in non-form mode (no double onChange)", async () => {
      const user = userEvent.setup()
      const props = {
        ...getProps({
          default: ["2025-11-19T16:45"],
        }),
        fragmentId: "fragment",
      }
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">Outside</button>
        </div>
      )
      spy.mockClear()

      // Edit a value so pending differs from committed
      const segments = screen.getAllByRole("spinbutton")
      const hourSegment = segments.find(
        s => s.getAttribute("data-type") === "hour"
      )
      await user.click(hourSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")

      // Popover should be open
      expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

      // Click outside to dismiss — this triggers overlay onClose + blur
      await user.click(screen.getByTestId("outside"))

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T17:45"],
          {
            formId: props.element.formId,
            fragmentId: "fragment",
            fromUser: true,
          }
        )
      })

      // The critical assertion: exactly ONE write, not two
      const matchingCalls = spy.mock.calls.filter(
        call =>
          JSON.stringify(call[1]) === JSON.stringify(["2025-11-19T17:45"])
      )
      expect(matchingCalls).toHaveLength(1)
    })

    it("Escape does not block subsequent Tab-away commit (no leaked ref)", async () => {
      const user = userEvent.setup()
      const props = {
        ...getProps({
          default: ["2025-11-19T16:45"],
          formId: "form",
        }),
        fragmentId: "fragment",
      }
      props.widgetMgr.setFormSubmitBehaviors("form", true)
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">Outside</button>
        </div>
      )

      // Open popover, edit hour, then Escape to dismiss (commits 17:45)
      const segments = screen.getAllByRole("spinbutton")
      const hourSegment = segments.find(
        s => s.getAttribute("data-type") === "hour"
      )
      await user.click(hourSegment as HTMLElement)
      await user.keyboard("{ArrowUp}")
      expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()
      await user.keyboard("{Escape}")

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T17:45"],
          {
            formId: props.element.formId,
            fragmentId: "fragment",
            fromUser: true,
          }
        )
      })

      spy.mockClear()

      // After Escape, focus is restored to the last segment (minute).
      // Edit again via ArrowUp (step-snap 17:45 → 18:00) without reopening.
      await user.keyboard("{ArrowUp}")
      // Tab away from last segment — must still commit the new value.
      await user.tab()

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T18:00"],
          {
            formId: props.element.formId,
            fragmentId: "fragment",
            fromUser: true,
          }
        )
      })
    })
  })

  describe("Boundary time on calendar selection", () => {
    it("preserves time when selecting a non-boundary date", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T14:30"],
        min: "2025-11-01T09:00",
        max: "2025-11-30T17:00",
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">outside</button>
        </div>
      )
      spy.mockClear()

      // Open calendar
      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

      // Click a non-boundary date (Nov 15 — time should be preserved as-is)
      const day15 = screen.getByRole("button", { name: /15/ })
      await user.click(day15)

      // Close the popover
      await user.click(screen.getByTestId("outside"))

      // Time 14:30 should be preserved since Nov 15 is not a boundary date
      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-15T14:30"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
    })

    it("reverts when selecting boundary date makes time out of max bounds", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-01T22:00"],
        min: "2025-11-19T09:00",
        max: "2025-11-30T17:00",
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">outside</button>
        </div>
      )
      spy.mockClear()

      // Open calendar
      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

      // Click the max boundary date (Nov 30)
      const day30 = screen.getByRole("button", { name: /November 30/ })
      await user.click(day30)

      // Live validation: error shows immediately after boundary pick
      await waitFor(() => {
        expect(screen.getByTestId("stDateTimeInputError")).toBeVisible()
      })

      // Close the popover — 22:00 on Nov 30 exceeds max (17:00), so display reverts
      await user.click(screen.getByTestId("outside"))

      // Should NOT commit (out of bounds → revert)
      await waitFor(() => {
        expect(
          screen.queryByTestId("stDateTimeInputCalendar")
        ).not.toBeInTheDocument()
      })
      expect(spy).not.toHaveBeenCalled()
    })

    it("reverts when selecting boundary date makes time below min bounds", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-25T07:00"],
        min: "2025-11-19T09:00",
        max: "2025-11-30T17:00",
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">outside</button>
        </div>
      )
      spy.mockClear()

      // Open calendar
      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

      // Click the min boundary date (Nov 19)
      const day19 = screen.getByRole("button", { name: /November 19/ })
      await user.click(day19)

      // Live validation: error shows immediately after boundary pick
      await waitFor(() => {
        expect(screen.getByTestId("stDateTimeInputError")).toBeVisible()
      })

      // Close the popover — 07:00 on Nov 19 is below min (09:00), so display reverts
      await user.click(screen.getByTestId("outside"))

      // Should NOT commit (out of bounds → revert)
      await waitFor(() => {
        expect(
          screen.queryByTestId("stDateTimeInputCalendar")
        ).not.toBeInTheDocument()
      })
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe("Out-of-bounds revert on close", () => {
    it("reverts display and clears error when year is decremented below min and Escape is pressed", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-03-15T10:30"],
        min: "2025-01-01T00:00",
        max: "2025-12-31T23:59",
      })
      render(<DateTimeInput {...props} />)

      const segments = screen.getAllByRole("spinbutton")
      const yearSegment = segments.find(
        s => s.getAttribute("data-type") === "year"
      )
      await user.click(yearSegment as HTMLElement)
      await screen.findByTestId("stDateTimeInputCalendar")

      // Decrement year below min (2025 → 2024)
      await user.keyboard("{ArrowDown}")

      // Escape closes and reverts
      await user.keyboard("{Escape}")

      await waitFor(() => {
        expect(
          screen.queryByTestId("stDateTimeInputError")
        ).not.toBeInTheDocument()
      })
      expect(yearSegment).toHaveTextContent("2025")
    })

    it("reverts display when incomplete year digits are entered and user clicks outside", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:45"],
        min: "2020-01-01T00:00",
        max: "2030-12-31T23:59",
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      const segments = screen.getAllByRole("spinbutton")
      const yearSegment = segments.find(
        s => s.getAttribute("data-type") === "year"
      )
      await user.click(yearSegment as HTMLElement)
      await screen.findByTestId("stDateTimeInputCalendar")

      // Type incomplete year (3 digits → year=202 which is below min)
      await user.tripleClick(yearSegment as HTMLElement)
      await user.keyboard("202")

      // Click outside to close
      await user.click(document.body)

      // Display reverts, no error, no commit
      await waitFor(() => {
        expect(
          screen.queryByTestId("stDateTimeInputError")
        ).not.toBeInTheDocument()
      })
      expect(yearSegment).toHaveTextContent("2025")
      expect(spy).not.toHaveBeenCalled()
    })

    it("does not revert valid edits on close", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:45"],
        min: "2020-01-01T00:00",
        max: "2030-12-31T23:59",
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<DateTimeInput {...props} />)
      spy.mockClear()

      const segments = screen.getAllByRole("spinbutton")
      const yearSegment = segments.find(
        s => s.getAttribute("data-type") === "year"
      )
      await user.click(yearSegment as HTMLElement)
      await screen.findByTestId("stDateTimeInputCalendar")

      // ArrowUp year to valid 2026
      await user.keyboard("{ArrowUp}")

      // Click outside to close — should commit, not revert
      await user.click(document.body)

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2026-11-19T16:45"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
      expect(
        screen.queryByTestId("stDateTimeInputError")
      ).not.toBeInTheDocument()
    })
  })

  describe("Active calendar (Alt+ArrowDown)", () => {
    it("Alt+ArrowDown opens calendar in active mode with focus on grid cell", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["2025-11-19T16:45"] })
      render(<DateTimeInput {...props} />)

      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      await screen.findByTestId("stDateTimeInputCalendar")

      await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

      await waitFor(() => {
        const calendar = screen.getByTestId("stDateTimeInputCalendar")
        expect(calendar).toHaveAttribute("role", "dialog")
        expect(calendar).toHaveAttribute("aria-modal", "true")
        // Focus should be inside the calendar grid
        const focused = document.activeElement
        expect(calendar.contains(focused)).toBe(true)
        expect(focused?.getAttribute("tabindex")).toBe("0")
      })
    })

    it("Escape from active calendar closes it and returns focus to the field", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["2025-11-19T16:45"] })
      render(<DateTimeInput {...props} />)

      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[1])
      await screen.findByTestId("stDateTimeInputCalendar")

      await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

      await waitFor(() => {
        const calendar = screen.getByTestId("stDateTimeInputCalendar")
        expect(calendar).toHaveAttribute("role", "dialog")
      })

      // Escape should close and return focus to the originating segment
      await user.keyboard("{Escape}")

      await waitFor(() => {
        expect(
          screen.queryByTestId("stDateTimeInputCalendar")
        ).not.toBeInTheDocument()
      })
      expect(segments[1]).toHaveFocus()
    })

    it("Alt+ArrowDown opens calendar even when popover was previously closed", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["2025-11-19T16:45"] })
      render(<DateTimeInput {...props} />)

      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      await screen.findByTestId("stDateTimeInputCalendar")

      // Close by tabbing through all segments and out
      for (let i = 0; i < segments.length; i++) {
        await user.tab()
      }
      await waitFor(() => {
        expect(
          screen.queryByTestId("stDateTimeInputCalendar")
        ).not.toBeInTheDocument()
      })

      // Go back and use Alt+ArrowDown
      await user.click(segments[0])
      await screen.findByTestId("stDateTimeInputCalendar")
      await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

      await waitFor(() => {
        const calendar = screen.getByTestId("stDateTimeInputCalendar")
        expect(calendar).toHaveAttribute("role", "dialog")
        expect(calendar).toHaveAttribute("aria-modal", "true")
      })
    })
  })

  describe("Popover TimeField", () => {
    it("renders popover TimeField with correct time value", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["2025-11-19T16:45"] })
      render(<DateTimeInput {...props} />)

      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      await screen.findByTestId("stDateTimeInputCalendar")

      const timeRow = screen.getByTestId("stDateTimeInputPopoverTime")
      expect(timeRow).toBeVisible()
      expect(timeRow).toHaveTextContent("Time")

      // TimeField should show the current time segments (16:45)
      const popoverSegments = timeRow.querySelectorAll('[role="spinbutton"]')
      expect(popoverSegments.length).toBe(2) // hour, minute
    })

    it("editing popover time updates inline segments", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:45"],
        min: "2025-11-01T00:00",
        max: "2025-11-30T23:59",
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">outside</button>
        </div>
      )
      spy.mockClear()

      // Open calendar
      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      await screen.findByTestId("stDateTimeInputCalendar")

      // Find the popover time hour segment and change it
      const timeRow = screen.getByTestId("stDateTimeInputPopoverTime")
      const popoverHour = timeRow.querySelector(
        '[data-type="hour"]'
      ) as HTMLElement
      await user.click(popoverHour)
      await user.keyboard("{ArrowUp}")

      // Close popover to commit
      await user.click(screen.getByTestId("outside"))

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T17:45"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
    })

    it("calendar selection keeps popover open for time editing", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:45"],
        min: "2025-11-01T00:00",
        max: "2025-11-30T23:59",
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">outside</button>
        </div>
      )
      spy.mockClear()

      // Open calendar
      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      await screen.findByTestId("stDateTimeInputCalendar")

      // Select a date — popover stays open
      const day15 = screen.getByRole("button", { name: /15/ })
      await user.click(day15)
      expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

      // Edit time in popover
      const timeRow = screen.getByTestId("stDateTimeInputPopoverTime")
      const popoverHour = timeRow.querySelector(
        '[data-type="hour"]'
      ) as HTMLElement
      await user.click(popoverHour)
      await user.keyboard("{ArrowUp}")

      // Close to commit combined value
      await user.click(screen.getByTestId("outside"))

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-15T17:45"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
    })

    it("popover TimeField does not show when popover is closed", () => {
      const props = getProps({ default: ["2025-11-19T16:45"] })
      render(<DateTimeInput {...props} />)

      expect(
        screen.queryByTestId("stDateTimeInputPopoverTime")
      ).not.toBeInTheDocument()
    })

    it("popover TimeField applies step-snapping on ArrowUp/Down", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T16:00"],
        step: 900, // 15-min step
        min: "2025-11-01T00:00",
        max: "2025-11-30T23:59",
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">outside</button>
        </div>
      )
      spy.mockClear()

      // Open calendar
      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      await screen.findByTestId("stDateTimeInputCalendar")

      // ArrowUp on popover minute should snap by 15 (step=900)
      const timeRow = screen.getByTestId("stDateTimeInputPopoverTime")
      const popoverMinute = timeRow.querySelector(
        '[data-type="minute"]'
      ) as HTMLElement
      await user.click(popoverMinute)
      await user.keyboard("{ArrowUp}")

      // Close to commit — should snap from 16:00 to 16:15
      await user.click(screen.getByTestId("outside"))

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T16:15"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
    })

    it("popover TimeField step-snapping with hour steps", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: ["2025-11-19T10:00"],
        step: 10800, // 3-hour step
        min: "2025-11-01T00:00",
        max: "2025-11-30T23:59",
      })
      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(
        <div>
          <DateTimeInput {...props} />
          <button data-testid="outside">outside</button>
        </div>
      )
      spy.mockClear()

      // Open calendar
      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      await screen.findByTestId("stDateTimeInputCalendar")

      // ArrowUp on popover hour should snap by 3 (step=10800)
      const timeRow = screen.getByTestId("stDateTimeInputPopoverTime")
      const popoverHour = timeRow.querySelector(
        '[data-type="hour"]'
      ) as HTMLElement
      await user.click(popoverHour)
      await user.keyboard("{ArrowUp}")

      // Close to commit — should snap from 10:00 to 12:00
      await user.click(screen.getByTestId("outside"))

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element.id,
          ["2025-11-19T12:00"],
          {
            formId: props.element.formId,
            fragmentId: undefined,
            fromUser: true,
          }
        )
      })
    })

    it("Tab cycles between calendar and TimeField in active mode", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["2025-11-19T16:45"] })
      render(<DateTimeInput {...props} />)

      // Enter active mode
      const segments = screen.getAllByRole("spinbutton")
      await user.click(segments[0])
      await screen.findByTestId("stDateTimeInputCalendar")
      await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

      await waitFor(() => {
        const calendar = screen.getByTestId("stDateTimeInputCalendar")
        expect(calendar).toHaveAttribute("role", "dialog")
      })

      // Tab should eventually reach the TimeField segments
      const timeRow = screen.getByTestId("stDateTimeInputPopoverTime")
      const popoverSegments = timeRow.querySelectorAll('[role="spinbutton"]')

      // Tab multiple times to reach TimeField
      let reachedTimeField = false
      for (let i = 0; i < 15; i++) {
        await user.tab()
        if (
          popoverSegments[0] === document.activeElement ||
          popoverSegments[1] === document.activeElement
        ) {
          reachedTimeField = true
          break
        }
      }
      expect(reachedTimeField).toBe(true)
    })
  })
})
