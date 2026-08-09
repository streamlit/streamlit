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

import { CalendarDate } from "@internationalized/date"
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { setInteractionModality } from "react-aria/private/interactions/useFocusVisible"

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

const getSingleDateSegments = (
  region: HTMLElement
): { year: HTMLElement; month: HTMLElement; day: HTMLElement } => ({
  year: within(region).getByRole("spinbutton", { name: /year/i }),
  month: within(region).getByRole("spinbutton", { name: /month/i }),
  day: within(region).getByRole("spinbutton", { name: /day/i }),
})

const getRangeDateSegments = (
  region: HTMLElement,
  part: "start" | "end"
): { year: HTMLElement; month: HTMLElement; day: HTMLElement } => ({
  year: within(region).getByRole("spinbutton", {
    name: new RegExp(`year.*${part} date`, "i"),
  }),
  month: within(region).getByRole("spinbutton", {
    name: new RegExp(`month.*${part} date`, "i"),
  }),
  day: within(region).getByRole("spinbutton", {
    name: new RegExp(`day.*${part} date`, "i"),
  }),
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

describe("DateInput", () => {
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

    // Segment edits are buffered locally and committed on popover close.
    await user.click(document.body)

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
    const region = screen.getByTestId("stDateInput")
    const start = getRangeDateSegments(region, "start")

    await typeIntoSegment(user, start.year, "2019")
    await typeIntoSegment(user, start.month, "01")
    await typeIntoSegment(user, start.day, "05")

    const errorIcon = await screen.findByTestId("stTooltipErrorHoverTarget")
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
    const region = screen.getByTestId("stDateInput")
    const end = getRangeDateSegments(region, "end")

    await typeIntoSegment(user, end.year, "2021")
    await typeIntoSegment(user, end.month, "02")
    await typeIntoSegment(user, end.day, "07")

    const errorIcon = await screen.findByTestId("stTooltipErrorHoverTarget")
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

    // Close the popover — commit-on-close should also reject the invalid date.
    await user.keyboard("{Escape}")
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

    // Close the popover via Escape.
    await user.keyboard("{Escape}")

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

    // React Aria's `Calendar` marks out-of-range cells `aria-disabled`;
    // the day before `min` should be disabled, `min` itself shouldn't be.
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

    // Segment edits are buffered locally and committed on popover close.
    await user.click(document.body)

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

  it("commits pending value on blur when inside a form (form-submit race fix)", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    const region = screen.getByTestId("stDateInput")
    const { year, month, day } = getSingleDateSegments(region)

    await typeIntoSegment(user, year, "2020")
    await typeIntoSegment(user, month, "02")
    await typeIntoSegment(user, day, "06")

    // Before blur: segment edits are buffered locally — no widget write yet.
    expect(props.widgetMgr.setStringArrayValue).not.toHaveBeenCalled()

    // Blur (simulates clicking a form Submit button) writes the pending
    // value synchronously so form submit reads the correct state.
    await user.tab()
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [newDateWire],
      { fromUi: true },
      undefined
    )
  })

  it("does not commit placeholder state on blur in a form (partially typed)", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)

    // Partially clear the year segment (leaves placeholders in year,
    // but month and day remain filled — a mid-edit state)
    await clearSegment(user, year)

    // Blur should NOT commit the partially typed state — form submit
    // should read the original committed value, not an incomplete date.
    await user.tab()
    expect(props.widgetMgr.setStringArrayValue).not.toHaveBeenCalled()
  })

  it("commits cleared value on blur when all segments are cleared in a clearable form widget", async () => {
    const user = userEvent.setup()
    // default: [] makes the widget clearable
    const props = getProps({ formId: "form", default: [] })
    props.widgetMgr.setFormSubmitBehaviors("form", true)
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    // Pre-seed widget state so the widget starts with a committed value
    props.widgetMgr.setStringArrayValue(
      props.element,
      [originalDateWire],
      { fromUi: false },
      undefined
    )

    render(<DateInput {...props} />)
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    const region = screen.getByTestId("stDateInput")
    const { year, month, day } = getSingleDateSegments(region)

    // Clear ALL segments — deliberate empty intent
    await clearSegment(user, year)
    await clearSegment(user, month)
    await clearSegment(user, day)

    // Blur should commit the cleared state — fully cleared is a valid
    // user intent, distinct from partially typed (mid-edit).
    await user.tab()
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [],
      { fromUi: true },
      undefined
    )
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

        expect(await getCalendarHeader()).toHaveTextContent("MDMDFSS")
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

        expect(await getCalendarHeader()).toHaveTextContent("سحنثرخج")
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

        expect(await getCalendarHeader()).toHaveTextContent("SMTWTFS")
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

        expect(await getCalendarHeader()).toHaveTextContent("SMTWTFS")
      })
    })
  })

  describe("quick select feature", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("hides quick select for range date inputs if minDate is within 2 years", async () => {
      vi.setSystemTime(new Date(2025, 0, 1))
      const user = userEvent.setup()
      const recentMin = new CalendarDate(2024, 1, 1)
      const recentMinDate = recentMin.toString()
      const props = getProps({
        isRange: true,
        min: recentMinDate,
        default: [recentMinDate, recentMin.add({ days: 1 }).toString()],
      })

      render(<DateInput {...props} />)
      const region = screen.getByTestId("stDateInput")
      const { year } = getRangeDateSegments(region, "start")
      await user.click(year)

      // Verify calendar is open but quick-select is absent.
      await screen.findByTestId("stDateInputCalendar")
      expect(
        screen.queryByRole("button", { name: /quick select/i })
      ).not.toBeInTheDocument()
    })

    it("shows quick select for range date inputs if minDate is older than 2 years", async () => {
      const user = userEvent.setup()
      const oldMinDate = "2020-01-01"
      const props = getProps({
        isRange: true,
        min: oldMinDate,
        default: [oldMinDate, "2020-01-02"],
      })

      render(<DateInput {...props} />)
      const region = screen.getByTestId("stDateInput")
      const { year } = getRangeDateSegments(region, "start")
      await user.click(year)

      // Quick select should be visible as a button trigger for the RAC Select.
      const quickSelect = await screen.findByRole("button", {
        name: /quick select/i,
      })
      expect(quickSelect).toBeVisible()
    })

    it("shows quick select by default because minDate is 1970", async () => {
      const user = userEvent.setup()
      const props = getProps({
        isRange: true,
        default: ["2020-01-01", "2020-01-31"],
      })

      render(<DateInput {...props} />)
      const region = screen.getByTestId("stDateInput")
      const { year } = getRangeDateSegments(region, "start")
      await user.click(year)

      // Quick select should be visible for range inputs with old minDate
      const quickSelect = await screen.findByRole("button", {
        name: /quick select/i,
      })
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

      // The calendar's month/year pickers are buttons that open a
      // listbox (`aria-haspopup="listbox"`). Quick select (absent here)
      // would be the only combobox role.
      const pickerNames = screen
        .queryAllByRole("button", { expanded: false })
        .filter(el => el.getAttribute("aria-haspopup") === "listbox")
        .map(el => el.getAttribute("aria-label"))
      expect(pickerNames.sort()).toEqual(["month", "year"])
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    })

    describe("quick select range", () => {
      const RealDate = Date
      // 2024-11-20 frozen for deterministic quick-select assertions
      const STATIC_NOW = 1732112581000
      const frozenToday = "2024-11-20"
      const frozen800DaysAgo = new CalendarDate(2024, 11, 20)
        .subtract({ days: 800 })
        .toString()

      beforeEach(() => {
        const MockDate = class extends RealDate {
          constructor(...args: unknown[]) {
            super()
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
      })

      afterEach(() => {
        globalThis.Date = RealDate
      })

      it("commits quick select range ending today within max without error", async () => {
        const user = userEvent.setup()

        const today = frozenToday
        const minDate = frozen800DaysAgo

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

        const region = screen.getByTestId("stDateInput")
        const { year } = getRangeDateSegments(region, "start")
        await user.click(year)

        // Quick select button trigger should be visible
        const quickSelect = await screen.findByRole("button", {
          name: /quick select/i,
        })
        expect(quickSelect).toBeVisible()

        // Open the quick select dropdown and pick "Past Week"
        await user.click(quickSelect)
        const pastWeekOption = await screen.findByRole("option", {
          name: "Past Week",
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

      it("selecting a preset keeps the calendar popover open", async () => {
        const user = userEvent.setup()
        const today = frozenToday
        const minDate = frozen800DaysAgo

        const props = getProps({
          isRange: true,
          min: minDate,
          max: today,
          default: [minDate, today],
        })

        render(<DateInput {...props} />)
        const region = screen.getByTestId("stDateInput")
        const { year } = getRangeDateSegments(region, "start")
        await user.click(year)

        const quickSelect = await screen.findByRole("button", {
          name: /quick select/i,
        })
        await user.click(quickSelect)
        const pastWeekOption = await screen.findByRole("option", {
          name: "Past Week",
        })
        await user.click(pastWeekOption)

        // Calendar should still be visible after selecting a preset
        expect(screen.getByTestId("stDateInputCalendar")).toBeInTheDocument()
      })

      it("re-clicking the active preset deselects it and clears the range on a clearable widget", async () => {
        const user = userEvent.setup()
        const today = frozenToday
        const minDate = frozen800DaysAgo

        const props = getProps({
          isRange: true,
          min: minDate,
          max: today,
          default: [],
        })

        render(<DateInput {...props} />)
        vi.spyOn(props.widgetMgr, "setStringArrayValue")

        const region = screen.getByTestId("stDateInput")
        const { year } = getRangeDateSegments(region, "start")
        await user.click(year)

        // Select "Past Week"
        const quickSelect = await screen.findByRole("button", {
          name: /quick select/i,
        })
        await user.click(quickSelect)
        const pastWeekOption = await screen.findByRole("option", {
          name: "Past Week",
        })
        await user.click(pastWeekOption)

        // Trigger should now show "Past Week"
        expect(quickSelect).toHaveTextContent("Past Week")

        // Re-open and click "Past Week" again to deselect
        await user.click(quickSelect)
        const pastWeekAgain = await screen.findByRole("option", {
          name: "Past Week",
        })
        await user.click(pastWeekAgain)

        // Should have cleared the range (empty array committed)
        expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
          expect.anything(),
          [],
          expect.objectContaining({ fromUi: true }),
          undefined
        )
      })

      it("does not allow deselecting a preset on a non-clearable widget", async () => {
        const user = userEvent.setup()
        const today = frozenToday
        const minDate = frozen800DaysAgo

        const props = getProps({
          isRange: true,
          min: minDate,
          max: today,
          default: [minDate, today],
        })

        render(<DateInput {...props} />)
        vi.spyOn(props.widgetMgr, "setStringArrayValue")

        const region = screen.getByTestId("stDateInput")
        const { year } = getRangeDateSegments(region, "start")
        await user.click(year)

        // Select "Past Week"
        const quickSelect = await screen.findByRole("button", {
          name: /quick select/i,
        })
        await user.click(quickSelect)
        const pastWeekOption = await screen.findByRole("option", {
          name: "Past Week",
        })
        await user.click(pastWeekOption)

        expect(quickSelect).toHaveTextContent("Past Week")

        // Re-open and click "Past Week" again — should NOT deselect
        await user.click(quickSelect)
        const pastWeekAgain = await screen.findByRole("option", {
          name: "Past Week",
        })
        await user.click(pastWeekAgain)

        // Preset should remain selected (not cleared to empty)
        expect(quickSelect).toHaveTextContent("Past Week")
        expect(
          props.widgetMgr.setStringArrayValue
        ).not.toHaveBeenLastCalledWith(
          expect.anything(),
          [],
          expect.anything(),
          expect.anything()
        )
      })

      it("trigger displays preset label when range matches, 'Select...' otherwise", async () => {
        const user = userEvent.setup()
        const today = frozenToday
        const minDate = frozen800DaysAgo

        const props = getProps({
          isRange: true,
          min: minDate,
          max: today,
          default: [minDate, today],
        })

        render(<DateInput {...props} />)
        const region = screen.getByTestId("stDateInput")
        const { year } = getRangeDateSegments(region, "start")
        await user.click(year)

        // Initially should show "Select..." since default range doesn't match a preset
        const quickSelect = await screen.findByRole("button", {
          name: /quick select/i,
        })
        expect(quickSelect).toHaveTextContent("Select...")

        // Select "Past Week" - trigger should show the preset label
        await user.click(quickSelect)
        const pastWeekOption = await screen.findByRole("option", {
          name: "Past Week",
        })
        await user.click(pastWeekOption)
        expect(quickSelect).toHaveTextContent("Past Week")
      })

      it("Escape in the quick-select dropdown closes only the dropdown, not the calendar", async () => {
        const user = userEvent.setup()
        const today = frozenToday
        const minDate = frozen800DaysAgo

        const props = getProps({
          isRange: true,
          min: minDate,
          max: today,
          default: [minDate, today],
        })

        render(<DateInput {...props} />)
        const region = screen.getByTestId("stDateInput")
        const { year } = getRangeDateSegments(region, "start")
        await user.click(year)

        // Open the quick select dropdown
        const quickSelect = await screen.findByRole("button", {
          name: /quick select/i,
        })
        await user.click(quickSelect)
        expect(
          screen.getByRole("listbox", { name: /quick select/i })
        ).toBeInTheDocument()

        // Press Escape — should close only the dropdown
        await user.keyboard("{Escape}")
        await waitFor(() => {
          expect(
            screen.queryByRole("listbox", { name: /quick select/i })
          ).not.toBeInTheDocument()
        })

        // Calendar should still be visible
        expect(screen.getByTestId("stDateInputCalendar")).toBeInTheDocument()
      })

      it("clicking outside the quick-select dropdown closes it", async () => {
        const user = userEvent.setup()
        const today = frozenToday
        const minDate = frozen800DaysAgo

        const props = getProps({
          isRange: true,
          min: minDate,
          max: today,
          default: [minDate, today],
        })

        render(<DateInput {...props} />)
        const region = screen.getByTestId("stDateInput")
        const { year } = getRangeDateSegments(region, "start")
        await user.click(year)

        // Open the quick select dropdown
        const quickSelect = await screen.findByRole("button", {
          name: /quick select/i,
        })
        await user.click(quickSelect)
        expect(
          screen.getByRole("listbox", { name: /quick select/i })
        ).toBeInTheDocument()

        // Click on the calendar grid (outside the quick-select row)
        const calendarGrid = screen.getByRole("grid")
        await user.click(calendarGrid)

        // Dropdown should close
        await waitFor(() => {
          expect(
            screen.queryByRole("listbox", { name: /quick select/i })
          ).not.toBeInTheDocument()
        })
      })

      it("dropdown opens with all 6 preset options", async () => {
        const user = userEvent.setup()
        const today = frozenToday
        const minDate = frozen800DaysAgo

        const props = getProps({
          isRange: true,
          min: minDate,
          max: today,
          default: [minDate, today],
        })

        render(<DateInput {...props} />)
        const region = screen.getByTestId("stDateInput")
        const { year } = getRangeDateSegments(region, "start")
        await user.click(year)

        // Open the quick select dropdown
        const quickSelect = await screen.findByRole("button", {
          name: /quick select/i,
        })
        await user.click(quickSelect)

        // All 6 presets should be listed
        const options = screen.getAllByRole("option")
        expect(options).toHaveLength(6)
        expect(options[0]).toHaveTextContent("Past Week")
        expect(options[1]).toHaveTextContent("Past Month")
        expect(options[2]).toHaveTextContent("Past 3 Months")
        expect(options[3]).toHaveTextContent("Past 6 Months")
        expect(options[4]).toHaveTextContent("Past Year")
        expect(options[5]).toHaveTextContent("Past 2 Years")
      })
    })
  })

  describe("range mode selection and commit", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("renders a partial range value (start only) with an empty end field", () => {
      const props = getProps({
        isRange: true,
        default: ["2019-07-06"],
      })
      render(<DateInput {...props} />)
      const region = screen.getByTestId("stDateInput")

      const start = getRangeDateSegments(region, "start")
      expect(start.year).toHaveTextContent("2019")
      expect(start.month).toHaveTextContent("07")
      expect(start.day).toHaveTextContent("06")

      const end = getRangeDateSegments(region, "end")
      expect(end.year).toHaveTextContent("yyyy")
      expect(end.month).toHaveTextContent("mm")
      expect(end.day).toHaveTextContent("dd")
    })

    it("does not revert to the default range when closed empty, unlike single mode", async () => {
      const user = userEvent.setup()
      const props = getProps({
        isRange: true,
        default: ["2019-07-06", "2019-07-08"],
      })
      render(<DateInput {...props} />)
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      const region = screen.getByTestId("stDateInput")
      const start = getRangeDateSegments(region, "start")
      const end = getRangeDateSegments(region, "end")

      await clearSegment(user, start.year)
      await clearSegment(user, start.month)
      await clearSegment(user, start.day)
      await clearSegment(user, end.year)
      await clearSegment(user, end.month)
      await clearSegment(user, end.day)

      // Range mode commits empty on close-empty (unlike single mode which reverts to default).
      await user.click(document.body)

      await waitFor(() => {
        expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
          props.element,
          [],
          { fromUi: true },
          undefined
        )
      })
      expect(start.year).toHaveTextContent("yyyy")
      expect(end.year).toHaveTextContent("yyyy")
    })

    it("clears the whole range (not just the start) when the start field is cleared while an end date remains", async () => {
      const user = userEvent.setup()
      const props = getProps({
        isRange: true,
        default: [],
        value: ["2019-07-06", "2019-07-08"],
        setValue: true,
      })
      render(<DateInput {...props} />)
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      const region = screen.getByTestId("stDateInput")
      const { year, month, day } = getRangeDateSegments(region, "start")

      // Clearing every segment of the start field makes displayStart null,
      // which also clears displayEnd (can't have end without start). The
      // commit fires on popover close — not immediately — because segment
      // edits are buffered.
      await clearSegment(user, year)
      await clearSegment(user, month)
      await clearSegment(user, day)

      // Close the popover to trigger commit-on-close.
      await user.click(document.body)

      await waitFor(() => {
        expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
          props.element,
          [],
          { fromUi: true },
          undefined
        )
      })

      const end = getRangeDateSegments(region, "end")
      expect(end.year).toHaveTextContent("yyyy")
      expect(end.month).toHaveTextContent("mm")
      expect(end.day).toHaveTextContent("dd")
    })

    it("completes a pre-existing partial range (one default date) on the next calendar click", async () => {
      const user = userEvent.setup()
      // AnchorDateWatcher's seedAnchor logic (RangeDateInput.tsx) needs the
      // calendar to open on a page containing both the pre-existing default
      // date and the target click date — freeze "today" so opening the
      // popover focuses a predictable month regardless of the real date.
      vi.setSystemTime(new Date(2019, 6, 15)) // 2019-07-15

      const props = getProps({
        isRange: true,
        default: ["2019-07-06"],
      })
      render(<DateInput {...props} />)
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      const region = screen.getByTestId("stDateInput")
      const { year } = getRangeDateSegments(region, "start")
      await user.click(year)

      // Click a second date — since the widget already has a single
      // default date (2019-07-06) with no end yet, this must *complete*
      // that pending range rather than start a brand-new one (see
      // AnchorDateWatcher's seedAnchor docstring in RangeDateInput.tsx).
      await user.click(
        await screen.findByLabelText("Wednesday, July 10, 2019")
      )

      await waitFor(() => {
        expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
          props.element,
          ["2019-07-06", "2019-07-10"],
          { fromUi: true },
          undefined
        )
      })
    })

    it("commits a one-element array after the first calendar click (anchor-only selection)", async () => {
      const user = userEvent.setup()
      // Calendar with no value/default open to the current real-world
      // month, which isn't deterministic — freeze "today" (a Friday) so
      // the calendar opens on a known page and the target cells' exact
      // accessible names (weekday included) are predictable.
      vi.setSystemTime(new Date(2024, 2, 15))

      const props = getProps({
        isRange: true,
        default: [],
        min: "2019-07-01",
      })
      render(<DateInput {...props} />)
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      const region = screen.getByTestId("stDateInput")
      const { year } = getRangeDateSegments(region, "start")
      await user.click(year)

      await user.click(
        await screen.findByLabelText("Wednesday, March 6, 2024")
      )

      // First click sets the anchor; RangeCalendar's onChange fires only on
      // the second click, so this commit comes from the anchor-click path.
      await waitFor(() => {
        expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
          props.element,
          ["2024-03-06"],
          { fromUi: true },
          undefined
        )
      })

      // Popover should still be open — a partial selection doesn't close it.
      expect(screen.getByTestId("stDateInputCalendar")).toBeVisible()

      await user.click(await screen.findByLabelText("Sunday, March 10, 2024"))

      await waitFor(() => {
        expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
          props.element,
          ["2024-03-06", "2024-03-10"],
          { fromUi: true },
          undefined
        )
      })
    })

    it("renders and commits a single-day range correctly (start === end)", async () => {
      const user = userEvent.setup()

      const props = getProps({
        isRange: true,
        default: [],
        value: ["2019-07-06", "2019-07-06"],
        setValue: true,
      })
      render(<DateInput {...props} />)
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      const region = screen.getByTestId("stDateInput")

      // Single-day range displays the same date in both fields
      const start = getRangeDateSegments(region, "start")
      const end = getRangeDateSegments(region, "end")
      expect(start.year).toHaveTextContent("2019")
      expect(start.month).toHaveTextContent("07")
      expect(start.day).toHaveTextContent("06")
      expect(end.year).toHaveTextContent("2019")
      expect(end.month).toHaveTextContent("07")
      expect(end.day).toHaveTextContent("06")

      // Clear button commits empty array (same as multi-day range)
      const clearButton = await screen.findByTestId("stDateInputClearButton")
      await user.click(clearButton)

      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [],
        { fromUi: true },
        undefined
      )
    })

    it("clicking a new date in an existing complete range starts a new selection", async () => {
      const user = userEvent.setup()
      vi.setSystemTime(new Date(2019, 6, 15))

      const props = getProps({
        isRange: true,
        default: ["2019-07-06", "2019-07-08"],
        min: "2019-01-01",
        max: "2019-12-31",
      })
      render(<DateInput {...props} />)
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      const region = screen.getByTestId("stDateInput")
      const { year } = getRangeDateSegments(region, "start")
      await user.click(year)

      // Click July 10 — should start a new range (anchor only)
      await user.click(
        await screen.findByLabelText("Wednesday, July 10, 2019")
      )

      await waitFor(() => {
        expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
          props.element,
          ["2019-07-10"],
          { fromUi: true },
          undefined
        )
      })

      // Calendar should still be open
      expect(screen.getByTestId("stDateInputCalendar")).toBeVisible()

      // Click July 12 — should complete the range
      await user.click(await screen.findByLabelText("Friday, July 12, 2019"))

      await waitFor(() => {
        expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
          props.element,
          ["2019-07-10", "2019-07-12"],
          { fromUi: true },
          undefined
        )
      })

      vi.useRealTimers()
    })

    it("commits an empty array when the clear button is clicked", async () => {
      const user = userEvent.setup()
      const props = getProps({
        isRange: true,
        default: [],
        value: ["2020-01-01", "2020-01-10"],
        setValue: true,
      })
      render(<DateInput {...props} />)
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      const clearButton = await screen.findByTestId("stDateInputClearButton")
      await user.click(clearButton)

      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [],
        { fromUi: true },
        undefined
      )
    })

    it("commits a one-element array when only the start field is typed", async () => {
      const user = userEvent.setup()
      const props = getProps({
        isRange: true,
        default: [],
      })
      render(<DateInput {...props} />)
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      const region = screen.getByTestId("stDateInput")
      const start = getRangeDateSegments(region, "start")
      await typeIntoSegment(user, start.year, "2020")
      await typeIntoSegment(user, start.month, "02")
      await typeIntoSegment(user, start.day, "06")

      // Close the popover to trigger commit-on-close (segment edits are
      // buffered and only committed when the popover closes).
      await user.click(document.body)

      await waitFor(() => {
        expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
          props.element,
          ["2020-02-06"],
          { fromUi: true },
          undefined
        )
      })
    })
  })
})

