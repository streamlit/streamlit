/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { act, fireEvent, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import moment from "moment"

import {
  DateInput as DateInputProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "@streamlit/protobuf"

import { render, renderWithContexts } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import DateInput, { Props } from "./DateInput"

const originalDate = "1970/1/20"
const fullOriginalDate = "1970/01/20"
const newDate = "2020/02/06"

const getProps = (
  elementProps: Partial<DateInputProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: DateInputProto.create({
    id: "1",
    label: "Label",
    default: [fullOriginalDate],
    min: originalDate,
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

  it("displays the correct placeholder and value for the provided format", () => {
    const props = getProps({
      format: "DD.MM.YYYY",
    })
    render(<DateInput {...props} />)
    expect(screen.getByPlaceholderText("DD.MM.YYYY")).toBeVisible()
    expect(screen.getByDisplayValue("20.01.1970")).toBeVisible()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
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
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
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
      [fullOriginalDate],
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
      [fullOriginalDate],
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

    expect(screen.getByTestId("stDateInputField")).toHaveValue(
      fullOriginalDate
    )
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
    await user.type(datePicker, newDate)

    expect(screen.getByTestId("stDateInputField")).toHaveValue(newDate)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [newDate],
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("displays an error tooltip when the entered date for single date input outside range", async () => {
    const user = userEvent.setup()
    const props = getProps({
      min: "2020/01/05",
      max: "2020/01/25",
    })
    render(<DateInput {...props} />)
    const dateInput = screen.getByTestId("stDateInputField")
    const currNewDate = "2020/01/30"

    await user.type(dateInput, currNewDate)

    const errorIcon = screen.getByTestId("stTooltipErrorHoverTarget")
    expect(errorIcon).toBeVisible()

    // Hover over the error icon to trigger the tooltip
    await user.hover(errorIcon)

    const tooltip = await screen.findByTestId("stTooltipErrorContent")
    expect(tooltip).toHaveTextContent(
      "Error: Date set outside allowed range. Please select a date between 2020/01/05 and 2020/01/25."
    )
  })

  it("displays correct error tooltip when the entered date for range input below min date", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: ["2020/02/01", "2020/02/07"],
      min: "2020/01/01",
      max: "2020/12/31",
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
    await user.hover(errorIcon)

    const tooltip = await screen.findByTestId("stTooltipErrorContent")
    expect(tooltip).toHaveTextContent(
      "Error: Start date set outside allowed range. Please select a date after 2020/01/01."
    )
  })

  it("displays correct error tooltip when the entered date for range input above max date", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: ["2020/02/01", "2020/02/07"],
      min: "2020/01/01",
      max: "2020/12/31",
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
    await user.hover(errorIcon)

    const tooltip = await screen.findByTestId("stTooltipErrorContent")
    expect(tooltip).toHaveTextContent(
      "Error: End date set outside allowed range. Please select a date before 2020/12/31."
    )
  })

  it("does not commit an invalid date", async () => {
    const user = userEvent.setup()
    const invalidDate = "2020/02/15"
    const props = getProps({
      default: undefined,
      min: "2020/01/01",
      max: "2020/01/31",
    })
    render(<DateInput {...props} />)
    // Set up spy after initial setStringArrayValue call
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    const dateInput = screen.getByTestId("stDateInputField")
    await user.type(dateInput, invalidDate)

    expect(dateInput).toHaveValue(invalidDate)
    expect(props.widgetMgr.setStringArrayValue).not.toHaveBeenCalled()
  })

  it("resets its value to default when it's closed with empty input", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    const dateInput = screen.getByTestId("stDateInputField")

    // TODO: Utilize user-event instead of fireEvent
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.change(dateInput, {
      target: { value: newDate },
    })

    expect(dateInput).toHaveValue(newDate)

    // Simulating clearing the date input
    // TODO: Utilize user-event instead of fireEvent
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.change(dateInput, {
      target: { value: null },
    })

    // Simulating the close action
    fireEvent.blur(dateInput)
    expect(dateInput).toHaveValue(fullOriginalDate)
  })

  it("has a minDate", async () => {
    const user = userEvent.setup()
    const props = getProps({})

    render(<DateInput {...props} />)

    const dateInput = screen.getByTestId("stDateInputField")
    await user.click(dateInput)

    expect(
      screen.getByLabelText("Not available. Monday, January 19th 1970.")
    ).toBeTruthy()
    expect(
      screen.getByLabelText(
        "Selected. Tuesday, January 20th 1970. It's available."
      )
    ).toBeTruthy()
  })

  it("has a minDate if passed", async () => {
    const user = userEvent.setup()
    const props = getProps({
      min: "2020/01/05",
      // Choose default so min is in the default page when the widget is opened.
      default: ["2020/01/15"],
    })

    render(<DateInput {...props} />)

    const dateInput = screen.getByTestId("stDateInputField")
    await user.click(dateInput)

    expect(
      screen.getByLabelText("Not available. Saturday, January 4th 2020.")
    ).toBeTruthy()

    expect(
      screen.getByLabelText("Choose Sunday, January 5th 2020. It's available.")
    ).toBeTruthy()
  })

  it("has a maxDate if it is passed", async () => {
    const user = userEvent.setup()
    const props = getProps({
      max: "2020/01/25",
      // Choose default so min is in the default page when the widget is opened.
      default: ["2020/01/15"],
    })

    render(<DateInput {...props} />)

    const dateInput = screen.getByTestId("stDateInputField")
    await user.click(dateInput)

    expect(
      screen.getByLabelText(
        "Choose Saturday, January 25th 2020. It's available."
      )
    ).toBeTruthy()

    expect(
      screen.getByLabelText("Not available. Sunday, January 26th 2020.")
    ).toBeTruthy()
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)

    const dateInput = screen.getByTestId("stDateInputField")
    // TODO: Utilize user-event instead of fireEvent
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.change(dateInput, {
      target: { value: newDate },
    })

    expect(dateInput).toHaveValue(newDate)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [newDate],
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
    expect(dateInput).toHaveValue(fullOriginalDate)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      [fullOriginalDate],
      {
        fromUi: true,
      },
      undefined
    )
  })

  describe("localization", () => {
    const getCalendarHeader = async (): Promise<HTMLElement> => {
      const calendar = await screen.findByLabelText("Calendar.")
      const presentations =
        await within(calendar).findAllByRole("presentation")
      return presentations[presentations.length - 1]
    }

    describe("with a locale whose week starts on Monday", () => {
      const locale = "de"

      it("renders expected week day ordering", async () => {
        const user = userEvent.setup()
        const props = getProps()
        renderWithContexts(<DateInput {...props} />, { locale })

        await user.click(await screen.findByLabelText("Select a date."))

        expect(await getCalendarHeader()).toHaveTextContent("MoTuWeThFrSaSu")
      })
    })

    describe("with a locale whose week starts on Saturday", () => {
      const locale = "ar"

      it("renders expected week day ordering", async () => {
        const user = userEvent.setup()
        const props = getProps()
        renderWithContexts(<DateInput {...props} />, { locale })

        await user.click(await screen.findByLabelText("Select a date."))

        expect(await getCalendarHeader()).toHaveTextContent("SaSuMoTuWeThFr")
      })
    })

    describe("with a locale whose week starts on Sunday", () => {
      const locale = "en-US"

      it("renders expected week day ordering", async () => {
        const user = userEvent.setup()
        const props = getProps()
        renderWithContexts(<DateInput {...props} />, { locale })

        await user.click(await screen.findByLabelText("Select a date."))

        expect(await getCalendarHeader()).toHaveTextContent("SuMoTuWeThFrSa")
      })
    })

    describe("with an invalid locale", () => {
      const locale = "does-not-exist"

      it("falls back to en-US locale", async () => {
        const user = userEvent.setup()
        const props = getProps()
        renderWithContexts(<DateInput {...props} />, { locale })

        await user.click(await screen.findByLabelText("Select a date."))

        expect(await getCalendarHeader()).toHaveTextContent("SuMoTuWeThFrSa")
      })
    })
  })

  describe("quick select feature", () => {
    it("hides quick select for range date inputs if minDate is within 2 years", async () => {
      const user = userEvent.setup()
      const recentMinDate = moment().subtract(1, "year").format("YYYY/MM/DD")
      const props = getProps({
        isRange: true,
        min: recentMinDate,
        default: [
          recentMinDate,
          moment(recentMinDate).add(1, "day").format("YYYY/MM/DD"),
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
      const oldMinDate = "2020/01/01"
      const props = getProps({
        isRange: true,
        min: oldMinDate,
        default: [
          oldMinDate,
          moment(oldMinDate).add(1, "day").format("YYYY/MM/DD"),
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
        default: ["2020/01/01", "2020/01/31"],
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
        default: ["2020/01/01"],
      })

      render(<DateInput {...props} />)

      const dateInput = screen.getByTestId("stDateInputField")
      await user.click(dateInput)

      // Quick select should not be visible for single date inputs
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    })
  })
})
