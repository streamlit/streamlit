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
import moment from "moment"
import { setInteractionModality } from "react-aria/private/interactions/useFocusVisible"
import { MockInstance } from "vitest"

import {
  DateInput as DateInputProto,
  LabelVisibility as LabelVisibilityProto,
} from "@streamlit/protobuf"

import { render, renderWithContexts } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import DateInput, { Props } from "./DateInput"

// Wire format (ISO 8601) — proto fields + setStringArrayValue calls
const originalDateWire = "1970-01-20"
const newDateWire = "2020-02-06"

const getProps = (
  elementProps: Partial<DateInputProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: DateInputProto.create({
    id: "1",
    label: "Label",
    default: [originalDateWire],
    min: originalDateWire,
    format: "YYYY/MM/DD",
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...widgetProps,
})

/**
 * Single mode's `SingleDateInput` renders the date as three focusable
 * `role="spinbutton"` segments (React Aria's `DateField`) instead of
 * BaseWeb's single masked-text `<input>` — there's no `stDateInputField`
 * testid/value to assert on directly. These helpers interact with segments
 * the way a real user would (click a segment, type/backspace digits) so
 * single-mode tests exercise the same behavior the old tests did, just
 * through the new DOM shape. Range mode is untouched (still BaseWeb) and
 * its tests still use `stDateInputField` directly.
 */
const getSingleDateSegments = (
  region: HTMLElement
): { year: HTMLElement; month: HTMLElement; day: HTMLElement } => ({
  year: within(region).getByRole("spinbutton", { name: /year/i }),
  month: within(region).getByRole("spinbutton", { name: /month/i }),
  day: within(region).getByRole("spinbutton", { name: /day/i }),
})

const typeIntoSegment = async (
  user: ReturnType<typeof userEvent.setup>,
  segment: HTMLElement,
  digits: string
): Promise<void> => {
  await user.click(segment)
  // Sequential digit keystrokes must land one at a time; a single
  // multi-char keyboard() call does not simulate the same incremental
  // segment-editing behavior.
  for (const digit of digits) {
    await user.keyboard(digit)
  }
}

/** Backspaces a segment back to its empty placeholder (e.g. "yyyy"), which
 * takes one keypress per currently-displayed digit — React Aria's Backspace
 * removes one character at a time, it doesn't clear the whole segment. */
const clearSegment = async (
  user: ReturnType<typeof userEvent.setup>,
  segment: HTMLElement
): Promise<void> => {
  await user.click(segment)
  // Captured once: `segment.textContent` shrinks with each backspace, so
  // using it directly as the loop bound would make the loop terminate
  // early (e.g. clearing a 4-digit year in only 2 presses).
  const digitCount = segment.textContent?.length ?? 0
  for (let i = 0; i < digitCount; i++) {
    await user.keyboard("{Backspace}")
  }
}

describe("DateInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<DateInput {...props} />)
    expect(screen.getByTestId("stDateInput")).toBeVisible()
  })

  it("renders a label", () => {
    const props = getProps()
    render(<DateInput {...props} />)
    expect(screen.getByText("Label")).toBeVisible()
  })

  it("displays the correct segment order and value for the provided format", () => {
    const props = getProps({
      format: "DD.MM.YYYY",
    })
    render(<DateInput {...props} />)
    const region = screen.getByTestId("stDateInput")

    // format="DD.MM.YYYY" reorders the rendered segments (day, month, year)
    // independently of the fixed en-US `I18nProvider`'s natural (month,
    // day, year) order — see dateInputUtils.reorderSegments.
    const spinbuttons = within(region).getAllByRole("spinbutton")
    expect(spinbuttons.map(s => s.getAttribute("data-type"))).toEqual([
      "day",
      "month",
      "year",
    ])
    expect(spinbuttons.map(s => s.textContent)).toEqual(["20", "01", "1970"])

    const literals = within(region).getAllByText(".", { exact: true })
    expect(literals).toHaveLength(2)
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<DateInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<DateInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("sets widget value on render", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [originalDateWire],
      {
        fromUi: false,
      },
      undefined
    )
  })

  it("can pass a fragmentId to setStringArrayValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [originalDateWire],
      {
        fromUi: false,
      },
      "myFragmentId"
    )
  })

  it("has correct className", () => {
    const props = getProps()
    render(<DateInput {...props} />)

    const dateInput = screen.getByTestId("stDateInput")
    expect(dateInput).toHaveAttribute("class", "stDateInput")
  })

  it("renders a default value", () => {
    const props = getProps()
    render(<DateInput {...props} />)
    const region = screen.getByTestId("stDateInput")

    const { year, month, day } = getSingleDateSegments(region)
    expect(year).toHaveTextContent("1970")
    expect(month).toHaveTextContent("01")
    expect(day).toHaveTextContent("20")
  })

  it("can be disabled", () => {
    const props = getProps()
    render(<DateInput {...props} disabled={true} />)
    const region = screen.getByTestId("stDateInput")

    const { year, month, day } = getSingleDateSegments(region)
    for (const segment of [year, month, day]) {
      expect(segment).toHaveAttribute("aria-disabled", "true")
      expect(segment).toHaveAttribute("contenteditable", "false")
    }
  })

  it("updates the widget value when it's changed", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: undefined })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    const region = screen.getByTestId("stDateInput")
    const { year, month, day } = getSingleDateSegments(region)

    await typeIntoSegment(user, year, "2020")
    await typeIntoSegment(user, month, "02")
    await typeIntoSegment(user, day, "06")

    expect(year).toHaveTextContent("2020")
    expect(month).toHaveTextContent("02")
    expect(day).toHaveTextContent("06")
    await waitFor(() => {
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [newDateWire],
        {
          fromUi: true,
        },
        undefined
      )
    })
  })

  it("displays an error tooltip when the entered date for single date input outside range", async () => {
    const user = userEvent.setup()
    const props = getProps({
      min: "2020-01-05",
      max: "2020-01-25",
    })
    render(<DateInput {...props} />)
    const region = screen.getByTestId("stDateInput")
    const { year, month, day } = getSingleDateSegments(region)

    await typeIntoSegment(user, year, "2020")
    await typeIntoSegment(user, month, "01")
    await typeIntoSegment(user, day, "30")

    const errorIcon = await screen.findByTestId("stTooltipErrorHoverTarget")
    expect(errorIcon).toBeVisible()

    // Hover over the error icon to trigger the tooltip
    act(() => setInteractionModality("pointer"))
    await user.hover(errorIcon)

    const tooltip = await screen.findByTestId("stTooltipErrorContent")
    expect(tooltip).toHaveTextContent(
      "Error: Date set outside allowed range. Please select a date between 2020/01/05 and 2020/01/25."
    )
  })

  it("displays correct error tooltip when the entered date for range input below min date", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: ["2020-02-01", "2020-02-07"],
      min: "2020-01-01",
      max: "2020-12-31",
      isRange: true,
    })
    render(<DateInput {...props} />)
    const dateInput = screen.getByTestId("stDateInputField")
    const currNewDate = "2019/01/05 - 2020/02/07"

    await user.clear(dateInput)
    await user.type(dateInput, currNewDate)

    const errorIcon = screen.getByTestId("stTooltipErrorHoverTarget")
    expect(errorIcon).toBeVisible()

    // Hover over the error icon to trigger the tooltip
    act(() => setInteractionModality("pointer"))
    await user.hover(errorIcon)

    const tooltip = await screen.findByTestId("stTooltipErrorContent")
    expect(tooltip).toHaveTextContent(
      "Error: Start date set outside allowed range. Please select a date after 2020/01/01."
    )
  })

  it("displays correct error tooltip when the entered date for range input above max date", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: ["2020-02-01", "2020-02-07"],
      min: "2020-01-01",
      max: "2020-12-31",
      isRange: true,
    })
    render(<DateInput {...props} />)
    const dateInput = screen.getByTestId("stDateInputField")
    const currNewDate = "2020/02/01 - 2021/02/07"

    await user.clear(dateInput)
    await user.type(dateInput, currNewDate)

    const errorIcon = screen.getByTestId("stTooltipErrorHoverTarget")
    expect(errorIcon).toBeVisible()

    // Hover over the error icon to trigger the tooltip
    act(() => setInteractionModality("pointer"))
    await user.hover(errorIcon)

    const tooltip = await screen.findByTestId("stTooltipErrorContent")
    expect(tooltip).toHaveTextContent(
      "Error: End date set outside allowed range. Please select a date before 2020/12/31."
    )
  })

  it("does not commit an invalid date", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: undefined,
      min: "2020-01-01",
      max: "2020-01-31",
    })
    render(<DateInput {...props} />)
    // Set up spy after initial setStringArrayValue call
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    const region = screen.getByTestId("stDateInput")
    const { year, month, day } = getSingleDateSegments(region)
    await typeIntoSegment(user, year, "2020")
    await typeIntoSegment(user, month, "02")
    await typeIntoSegment(user, day, "15")

    expect(year).toHaveTextContent("2020")
    expect(month).toHaveTextContent("02")
    expect(day).toHaveTextContent("15")
    await screen.findByTestId("stTooltipErrorHoverTarget")
    expect(props.widgetMgr.setStringArrayValue).not.toHaveBeenCalled()
  })

  it("resets its value to default when it's closed with empty input", async () => {
    const user = userEvent.setup()
    const props = getProps()

    render(<DateInput {...props} />)
    const region = screen.getByTestId("stDateInput")
    const { year, month, day } = getSingleDateSegments(region)

    // Opens the popover (segments are focused/edited the same way whether
    // or not it's open) and clears every segment back to its placeholder.
    await clearSegment(user, year)
    await clearSegment(user, month)
    await clearSegment(user, day)
    expect(year).toHaveTextContent("yyyy")
    expect(month).toHaveTextContent("mm")
    expect(day).toHaveTextContent("dd")

    // Simulate the close action via an outside click (Escape / calendar
    // selection also close it — see DateInput.tsx's handleClose).
    await user.click(document.body)

    await waitFor(() => {
      expect(year).toHaveTextContent(originalDateWire.split("-")[0])
    })
    expect(month).toHaveTextContent(originalDateWire.split("-")[1])
    expect(day).toHaveTextContent(originalDateWire.split("-")[2])
  })

  it("has a minDate", async () => {
    const user = userEvent.setup()
    const props = getProps({})

    render(<DateInput {...props} />)
    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)
    await user.click(year)

    // React Aria's `Calendar` marks out-of-range cells `aria-disabled`
    // rather than BaseWeb's "Not available."/"It's available." label
    // prefixes; the day before `min` should be disabled, `min` itself
    // shouldn't be.
    expect(
      await screen.findByLabelText("Monday, January 19, 1970")
    ).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.getByLabelText(/Tuesday, January 20, 1970/)
    ).not.toHaveAttribute("aria-disabled")
  })

  it("has a minDate if passed", async () => {
    const user = userEvent.setup()
    const props = getProps({
      min: "2020-01-05",
      // Choose default so min is in the default page when the widget is opened.
      default: ["2020-01-15"],
    })

    render(<DateInput {...props} />)
    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)
    await user.click(year)

    expect(
      await screen.findByLabelText("Saturday, January 4, 2020")
    ).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.getByLabelText(/Sunday, January 5, 2020/)
    ).not.toHaveAttribute("aria-disabled")
  })

  it("has a maxDate if it is passed", async () => {
    const user = userEvent.setup()
    const props = getProps({
      max: "2020-01-25",
      // Choose default so min is in the default page when the widget is opened.
      default: ["2020-01-15"],
    })

    render(<DateInput {...props} />)
    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)
    await user.click(year)

    expect(
      await screen.findByLabelText(/Saturday, January 25, 2020/)
    ).not.toHaveAttribute("aria-disabled")
    expect(screen.getByLabelText("Sunday, January 26, 2020")).toHaveAttribute(
      "aria-disabled",
      "true"
    )
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    const region = screen.getByTestId("stDateInput")
    const { year, month, day } = getSingleDateSegments(region)

    await typeIntoSegment(user, year, "2020")
    await typeIntoSegment(user, month, "02")
    await typeIntoSegment(user, day, "06")

    await waitFor(() => {
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [newDateWire],
        {
          fromUi: true,
        },
        undefined
      )
    })

    act(() => {
      // "Submit" the form
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    expect(year).toHaveTextContent(originalDateWire.split("-")[0])
    expect(month).toHaveTextContent(originalDateWire.split("-")[1])
    expect(day).toHaveTextContent(originalDateWire.split("-")[2])
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      [originalDateWire],
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("clears validation error state when form is cleared", async () => {
    const user = userEvent.setup()
    const props = getProps({
      formId: "form",
      default: ["2026-01-15"],
      min: "2026-01-01",
      max: "2026-12-31",
    })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    render(<DateInput {...props} />)
    const region = screen.getByTestId("stDateInput")
    const { year, month, day } = getSingleDateSegments(region)

    await typeIntoSegment(user, year, "2025")
    await typeIntoSegment(user, month, "12")
    await typeIntoSegment(user, day, "01")

    expect(
      await screen.findByTestId("stTooltipErrorHoverTarget")
    ).toBeVisible()

    act(() => {
      props.widgetMgr.submitForm("form", undefined)
    })

    await waitFor(() => {
      expect(
        screen.queryByTestId("stTooltipErrorHoverTarget")
      ).not.toBeInTheDocument()
    })
    expect(year).toHaveTextContent("2026")
    expect(month).toHaveTextContent("01")
    expect(day).toHaveTextContent("15")
  })

  describe("localization", () => {
    const getCalendarHeader = async (): Promise<HTMLElement> => {
      const calendar = await screen.findByTestId("stDateInputCalendar")
      // CalendarGridHeader's <thead> has no accessible role to query by
      // (it's aria-hidden, since day-of-week names aren't independently
      // meaningful outside the grid).
      const thead = calendar.querySelector("thead")
      if (!thead) throw new Error("Calendar header not found")
      return thead
    }

    const openCalendar = async (
      user: ReturnType<typeof userEvent.setup>
    ): Promise<void> => {
      const region = screen.getByTestId("stDateInput")
      const { year } = getSingleDateSegments(region)
      await user.click(year)
    }

    describe("with a locale whose week starts on Monday", () => {
      const locale = "de"

      it("renders expected week day ordering", async () => {
        const user = userEvent.setup()
        const props = getProps()
        renderWithContexts(<DateInput {...props} />, {
          libConfigContext: { locale },
        })

        await openCalendar(user)

        expect(await getCalendarHeader()).toHaveTextContent("MoDiMiDoFrSaSo")
      })
    })

    describe("with a locale whose week starts on Saturday", () => {
      const locale = "ar"

      it("renders expected week day ordering", async () => {
        const user = userEvent.setup()
        const props = getProps()
        renderWithContexts(<DateInput {...props} />, {
          libConfigContext: { locale },
        })

        await openCalendar(user)

        expect(await getCalendarHeader()).toHaveTextContent(
          "السبتالأحدالاثنينالثلاثاءالأربعاءالخميسالجمعة"
        )
      })
    })

    describe("with a locale whose week starts on Sunday", () => {
      const locale = "en-US"

      it("renders expected week day ordering", async () => {
        const user = userEvent.setup()
        const props = getProps()
        renderWithContexts(<DateInput {...props} />, {
          libConfigContext: { locale },
        })

        await openCalendar(user)

        expect(await getCalendarHeader()).toHaveTextContent(
          "SunMonTueWedThuFriSat"
        )
      })
    })

    describe("with an invalid locale", () => {
      const locale = "does-not-exist"

      it("falls back to en-US locale", async () => {
        const user = userEvent.setup()
        const props = getProps()
        renderWithContexts(<DateInput {...props} />, {
          libConfigContext: { locale },
        })

        await openCalendar(user)

        expect(await getCalendarHeader()).toHaveTextContent(
          "SunMonTueWedThuFriSat"
        )
      })
    })
  })

  describe("quick select feature", () => {
    it("hides quick select for range date inputs if minDate is within 2 years", async () => {
      const user = userEvent.setup()
      const recentMinDate = moment().subtract(1, "year").format("YYYY-MM-DD")
      const props = getProps({
        isRange: true,
        min: recentMinDate,
        default: [
          recentMinDate,
          moment(recentMinDate).add(1, "day").format("YYYY-MM-DD"),
        ],
      })

      render(<DateInput {...props} />)

      const dateInput = screen.getByTestId("stDateInputField")
      await user.click(dateInput)

      // Quick select should not be visible
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    })

    it("shows quick select for range date inputs if minDate is older than 2 years", async () => {
      const user = userEvent.setup()
      const oldMinDate = "2020-01-01"
      const props = getProps({
        isRange: true,
        min: oldMinDate,
        default: [
          oldMinDate,
          moment(oldMinDate).add(1, "day").format("YYYY-MM-DD"),
        ],
      })

      render(<DateInput {...props} />)

      const dateInput = screen.getByTestId("stDateInputField")
      await user.click(dateInput)

      // Quick select should be visible
      const quickSelect = screen.getByRole("combobox")
      expect(quickSelect).toBeVisible()
    })

    it("shows quick select by default because minDate is 1970", async () => {
      const user = userEvent.setup()
      const props = getProps({
        isRange: true,
        default: ["2020-01-01", "2020-01-31"],
      })

      render(<DateInput {...props} />)

      const dateInput = screen.getByTestId("stDateInputField")
      await user.click(dateInput)

      // Quick select should be visible for range inputs with old minDate
      const quickSelect = screen.getByRole("combobox")
      expect(quickSelect).toBeVisible()
    })

    it("does not show quick select for single date inputs", async () => {
      const user = userEvent.setup()
      const props = getProps({
        isRange: false,
        default: ["2020-01-01"],
      })

      render(<DateInput {...props} />)
      const region = screen.getByTestId("stDateInput")
      const { year } = getSingleDateSegments(region)
      await user.click(year)

      // The calendar's own month/year <select>s are comboboxes too (native
      // <select> elements), so assert on their *names* rather than on
      // "no comboboxes at all" — quick select would show as a combobox
      // with a different accessible name (e.g. a date-range preset list).
      // The calendar's own month/year pickers are buttons that open a
      // listbox (`aria-haspopup="listbox"`), so assert on their *names*
      // rather than on "no buttons at all" — quick select would show as a
      // combobox with a different accessible name (e.g. a date-range
      // preset list), which stays absent here.
      const pickerNames = screen
        .queryAllByRole("button", { expanded: false })
        .filter(el => el.getAttribute("aria-haspopup") === "listbox")
        .map(el => el.getAttribute("aria-label"))
      expect(pickerNames.sort()).toEqual(["month", "year"])
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    })

    describe("quick select range", () => {
      let spy: MockInstance
      const RealDate = Date

      beforeEach(() => {
        const STATIC_NOW = 1732112581000
        // Freeze both Date and moment.now so BaseWeb quick select and our code
        // agree on "now"
        const MockDate = class extends RealDate {
          constructor(...args: unknown[]) {
            super()
            // If no args, return fixed date instance
            if (args.length === 0) {
              return new RealDate(STATIC_NOW)
            }

            return new RealDate(
              ...(args as ConstructorParameters<typeof RealDate>)
            )
          }

          static override now(): number {
            return STATIC_NOW
          }
        }

        globalThis.Date = MockDate as never
        spy = vi.spyOn(moment, "now").mockReturnValue(STATIC_NOW)
      })

      afterEach(() => {
        spy.mockRestore()
        globalThis.Date = RealDate
      })

      it("commits quick select range ending today within max without error", async () => {
        const user = userEvent.setup()

        const today = moment().format("YYYY-MM-DD")
        const minDate = moment().subtract(800, "days").format("YYYY-MM-DD")

        const props = getProps({
          isRange: true,
          min: minDate,
          max: today,
          default: [minDate, today],
          format: "MM.DD.YYYY",
        })

        render(<DateInput {...props} />)

        // Spy after initial mount commit
        vi.spyOn(props.widgetMgr, "setStringArrayValue")

        const dateInput = screen.getByTestId("stDateInputField")
        await user.click(dateInput)

        // Quick select should be visible
        const quickSelect = screen.getByRole("combobox")
        expect(quickSelect).toBeVisible()

        // Open quick select options and choose "Past Week" via accessible role/name
        await user.click(quickSelect)
        const pastWeekOption = await screen.findByRole("option", {
          name: /Past\s*Week/i,
        })
        await user.click(pastWeekOption)

        // Expect no error icon (wait for async updates) and the selection to be committed
        await waitFor(() => {
          expect(
            screen.queryByTestId("stTooltipErrorHoverTarget")
          ).not.toBeInTheDocument()
        })
        expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalled()
      })
    })
  })
})