describe("DateInput single-mode keyboard navigation", () => {
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

  it("Tab from last segment closes calendar (does not enter it)", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const region = screen.getByTestId("stDateInput")
    const { day } = getSingleDateSegments(region)

    // Focus the last segment (day)
    await user.click(day)
    // Calendar should be open
    await screen.findByTestId("stDateInputCalendar")

    // Tab from day segment should close the calendar
    await user.tab()
    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
  })

  it("Tab in calendar closes popover and returns focus to field", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const { gridCell, segments } = await openCalendarAndGetGrid(user)

    // Focus the grid cell directly (simulates mouse click on a date)
    act(() => gridCell.focus())
    expect(gridCell).toHaveFocus()

    // Tab should close the calendar and return focus to the field
    await user.tab()

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
    expect(segments.day).toHaveFocus()
  })

  it("Shift+Tab in calendar closes popover and returns focus to field", async () => {
    const user = userEvent.setup()
    // Use a value well past min so Previous month button is enabled
    render(
      <DateInput
        {...getProps({ default: ["2020-06-15"], min: "2000-01-01" })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const segments = getSingleDateSegments(region)
    await user.click(segments.year)
    const calendar = await screen.findByTestId("stDateInputCalendar")

    // Focus a header button (simulates mouse click on prev month)
    const prevMonthBtn = within(calendar).getByLabelText("Previous month")
    act(() => prevMonthBtn.focus())
    expect(prevMonthBtn).toHaveFocus()

    // Shift+Tab should close calendar and return focus to field
    await user.tab({ shift: true })
    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
    expect(segments.day).toHaveFocus()
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

  it("calendar selection writes to WidgetStateManager exactly once", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateInput {...props} />)
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    const { calendar } = await openCalendarAndGetGrid(user)

    const otherDay = within(calendar).getByRole("button", {
      name: /January 25, 1970/,
    })
    await user.click(otherDay)

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })

    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledTimes(1)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      ["1970-01-25"],
      { fromUi: true },
      undefined
    )
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

  it("partially cleared segments revert to default on popover close (non-clearable)", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<DateInput {...props} />)

    const region = screen.getByTestId("stDateInput")
    const { year, month, day } = getSingleDateSegments(region)

    // Clear only year and month (not day) — partial clear.
    // clearSegment clicks the segment (opening the calendar) then
    // backspaces all digits.
    await clearSegment(user, year)
    await clearSegment(user, month)
    expect(year).toHaveTextContent("yyyy")
    expect(month).toHaveTextContent("mm")
    expect(day).toHaveTextContent("20")

    // Close via Escape.
    await user.keyboard("{Escape}")

    // Calendar should close
    await waitFor(
      () => {
        expect(
          screen.queryByTestId("stDateInputCalendar")
        ).not.toBeInTheDocument()
      },
      { timeout: 2000 }
    )

    // After close, segments should revert to the default value (1970/01/20).
    // SingleDateInput reports placeholder segments to handleClose, which
    // reverts the value to element.default. The controlled value change causes
    // the DateField to rebuild its segments.
    await waitFor(
      () => {
        const region2 = screen.getByTestId("stDateInput")
        const refreshedSegments = getSingleDateSegments(region2)
        expect(refreshedSegments.year).toHaveTextContent("1970")
        expect(refreshedSegments.month).toHaveTextContent("01")
        expect(refreshedSegments.day).toHaveTextContent("20")
      },
      { timeout: 2000 }
    )
  })

  it("arrow keys navigate between days in the calendar grid", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const { gridCell } = await openCalendarAndGetGrid(user)

    // Focus the selected cell (Jan 20, 1970)
    act(() => gridCell.focus())
    expect(gridCell).toHaveFocus()

    // Arrow right → Jan 21
    await user.keyboard("{ArrowRight}")
    const jan21 = screen.getByRole("button", { name: /January 21, 1970/ })
    expect(jan21).toHaveFocus()

    // Arrow down → Jan 28 (one week forward)
    await user.keyboard("{ArrowDown}")
    const jan28 = screen.getByRole("button", { name: /January 28, 1970/ })
    expect(jan28).toHaveFocus()

    // Arrow left → Jan 27
    await user.keyboard("{ArrowLeft}")
    const jan27 = screen.getByRole("button", { name: /January 27, 1970/ })
    expect(jan27).toHaveFocus()
  })

  it("calendar shows current month (not stale previous date) after clear", async () => {
    const user = userEvent.setup()
    // Make widget clearable
    const props = getProps({
      default: [],
      value: ["1970-01-20"],
      setValue: true,
      min: "1970-01-01",
    })
    render(<DateInput {...props} />)

    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)

    // Open calendar — should show January 1970 initially.
    await user.click(year)
    const calendar = await screen.findByTestId("stDateInputCalendar")
    expect(
      within(calendar).getByRole("button", { name: /January 20, 1970/ })
    ).toBeInTheDocument()

    // Close calendar and clear the date via the clear button.
    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })

    const clearButton = screen.getByTestId("stDateInputClearButton")
    await user.click(clearButton)

    // Reopen the calendar by clicking the (now placeholder) segment.
    const region2 = screen.getByTestId("stDateInput")
    const segments2 = getSingleDateSegments(region2)
    await user.click(segments2.year)
    const calendar2 = await screen.findByTestId("stDateInputCalendar")

    // The calendar should NOT show January 1970 anymore — it should have
    // reset to today's month
    expect(
      within(calendar2).queryByRole("button", { name: /January 20, 1970/ })
    ).not.toBeInTheDocument()
  })
})

