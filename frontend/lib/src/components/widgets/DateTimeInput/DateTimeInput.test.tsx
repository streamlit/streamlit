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

    expect(spy).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
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

  it("calendar selection commits to widget manager and preserves time", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: ["2025-11-19T16:45"],
      min: "2025-11-01T00:00",
      max: "2025-11-30T23:59",
    })
    const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateTimeInput {...props} />)
    spy.mockClear()

    // Open calendar
    const segments = screen.getAllByRole("spinbutton")
    await user.click(segments[0])
    expect(screen.getByTestId("stDateTimeInputCalendar")).toBeVisible()

    // Click a different day (Nov 15)
    const day15 = screen.getByRole("button", { name: /15/ })
    await user.click(day15)

    // Calendar should close
    expect(
      screen.queryByTestId("stDateTimeInputCalendar")
    ).not.toBeInTheDocument()

    // Time (16:45) should be preserved with new date
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        props.element,
        ["2025-11-15T16:45"],
        { fromUi: true },
        undefined
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
        props.element,
        ["2025-11-19T17:45"],
        { fromUi: true },
        undefined
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
      expect(spy).toHaveBeenCalledWith(
        props.element,
        [],
        { fromUi: true },
        undefined
      )
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
        props.element,
        props.element.default,
        { fromUi: false },
        "test-fragment-id"
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
        props.element,
        ["2026-02-01T10:15"],
        { fromUi: true },
        props.fragmentId
      )

      render(<DateTimeInput {...props} />)

      const spy = vi.spyOn(props.widgetMgr, "setStringArrayValue")

      act(() => {
        props.widgetMgr.submitForm("form", props.fragmentId)
      })

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          props.element,
          props.element.default,
          { fromUi: true },
          props.fragmentId
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
    it("displays error when entered value is below min", async () => {
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

      // Type a year below min
      await user.keyboard("{ArrowDown}")
      await user.keyboard("{ArrowDown}")
      await user.keyboard("{ArrowDown}")

      await user.click(document.body)

      await waitFor(() => {
        expect(screen.getByTestId("stDateTimeInputError")).toBeVisible()
      })
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
          props.element,
          ["2025-06-15T09:30"],
          { fromUi: true },
          undefined
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
          props.element,
          ["2025-11-19T16:15"],
          { fromUi: true },
          undefined
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
          props.element,
          ["2025-11-19T16:15"],
          { fromUi: true },
          undefined
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
          props.element,
          ["2025-11-19T16:00"],
          { fromUi: true },
          undefined
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
          props.element,
          ["2025-11-19T16:15"],
          { fromUi: true },
          undefined
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
          props.element,
          ["2025-11-19T17:45"],
          { fromUi: true },
          "fragment"
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
        expect(spy).toHaveBeenCalledWith(
          props.element,
          [],
          { fromUi: true },
          undefined
        )
      })
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
})