describe("DateInput keyboard navigation and focus management", () => {
  const openCalendarAndGetGrid = async (
    user: ReturnType<typeof userEvent.setup>
  ): Promise<{
    calendar: HTMLElement
    gridCell: HTMLElement
    segments: { year: HTMLElement; month: HTMLElement; day: HTMLElement }
  }> => {
    const region = screen.getByTestId("stDateInput")
    const segments = getSingleDateSegments(region)
    await user.click(segments.year)
    const calendar = await screen.findByTestId("stDateInputCalendar")
    const gridCell = within(calendar).getByRole("button", {
      name: /January 20, 1970/,
    })
    return { calendar, gridCell, segments }
  }

  it("Tab from last segment focuses the calendar grid cell", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const region = screen.getByTestId("stDateInput")
    const { day } = getSingleDateSegments(region)

    // Focus the last segment (day)
    await user.click(day)
    // Calendar should be open
    await screen.findByTestId("stDateInputCalendar")

    // Tab from day segment should move focus into the calendar grid
    await user.tab()
    const calendar = screen.getByTestId("stDateInputCalendar")
    const focusedCell = within(calendar).getByRole("button", {
      name: /January 20, 1970/,
    })
    expect(focusedCell).toHaveFocus()
  })

  it("Tab on grid cell closes calendar and returns focus to field", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const { gridCell, segments } = await openCalendarAndGetGrid(user)

    // Focus the grid cell directly
    act(() => gridCell.focus())
    expect(gridCell).toHaveFocus()

    // Tab should close the calendar and return focus to the field
    await user.tab()

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
    // Focus should be on the last segment (day)
    expect(segments.day).toHaveFocus()
  })

  it("Shift+Tab on grid cell moves focus to last header button", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const { calendar, gridCell } = await openCalendarAndGetGrid(user)

    act(() => gridCell.focus())
    expect(gridCell).toHaveFocus()

    // Shift+Tab should move to the last header element (Next month button)
    await user.tab({ shift: true })
    const nextMonthBtn = within(calendar).getByLabelText("Next month")
    expect(nextMonthBtn).toHaveFocus()
  })

  it("Shift+Tab on first header button wraps to grid cell", async () => {
    const user = userEvent.setup()
    // Use a value well past min so Previous month button is enabled
    render(
      <DateInput
        {...getProps({ default: ["2020-06-15"], min: "2000-01-01" })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)
    await user.click(year)
    const calendar = await screen.findByTestId("stDateInputCalendar")

    // Focus the first header button (Previous month)
    const prevMonthBtn = within(calendar).getByLabelText("Previous month")
    act(() => prevMonthBtn.focus())
    expect(prevMonthBtn).toHaveFocus()

    // Shift+Tab should wrap to the grid cell
    await user.tab({ shift: true })
    const gridCell = within(calendar).getByRole("button", {
      name: /June 15, 2020/,
    })
    expect(gridCell).toHaveFocus()
  })

  it("Escape closes calendar and returns focus to field", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const { gridCell, segments } = await openCalendarAndGetGrid(user)

    act(() => gridCell.focus())
    expect(gridCell).toHaveFocus()

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
    expect(segments.day).toHaveFocus()
  })

  it("selecting a date closes calendar and returns focus to field", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<DateInput {...props} />)

    const { calendar, segments } = await openCalendarAndGetGrid(user)

    // Click a different date in the calendar
    const otherDay = within(calendar).getByRole("button", {
      name: /January 25, 1970/,
    })
    await user.click(otherDay)

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
    expect(segments.day).toHaveFocus()
  })

  it("Enter on a focused grid cell selects date and closes calendar", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateInput {...props} />)

    const { gridCell, segments } = await openCalendarAndGetGrid(user)

    act(() => gridCell.focus())
    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
    expect(segments.day).toHaveFocus()
  })

  it("calendar opens when any segment receives focus", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const region = screen.getByTestId("stDateInput")
    const { month } = getSingleDateSegments(region)

    await user.click(month)
    expect(
      await screen.findByTestId("stDateInputCalendar")
    ).toBeInTheDocument()
  })

  it("outside click closes calendar", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)
    await user.click(year)
    await screen.findByTestId("stDateInputCalendar")

    await user.click(document.body)

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
  })
})