describe("DateInput single-mode active calendar (Alt+ArrowDown)", () => {
  it("Alt+ArrowDown opens calendar in active mode with focus on grid cell", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)
    await user.click(year)
    await screen.findByTestId("stDateInputCalendar")

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

    await waitFor(() => {
      const calendar = screen.getByTestId("stDateInputCalendar")
      expect(calendar).toHaveAttribute("role", "dialog")
      expect(calendar).toHaveAttribute("aria-modal", "true")
      // Focus should be inside the calendar grid
      const focused = document.activeElement
      expect(calendar.contains(focused)).toBe(true)
      expect(focused?.getAttribute("tabindex")).toBe("0")
    })
  })

  it("Alt+ArrowDown opens calendar even if popover was closed", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)

    // Focus and close the popover via Tab
    await user.click(year)
    await screen.findByTestId("stDateInputCalendar")
    // Close by tabbing through all segments and out
    await user.tab() // to month
    await user.tab() // to day
    await user.tab() // leaves widget, closes popover
    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })

    // Go back to the field and press Alt+ArrowDown
    await user.click(year)
    await screen.findByTestId("stDateInputCalendar")
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

    await waitFor(() => {
      const calendar = screen.getByTestId("stDateInputCalendar")
      expect(calendar).toHaveAttribute("role", "dialog")
    })
  })

  it("Tab cycles within active calendar without closing", async () => {
    const user = userEvent.setup()
    render(
      <DateInput
        {...getProps({ default: ["2020-06-15"], min: "2000-01-01" })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)
    await user.click(year)
    await screen.findByTestId("stDateInputCalendar")

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

    await waitFor(() => {
      const calendar = screen.getByTestId("stDateInputCalendar")
      expect(calendar).toHaveAttribute("role", "dialog")
    })

    // Tab should cycle within the calendar, not close it
    await user.tab()
    expect(screen.getByTestId("stDateInputCalendar")).toBeVisible()
    await user.tab()
    expect(screen.getByTestId("stDateInputCalendar")).toBeVisible()
    await user.tab()
    expect(screen.getByTestId("stDateInputCalendar")).toBeVisible()
  })

  it("Escape from active calendar returns focus to originating segment", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const region = screen.getByTestId("stDateInput")
    const { month } = getSingleDateSegments(region)

    // Focus the month segment specifically
    await user.click(month)
    await screen.findByTestId("stDateInputCalendar")

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

    await waitFor(() => {
      const calendar = screen.getByTestId("stDateInputCalendar")
      expect(calendar).toHaveAttribute("role", "dialog")
    })

    // Escape should close and return focus to the month segment
    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
    expect(month).toHaveFocus()
  })

  it("selecting a date in active mode closes and returns focus to originating segment", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<DateInput {...props} />)

    const region = screen.getByTestId("stDateInput")
    const { month } = getSingleDateSegments(region)

    await user.click(month)
    const calendar = await screen.findByTestId("stDateInputCalendar")

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

    await waitFor(() => {
      expect(calendar).toHaveAttribute("role", "dialog")
      expect(calendar.contains(document.activeElement)).toBe(true)
    })

    // Navigate to a different date and select it
    await user.keyboard("{ArrowRight}")
    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
    expect(month).toHaveFocus()
  })

  it("passive mode still closes on Tab from last segment (no regression)", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const region = screen.getByTestId("stDateInput")
    const { day } = getSingleDateSegments(region)

    await user.click(day)
    await screen.findByTestId("stDateInputCalendar")

    // Calendar should NOT be in dialog mode
    const calendar = screen.getByTestId("stDateInputCalendar")
    expect(calendar).not.toHaveAttribute("role", "dialog")
    expect(calendar).not.toHaveAttribute("aria-modal")

    // Tab from day should close (passive behavior unchanged)
    await user.tab()
    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
  })

  it("wrapper has aria-keyshortcuts attribute", () => {
    render(<DateInput {...getProps()} />)
    const wrapper = screen.getByTestId("stDateInputField")
    expect(wrapper).toHaveAttribute("aria-keyshortcuts", "Alt+ArrowDown")
  })
})

