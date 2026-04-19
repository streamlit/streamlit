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

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { UserEvent } from "@testing-library/user-event"
import moment from "moment"
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
// Display format — what the user sees/types in the input field
const originalDateDisplay = "1970/01/20"
const newDateDisplay = "2020/02/06"

/** Replace entire field value like a masked input (jsdom does not reliably apply input.select() on focus). */
async function typeInDateField(
  user: UserEvent,
  field: HTMLElement,
  text: string
): Promise<void> {
  const el = field as HTMLInputElement
  // Focus without clicking: field onClick opens the calendar and breaks controlled typing.
  act(() => {
    el.focus()
  })
  await user.type(el, text, {
    initialSelectionStart: 0,
    initialSelectionEnd: el.value.length,
    skipClick: true,
  })
}

/** Types a full value (reliable for validation / range strings in jsdom). */
async function setDateInputValue(
  user: UserEvent,
  field: HTMLElement,
  value: string
): Promise<void> {
  const el = field as HTMLInputElement
  await user.clear(el)
  await user.type(el, value, { skipClick: true })
}

/** Display text sync runs in a queueMicrotask after value updates. */
async function waitForDateFieldValue(expected: string): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId("stDateInputField")).toHaveValue(expected)
  })
}

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

  it("displays the correct placeholder and value for the provided format", async () => {
    const props = getProps({
      format: "DD.MM.YYYY",
    })
    render(<DateInput {...props} />)
    expect(screen.getByPlaceholderText("DD.MM.YYYY")).toBeVisible()
    await waitForDateFieldValue("20.01.1970")
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

  it("renders a default value", async () => {
    const props = getProps()
    render(<DateInput {...props} />)

    await waitForDateFieldValue(originalDateDisplay)
    expect(screen.getByTestId("stDateInputField")).toBeVisible()
  })

  it("can be disabled", () => {
    const props = getProps()
    render(<DateInput {...props} disabled={true} />)
    expect(screen.getByTestId("stDateInputField")).toBeDisabled()
  })

  it("updates the widget value when it's changed", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: undefined })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    const datePicker = screen.getByTestId("stDateInputField")
    await typeInDateField(user, datePicker, newDateDisplay)
    await user.keyboard("{Enter}")

    expect(screen.getByTestId("stDateInputField")).toHaveValue(newDateDisplay)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [newDateWire],
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("displays an error tooltip when the entered date for single date input outside range", async () => {
    const user = userEvent.setup()
    const props = getProps({
      min: "2020-01-05",
      max: "2020-01-25",
    })
    render(<DateInput {...props} />)
    const dateInput = screen.getByTestId("stDateInputField")
    const currNewDate = "2020/01/30"

    await waitForDateFieldValue(originalDateDisplay)
    await setDateInputValue(user, dateInput, currNewDate)

    const root = screen.getByTestId("stDateInput")
    await waitFor(() => {
      expect(
        within(root).getByTestId("stTooltipErrorHoverTarget")
      ).toBeVisible()
    })

    expect(root).toHaveAttribute("data-validation-error", "true")
    const msg = root.getAttribute("data-validation-message")
    expect(msg).toBeTruthy()
    expect(msg).toMatch(/Date set outside allowed range/)
    expect(msg).toMatch(/2020\/01\/05/)
    expect(msg).toMatch(/2020\/01\/25/)
  })

  it("displays correct error tooltip when the entered date for range input below min date", async () => {
    const props = getProps({
      default: ["2020-02-01", "2020-02-07"],
      min: "2020-01-01",
      max: "2020-12-31",
      isRange: true,
    })
    render(<DateInput {...props} />)
    const dateInput = screen.getByTestId("stDateInputField")
    const currNewDate = "2019/01/05 - 2020/02/07"

    // Range validation needs a complete parseable string; fireEvent.input applies in one update
    // eslint-disable-next-line testing-library/prefer-user-event -- controlled field uses onInput (see DateInput)
    fireEvent.input(dateInput, { target: { value: currNewDate } })

    const root = screen.getByTestId("stDateInput")
    await waitFor(() => {
      expect(
        within(root).getByTestId("stTooltipErrorHoverTarget")
      ).toBeVisible()
    })

    expect(root).toHaveAttribute("data-validation-error", "true")
    const msg = root.getAttribute("data-validation-message")
    expect(msg).toBeTruthy()
    expect(msg).toMatch(/Start date set outside allowed range/)
    expect(msg).toMatch(/2020\/01\/01/)
  })

  it("displays correct error tooltip when the entered date for range input above max date", async () => {
    const props = getProps({
      default: ["2020-02-01", "2020-02-07"],
      min: "2020-01-01",
      max: "2020-12-31",
      isRange: true,
    })
    render(<DateInput {...props} />)
    const dateInput = screen.getByTestId("stDateInputField")
    const currNewDate = "2020/02/01 - 2021/02/07"

    // eslint-disable-next-line testing-library/prefer-user-event -- controlled field uses onInput (see DateInput)
    fireEvent.input(dateInput, { target: { value: currNewDate } })

    const root = screen.getByTestId("stDateInput")
    await waitFor(() => {
      expect(
        within(root).getByTestId("stTooltipErrorHoverTarget")
      ).toBeVisible()
    })

    expect(root).toHaveAttribute("data-validation-error", "true")
    const msg = root.getAttribute("data-validation-message")
    expect(msg).toBeTruthy()
    expect(msg).toMatch(/End date set outside allowed range/)
    expect(msg).toMatch(/2020\/12\/31/)
  })

  it("does not commit an invalid date", async () => {
    const user = userEvent.setup()
    const invalidDate = "2020/02/15"
    const props = getProps({
      default: undefined,
      min: "2020-01-01",
      max: "2020-01-31",
    })
    render(<DateInput {...props} />)
    // Set up spy after initial setStringArrayValue call
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    const dateInput = screen.getByTestId("stDateInputField")
    await typeInDateField(user, dateInput, invalidDate)

    expect(dateInput).toHaveValue(invalidDate)
    expect(props.widgetMgr.setStringArrayValue).not.toHaveBeenCalled()
  })

  it("resets its value to default when it's closed with empty input", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    const dateInput = screen.getByTestId("stDateInputField")

    // eslint-disable-next-line testing-library/prefer-user-event -- fireEvent.input: controlled field uses onInput (see DateInput)
    fireEvent.input(dateInput, {
      target: { value: newDateDisplay },
    })

    expect(dateInput).toHaveValue(newDateDisplay)

    // Simulating clearing the date input
    // eslint-disable-next-line testing-library/prefer-user-event -- fireEvent.input: controlled field uses onInput (see DateInput)
    fireEvent.input(dateInput, {
      target: { value: null },
    })

    // Simulating the close action
    fireEvent.blur(dateInput)
    expect(dateInput).toHaveValue(originalDateDisplay)
  })

  it("has a minDate", async () => {
    const user = userEvent.setup()
    const props = getProps({})

    render(<DateInput {...props} />)

    await user.click(screen.getByTestId("stDateInputCalendarButton"))

    expect(
      screen.getByRole("button", { name: /^Monday, January 19, 1970$/ })
    ).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.getByRole("button", {
        name: /Tuesday, January 20, 1970.*selected.*First available date/,
      })
    ).toBeVisible()
  })

  it("has a minDate if passed", async () => {
    const user = userEvent.setup()
    const props = getProps({
      min: "2020-01-05",
      // Choose default so min is in the default page when the widget is opened.
      default: ["2020-01-15"],
    })

    render(<DateInput {...props} />)

    await user.click(screen.getByTestId("stDateInputCalendarButton"))

    expect(
      screen.getByRole("button", { name: /^Saturday, January 4, 2020$/ })
    ).toHaveAttribute("aria-disabled", "true")

    expect(
      screen.getByRole("button", {
        name: /Sunday, January 5, 2020.*First available date/,
      })
    ).toBeVisible()
  })

  it("has a maxDate if it is passed", async () => {
    const user = userEvent.setup()
    const props = getProps({
      max: "2020-01-25",
      // Choose default so min is in the default page when the widget is opened.
      default: ["2020-01-15"],
    })

    render(<DateInput {...props} />)

    await user.click(screen.getByTestId("stDateInputCalendarButton"))

    expect(
      screen.getByRole("button", {
        name: /Saturday, January 25, 2020.*Last available date/,
      })
    ).toBeVisible()

    expect(
      screen.getByRole("button", { name: /^Sunday, January 26, 2020$/ })
    ).toHaveAttribute("aria-disabled", "true")
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)

    const dateInput = screen.getByTestId("stDateInputField")
    await waitForDateFieldValue(originalDateDisplay)
    await user.clear(dateInput)
    await typeInDateField(user, dateInput, newDateDisplay)
    await user.keyboard("{Enter}")

    expect(dateInput).toHaveValue(newDateDisplay)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [newDateWire],
      {
        fromUi: true,
      },
      undefined
    )

    act(() => {
      // "Submit" the form
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    await waitForDateFieldValue(originalDateDisplay)
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
    const dateInput = screen.getByTestId("stDateInputField")
    const root = screen.getByTestId("stDateInput")

    await waitForDateFieldValue("2026/01/15")
    await setDateInputValue(user, dateInput, "2025/12/01")
    await user.keyboard("{Enter}")

    expect(
      await within(root).findByTestId("stTooltipErrorHoverTarget")
    ).toBeVisible()

    act(() => {
      props.widgetMgr.submitForm("form", undefined)
    })

    await waitFor(() => {
      expect(
        within(root).queryByTestId("stTooltipErrorHoverTarget")
      ).not.toBeInTheDocument()
    })
    await waitForDateFieldValue("2026/01/15")
  })

  describe("localization", () => {
    /**
     * Returns the first character of each weekday column header, in render
     * order. This keeps the assertion stable across `weekdayStyle` changes
     * (narrow / short / long) so we can verify week-start ordering without
     * pinning the tests to a specific label length. Not usable for locales
     * whose weekday names share a common leading character (e.g. Arabic
     * weekdays all start with the definite article "ال") — use
     * `getWeekdayFullTextConcat` for those.
     */
    const getWeekdayFirstCharConcat = async (): Promise<string> => {
      const grid = await screen.findByRole("grid", { name: /Calendar/ })
      const headers = within(grid).getAllByRole("columnheader", {
        hidden: true,
      })
      return headers
        .map(el => (el.textContent ?? "").trim().charAt(0))
        .join("")
    }

    /** Returns the full text of each weekday column header, concatenated. */
    const getWeekdayFullTextConcat = async (): Promise<string> => {
      const grid = await screen.findByRole("grid", { name: /Calendar/ })
      const headers = within(grid).getAllByRole("columnheader", {
        hidden: true,
      })
      return headers.map(el => (el.textContent ?? "").trim()).join("")
    }

    describe("with a locale whose week starts on Monday", () => {
      const locale = "de"

      it("renders expected week day ordering", async () => {
        const user = userEvent.setup()
        const props = getProps()
        renderWithContexts(<DateInput {...props} />, {
          libConfigContext: { locale },
        })

        await user.click(
          await screen.findByTestId("stDateInputCalendarButton")
        )

        expect(await getWeekdayFirstCharConcat()).toBe("MDMDFSS")
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

        await user.click(
          await screen.findByTestId("stDateInputCalendarButton")
        )

        // Weekday ordering for ar locale starts with Saturday ("السبت") and
        // ends with Friday ("الجمعة"). jsdom's Intl returns full names here
        // (not narrow/short forms), so assert on the concatenated full text.
        expect(await getWeekdayFullTextConcat()).toBe(
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

        await user.click(
          await screen.findByTestId("stDateInputCalendarButton")
        )

        expect(await getWeekdayFirstCharConcat()).toBe("SMTWTFS")
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

        await user.click(
          await screen.findByTestId("stDateInputCalendarButton")
        )

        expect(await getWeekdayFirstCharConcat()).toBe("SMTWTFS")
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

      screen.getByTestId("stDateInputField")
      await user.click(screen.getByTestId("stDateInputCalendarButton"))

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

      screen.getByTestId("stDateInputField")
      await user.click(screen.getByTestId("stDateInputCalendarButton"))

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

      screen.getByTestId("stDateInputField")
      await user.click(screen.getByTestId("stDateInputCalendarButton"))

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

      screen.getByTestId("stDateInputField")
      await user.click(screen.getByTestId("stDateInputCalendarButton"))

      // Quick select should not be visible for single date inputs
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
        globalThis.Date = RealDate as never
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

        screen.getByTestId("stDateInputField")
        await user.click(screen.getByTestId("stDateInputCalendarButton"))

        // Quick select should be visible
        const quickSelect = screen.getByRole("combobox")
        expect(quickSelect).toBeVisible()

        await user.selectOptions(quickSelect, "past_week")

        // Expect no error icon (wait for async updates) and the selection to be committed
        const root = screen.getByTestId("stDateInput")
        await waitFor(() => {
          expect(
            within(root).queryByTestId("stTooltipErrorHoverTarget")
          ).not.toBeInTheDocument()
        })
        expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalled()
      })
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

  it("uses URL-seeded value (setValue) instead of proto default", async () => {
    const seededDateWire = "2025-08-20"
    const seededDateDisplay = "2025/08/20"
    const props = getProps({
      queryParamKey: "my_date",
      value: [seededDateWire],
      setValue: true,
    })

    render(<DateInput {...props} />)

    const input = screen.getByTestId("stDateInputField")
    await waitFor(() => {
      expect(input).toHaveValue(seededDateDisplay)
    })
    expect(input).not.toHaveValue(originalDateDisplay)
  })

  it("uses URL-seeded range value instead of proto default", async () => {
    const props = getProps({
      queryParamKey: "my_date",
      isRange: true,
      default: ["2025-03-01", "2025-03-15"],
      value: ["2025-07-01", "2025-07-10"],
      setValue: true,
    })

    render(<DateInput {...props} />)

    const input = screen.getByTestId("stDateInputField")
    await waitFor(() => {
      expect(input).toHaveValue("2025/07/01 – 2025/07/10")
    })
    expect(input).not.toHaveValue("2025/03/01 – 2025/03/15")
  })
})