describe("DateInput query param binding", () => {
  it("registers query param binding on mount when queryParamKey is set", () => {
    const props = getProps({ queryParamKey: "my_date" })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<DateInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_date",
      "string_array_value",
      expect.any(Array),
      false,
      undefined
    )
  })

  it("unregisters query param binding on unmount", () => {
    const props = getProps({ queryParamKey: "my_date" })
    const unregisterSpy = vi.spyOn(
      props.widgetMgr,
      "unregisterQueryParamBinding"
    )

    const { unmount } = render(<DateInput {...props} />)

    unregisterSpy.mockClear()
    unmount()

    expect(props.widgetMgr.unregisterQueryParamBinding).toHaveBeenCalledWith(
      props.element.id
    )
  })

  it("does not register query param binding when queryParamKey is not set", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<DateInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
  })

  it("registers with clearable=true when default is empty", () => {
    const props = getProps({ queryParamKey: "my_date", default: [] })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<DateInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_date",
      "string_array_value",
      expect.any(Array),
      true,
      undefined
    )
  })

  it("registers with urlFormat='repeated' for range mode", () => {
    const props = getProps({
      queryParamKey: "my_date",
      isRange: true,
      default: ["2025-03-01", "2025-03-15"],
    })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<DateInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_date",
      "string_array_value",
      expect.any(Array),
      false,
      "repeated"
    )
  })

  it("uses URL-seeded value (setValue) instead of proto default", () => {
    const seededDateWire = "2025-08-20"
    const props = getProps({
      queryParamKey: "my_date",
      value: [seededDateWire],
      setValue: true,
    })

    render(<DateInput {...props} />)
    const region = screen.getByTestId("stDateInput")

    const { year, month, day } = getSingleDateSegments(region)
    expect(year).toHaveTextContent("2025")
    expect(month).toHaveTextContent("08")
    expect(day).toHaveTextContent("20")
  })

  it("uses URL-seeded range value instead of proto default", () => {
    const props = getProps({
      queryParamKey: "my_date",
      isRange: true,
      default: ["2025-03-01", "2025-03-15"],
      value: ["2025-07-01", "2025-07-10"],
      setValue: true,
    })

    render(<DateInput {...props} />)

    const input = screen.getByTestId("stDateInputField")
    expect(input).toHaveValue("2025/07/01 – 2025/07/10")
    expect(input).not.toHaveValue("2025/03/01 – 2025/03/15")
  })
})