describe("DateInput range-mode active calendar (Alt+ArrowDown)", () => {
  it("Alt+ArrowDown from start field segment enters active calendar", async () => {
    const user = userEvent.setup()
    render(
      <DateInput
        {...getProps({
          isRange: true,
          default: ["2019-07-06", "2019-07-08"],
        })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const { year } = getRangeDateSegments(region, "start")
    await user.click(year)
    await screen.findByTestId("stDateInputCalendar")

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

    await waitFor(() => {
      const calendar = screen.getByTestId("stDateInputCalendar")
      expect(calendar).toHaveAttribute("role", "dialog")
      expect(calendar).toHaveAttribute("aria-modal", "true")
    })
  })

  it("Alt+ArrowDown from end field segment enters active calendar", async () => {
    const user = userEvent.setup()
    render(
      <DateInput
        {...getProps({
          isRange: true,
          default: ["2019-07-06", "2019-07-08"],
        })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const { day } = getRangeDateSegments(region, "end")
    await user.click(day)
    await screen.findByTestId("stDateInputCalendar")

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

    await waitFor(() => {
      const calendar = screen.getByTestId("stDateInputCalendar")
      expect(calendar).toHaveAttribute("role", "dialog")
    })
  })

  it("Tab cycles through calendar + quick select in active mode", async () => {
    const user = userEvent.setup()
    render(
      <DateInput
        {...getProps({
          isRange: true,
          default: ["2019-07-06", "2019-07-08"],
        })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const { year } = getRangeDateSegments(region, "start")
    await user.click(year)
    await screen.findByTestId("stDateInputCalendar")

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

    await waitFor(() => {
      const calendar = screen.getByTestId("stDateInputCalendar")
      expect(calendar).toHaveAttribute("role", "dialog")
    })

    // Tab multiple times — should stay within the calendar
    for (let i = 0; i < 6; i++) {
      await user.tab()
      expect(screen.getByTestId("stDateInputCalendar")).toBeVisible()
    }
  })

  it("Escape from active range calendar returns to originating segment", async () => {
    const user = userEvent.setup()
    render(
      <DateInput
        {...getProps({
          isRange: true,
          default: ["2019-07-06", "2019-07-08"],
        })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const { month } = getRangeDateSegments(region, "end")
    await user.click(month)
    await screen.findByTestId("stDateInputCalendar")

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

    await waitFor(() => {
      const calendar = screen.getByTestId("stDateInputCalendar")
      expect(calendar).toHaveAttribute("role", "dialog")
    })

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
    expect(month).toHaveFocus()
  })
})

describe("DateInput single-mode paste handling", () => {
  it("pasting a full date string updates the value", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateInput {...props} />)

    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)

    await user.click(year)
    await user.paste("2024/03/15")

    await waitFor(() => {
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "1" }),
        ["2024-03-15"],
        expect.objectContaining({ fromUi: true }),
        undefined
      )
    })
  })

  it("paste is ignored when widget is disabled", async () => {
    const user = userEvent.setup()
    const props = getProps({}, { disabled: true })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateInput {...props} />)

    const region = screen.getByTestId("stDateInput")

    // Disabled segments cannot be clicked/focused, so we paste on the
    // wrapper directly. The handler should bail on `if (disabled) return`.
    const field = within(region).getByTestId("stDateInputField")
    act(() => {
      field.focus()
    })

    // Record call count before paste
    const callsBefore = (
      props.widgetMgr.setStringArrayValue as ReturnType<typeof vi.fn>
    ).mock.calls.length
    await user.paste("2024/03/15")

    // No new calls after paste
    const callsAfter = (
      props.widgetMgr.setStringArrayValue as ReturnType<typeof vi.fn>
    ).mock.calls.length
    expect(callsAfter).toBe(callsBefore)
  })

  it("pasting an invalid date is rejected", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateInput {...props} />)

    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)

    await user.click(year)
    await user.paste("not-a-date")

    // Value should remain unchanged — no new call after the initial mount
    await waitFor(() => {
      const calls = (
        props.widgetMgr.setStringArrayValue as ReturnType<typeof vi.fn>
      ).mock.calls
      // The only call should be the initial mount with the default value
      const dateValues = calls.map(c => c[1])
      expect(
        dateValues.every(
          v => JSON.stringify(v) === JSON.stringify([originalDateWire])
        )
      ).toBe(true)
    })
  })
})

describe("DateInput range-mode paste handling", () => {
  it("pasting a full date into the start field updates the value", async () => {
    const user = userEvent.setup()
    const props = getProps({
      isRange: true,
      default: ["2019-07-06", "2019-07-08"],
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateInput {...props} />)

    const region = screen.getByTestId("stDateInput")
    const { year } = getRangeDateSegments(region, "start")

    await user.click(year)
    await user.paste("2024/03/15")

    // Sorted: pasted start (2024-03-15) > existing end (2019-07-08)
    await waitFor(() => {
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "1" }),
        ["2019-07-08", "2024-03-15"],
        expect.objectContaining({ fromUi: true }),
        undefined
      )
    })
  })

  it("pasting a full date into the end field updates the value", async () => {
    const user = userEvent.setup()
    const props = getProps({
      isRange: true,
      default: ["2019-07-06", "2019-07-08"],
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateInput {...props} />)

    const region = screen.getByTestId("stDateInput")
    const { year } = getRangeDateSegments(region, "end")

    await user.click(year)
    await user.paste("2024/12/25")

    await waitFor(() => {
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "1" }),
        ["2019-07-06", "2024-12-25"],
        expect.objectContaining({ fromUi: true }),
        undefined
      )
    })
  })

  it("paste is ignored when range widget is disabled", async () => {
    const user = userEvent.setup()
    const props = getProps(
      { isRange: true, default: ["2019-07-06", "2019-07-08"] },
      { disabled: true }
    )
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateInput {...props} />)

    const region = screen.getByTestId("stDateInput")
    const field = within(region).getByTestId("stDateInputField")
    act(() => {
      field.focus()
    })

    const callsBefore = (
      props.widgetMgr.setStringArrayValue as ReturnType<typeof vi.fn>
    ).mock.calls.length
    await user.paste("2024/03/15")

    const callsAfter = (
      props.widgetMgr.setStringArrayValue as ReturnType<typeof vi.fn>
    ).mock.calls.length
    expect(callsAfter).toBe(callsBefore)
  })

  it("pasting an invalid date into a range field is rejected", async () => {
    const user = userEvent.setup()
    const props = getProps({
      isRange: true,
      default: ["2019-07-06", "2019-07-08"],
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateInput {...props} />)

    const region = screen.getByTestId("stDateInput")
    const { year } = getRangeDateSegments(region, "start")

    await user.click(year)
    await user.paste("not-a-date")

    await waitFor(() => {
      const calls = (
        props.widgetMgr.setStringArrayValue as ReturnType<typeof vi.fn>
      ).mock.calls
      const dateValues = calls.map(c => c[1])
      expect(
        dateValues.every(
          v =>
            JSON.stringify(v) === JSON.stringify(["2019-07-06", "2019-07-08"])
        )
      ).toBe(true)
    })
  })
})

describe("DateInput range-mode keyboard navigation", () => {
  it("Tab from last end-date segment closes calendar", async () => {
    const user = userEvent.setup()
    render(
      <DateInput
        {...getProps({
          isRange: true,
          default: ["2019-07-06", "2019-07-08"],
        })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const { day } = getRangeDateSegments(region, "end")

    await user.click(day)
    await screen.findByTestId("stDateInputCalendar")

    await user.tab()
    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
  })

  it("Shift+Tab from first start-date segment closes calendar", async () => {
    const user = userEvent.setup()
    render(
      <DateInput
        {...getProps({
          isRange: true,
          default: ["2019-07-06", "2019-07-08"],
          format: "YYYY/MM/DD",
        })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const { year } = getRangeDateSegments(region, "start")

    await user.click(year)
    await screen.findByTestId("stDateInputCalendar")

    await user.tab({ shift: true })
    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })
  })

  it("Tab in range calendar moves focus to quick-select, then closes popover", async () => {
    const user = userEvent.setup()
    render(
      <DateInput
        {...getProps({
          isRange: true,
          default: ["2019-07-06", "2019-07-08"],
        })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const { year } = getRangeDateSegments(region, "start")
    await user.click(year)

    const calendar = await screen.findByTestId("stDateInputCalendar")
    const prevMonthBtn = within(calendar).getByLabelText("Previous month")
    act(() => prevMonthBtn.focus())
    expect(prevMonthBtn).toHaveFocus()

    // Tab moves to quick-select trigger (popover stays open)
    await user.tab()
    const quickSelect = within(calendar).getByLabelText(
      "Quick select a date range"
    )
    expect(quickSelect).toHaveFocus()
    expect(screen.getByTestId("stDateInputCalendar")).toBeVisible()

    // Tab again closes popover and returns focus to field
    await user.tab()
    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })

    const endDay = getRangeDateSegments(region, "end").day
    expect(endDay).toHaveFocus()
  })

  it("Tab in range calendar without quick-select closes popover directly", async () => {
    const user = userEvent.setup()
    vi.setSystemTime(new Date(2024, 2, 15))
    render(
      <DateInput
        {...getProps({
          isRange: true,
          default: ["2024-03-06", "2024-03-08"],
          min: "2024-01-01",
        })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const { year } = getRangeDateSegments(region, "start")
    await user.click(year)

    const calendar = await screen.findByTestId("stDateInputCalendar")
    const prevMonthBtn = within(calendar).getByLabelText("Previous month")
    act(() => prevMonthBtn.focus())
    expect(prevMonthBtn).toHaveFocus()

    await user.tab()
    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })

    const endDay = getRangeDateSegments(region, "end").day
    expect(endDay).toHaveFocus()
  })

  it("range calendar selection (second click) writes exactly once", async () => {
    const user = userEvent.setup()
    vi.setSystemTime(new Date(2024, 2, 15))

    const props = getProps({
      isRange: true,
      default: [],
      min: "2019-07-01",
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateInput {...props} />)
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    const region = screen.getByTestId("stDateInput")
    const { year } = getRangeDateSegments(region, "start")
    await user.click(year)

    // First click (anchor)
    await user.click(await screen.findByLabelText("Wednesday, March 6, 2024"))

    // Clear mock to only track the second click's write
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    // Second click (completes range)
    await user.click(await screen.findByLabelText("Sunday, March 10, 2024"))

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })

    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledTimes(1)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      ["2024-03-06", "2024-03-10"],
      { fromUi: true },
      undefined
    )

    vi.useRealTimers()
  })

  it("clicking the same day twice from empty range commits a single-day range", async () => {
    const user = userEvent.setup()
    vi.setSystemTime(new Date(2024, 2, 15))

    const props = getProps({
      isRange: true,
      default: [],
      min: "2019-07-01",
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<DateInput {...props} />)
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    const region = screen.getByTestId("stDateInput")
    const { year } = getRangeDateSegments(region, "start")
    await user.click(year)

    // First click sets the anchor
    await user.click(await screen.findByLabelText("Wednesday, March 6, 2024"))

    expect(screen.queryByTestId("stDateInputCalendar")).toBeInTheDocument()

    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    // After selection, RAC appends " selected" to the label. Use fireEvent
    // because userEvent.click hangs on already-selected RAC range cells in JSDOM.
    const cell2 = screen.getByLabelText("Wednesday, March 6, 2024 selected")
    /* eslint-disable testing-library/prefer-user-event */
    fireEvent.pointerDown(cell2, { pointerType: "mouse", button: 0 })
    fireEvent.pointerUp(cell2, { pointerType: "mouse", button: 0 })
    fireEvent.click(cell2)
    /* eslint-enable testing-library/prefer-user-event */

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputCalendar")
      ).not.toBeInTheDocument()
    })

    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledTimes(1)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      ["2024-03-06", "2024-03-06"],
      { fromUi: true },
      undefined
    )

    vi.useRealTimers()
  })

  it("partially cleared range reverts on popover close (Escape)", async () => {
    const user = userEvent.setup()
    const props = getProps({
      isRange: true,
      default: ["2019-07-06", "2019-07-08"],
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    const region = screen.getByTestId("stDateInput")
    const start = getRangeDateSegments(region, "start")

    // Click to open, then partially clear start (only year)
    await user.click(start.year)
    await screen.findByTestId("stDateInputCalendar")
    await clearSegment(user, start.year)

    // Dismiss via Escape
    await user.keyboard("{Escape}")

    // Value should be unchanged (partial edit reverted)
    expect(props.widgetMgr.setStringArrayValue).not.toHaveBeenCalled()

    // Display should revert: start year should show the committed year
    expect(start.year).not.toHaveAttribute("data-placeholder", "true")
  })
})

describe("DateInput range-mode form commit-on-blur", () => {
  it("commits pending range value on blur when inside a form", async () => {
    const user = userEvent.setup()
    const props = getProps({
      isRange: true,
      formId: "form",
      default: ["2019-07-06", "2019-07-08"],
    })
    props.widgetMgr.setFormSubmitBehaviors("form", true)
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    const region = screen.getByTestId("stDateInput")
    const start = getRangeDateSegments(region, "start")

    await typeIntoSegment(user, start.year, "2024")
    await typeIntoSegment(user, start.month, "03")
    await typeIntoSegment(user, start.day, "15")

    // Before blur: segment edits are buffered — no widget write yet.
    expect(props.widgetMgr.setStringArrayValue).not.toHaveBeenCalled()

    // Blur writes the pending value synchronously.
    await user.tab()
    // Tab moves within the range fields (start→end), so we need to tab
    // completely out of the widget.
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()

    // Sorted: typed start (2024-03-15) > existing end (2019-07-08), so
    // the normalization layer swaps them.
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      ["2019-07-08", "2024-03-15"],
      { fromUi: true },
      undefined
    )
  })

  it("does not commit placeholder state on blur in a range form", async () => {
    const user = userEvent.setup()
    const props = getProps({
      isRange: true,
      formId: "form",
      default: ["2019-07-06", "2019-07-08"],
    })
    props.widgetMgr.setFormSubmitBehaviors("form", true)
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    const region = screen.getByTestId("stDateInput")
    const start = getRangeDateSegments(region, "start")

    // Partially clear the start year (leaves placeholders)
    await clearSegment(user, start.year)

    // Blur should NOT commit — placeholder segments are present.
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()

    expect(props.widgetMgr.setStringArrayValue).not.toHaveBeenCalled()
  })

  it("fully cleared range commits empty array on blur", async () => {
    const user = userEvent.setup()
    const props = getProps({
      isRange: true,
      formId: "form",
      default: ["2019-07-06", "2019-07-08"],
    })
    props.widgetMgr.setFormSubmitBehaviors("form", true)
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    const region = screen.getByTestId("stDateInput")
    const start = getRangeDateSegments(region, "start")
    const end = getRangeDateSegments(region, "end")

    // Clear all segments of both fields
    await clearSegment(user, start.year)
    await clearSegment(user, start.month)
    await clearSegment(user, start.day)
    await clearSegment(user, end.year)
    await clearSegment(user, end.month)
    await clearSegment(user, end.day)

    // Move focus outside the widget to trigger blur
    await user.click(document.body)

    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [],
      { fromUi: true },
      undefined
    )
  })

  it("filled start with empty end commits [start] on blur", async () => {
    const user = userEvent.setup()
    const props = getProps({
      isRange: true,
      formId: "form",
      default: ["2019-07-06", "2019-07-08"],
    })
    props.widgetMgr.setFormSubmitBehaviors("form", true)
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    vi.mocked(props.widgetMgr.setStringArrayValue).mockClear()

    const region = screen.getByTestId("stDateInput")
    const end = getRangeDateSegments(region, "end")

    // Clear all end segments — leaves start intact
    await clearSegment(user, end.year)
    await clearSegment(user, end.month)
    await clearSegment(user, end.day)

    // Move focus outside the widget to trigger blur
    await user.click(document.body)

    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      ["2019-07-06"],
      { fromUi: true },
      undefined
    )
  })
})

describe("DateInput month/year picker escape handling", () => {
  it("Escape closes the month picker without closing the calendar (single mode)", async () => {
    const user = userEvent.setup()
    render(<DateInput {...getProps()} />)

    const region = screen.getByTestId("stDateInput")
    const { year } = getSingleDateSegments(region)
    await user.click(year)

    const calendar = await screen.findByTestId("stDateInputCalendar")

    // Open the month picker
    const monthTrigger = within(calendar).getByRole("button", {
      name: "month",
    })
    await user.click(monthTrigger)

    // Month picker popover should be open
    expect(
      screen.getByTestId("stDateInputHeaderPickerPopover")
    ).toBeInTheDocument()

    // Press Escape — should close the picker, NOT the calendar
    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputHeaderPickerPopover")
      ).not.toBeInTheDocument()
    })

    // Calendar should still be open
    expect(screen.getByTestId("stDateInputCalendar")).toBeInTheDocument()
  })

  it("Escape closes the month picker without closing the calendar (range mode)", async () => {
    const user = userEvent.setup()
    render(
      <DateInput
        {...getProps({
          isRange: true,
          default: ["2019-07-06", "2019-07-08"],
        })}
      />
    )

    const region = screen.getByTestId("stDateInput")
    const { year } = getRangeDateSegments(region, "start")
    await user.click(year)

    const calendar = await screen.findByTestId("stDateInputCalendar")

    const monthTrigger = within(calendar).getByRole("button", {
      name: "month",
    })
    await user.click(monthTrigger)

    expect(
      screen.getByTestId("stDateInputHeaderPickerPopover")
    ).toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(
        screen.queryByTestId("stDateInputHeaderPickerPopover")
      ).not.toBeInTheDocument()
    })

    expect(screen.getByTestId("stDateInputCalendar")).toBeInTheDocument()
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
    const region = screen.getByTestId("stDateInput")

    const start = getRangeDateSegments(region, "start")
    expect(start.year).toHaveTextContent("2025")
    expect(start.month).toHaveTextContent("07")
    expect(start.day).toHaveTextContent("01")

    const end = getRangeDateSegments(region, "end")
    expect(end.year).toHaveTextContent("2025")
    expect(end.month).toHaveTextContent("07")
    expect(end.day).toHaveTextContent("10")
  })
})
