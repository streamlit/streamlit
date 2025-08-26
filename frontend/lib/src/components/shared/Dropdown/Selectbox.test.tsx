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

import { fireEvent, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { mockConvertRemToPx } from "~lib/mocks/mocks"
import { render } from "~lib/test_util"
import * as Utils from "~lib/theme/utils"
import * as MobileUtil from "~lib/util/isMobile"
import { LabelVisibilityOptions } from "~lib/util/utils"

import Selectbox, { fuzzyFilterSelectOptions, Props } from "./Selectbox"

vi.mock("~lib/WidgetStateManager")

const getProps = (props: Partial<Props> = {}): Props => ({
  value: "a",
  label: "Label",
  options: ["a", "b", "c"],
  disabled: false,
  onChange: vi.fn(),
  placeholder: "Select...",
  acceptNewOptions: false,
  ...props,
})

describe("Selectbox widget", () => {
  let props: Props

  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.spyOn(Utils, "convertRemToPx").mockImplementation(mockConvertRemToPx)
    props = getProps()
  })

  it("renders without crashing", () => {
    render(<Selectbox {...props} />)
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("has correct className", () => {
    render(<Selectbox {...props} />)
    const selectbox = screen.getByTestId("stSelectbox")
    expect(selectbox).toHaveClass("stSelectbox")
  })

  it("renders a label", () => {
    render(<Selectbox {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveTextContent(
      `${props.label}`
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const currProps = getProps({
      labelVisibility: LabelVisibilityOptions.Hidden,
    })
    render(<Selectbox {...currProps} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const currProps = getProps({
      labelVisibility: LabelVisibilityOptions.Collapsed,
    })
    render(<Selectbox {...currProps} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  // Placeholder tests
  it("pass placeholder prop correctly", () => {
    props = getProps({
      value: undefined,
      placeholder: "Please select",
    })
    render(<Selectbox {...props} />)
    expect(screen.getByText("Please select")).toBeInTheDocument()
  })

  it("integrates with placeholder utility - disabled state when no options", () => {
    props = getProps({
      options: [],
      value: undefined,
      placeholder: "", // Empty string triggers default logic
    })
    render(<Selectbox {...props} />)

    // Verifies integration with getSelectPlaceholder utility works
    expect(screen.getByText("No options to select")).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("renders options", async () => {
    const user = userEvent.setup()
    render(<Selectbox {...props} />)
    const selectbox = screen.getByRole("combobox")
    await user.click(selectbox)
    const options = screen.getAllByRole("option")

    expect(options).toHaveLength(props.options.length)
    options.forEach((option, index) => {
      expect(option).toHaveTextContent(props.options[index])
    })
  })

  it("could be disabled", () => {
    props = getProps({
      disabled: true,
    })
    render(<Selectbox {...props} />)
    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("is able to select an option", async () => {
    const user = userEvent.setup()
    render(<Selectbox {...props} />)
    const selectbox = screen.getByRole("combobox")
    // Open the dropdown
    await user.click(selectbox)
    const options = screen.getAllByRole("option")
    await user.click(options[2])

    expect(props.onChange).toHaveBeenCalledWith("c")
    expect(
      within(screen.getByTestId("stSelectbox")).getByText(props.options[2])
    ).toBeVisible()
  })

  it("doesn't filter options based on index", async () => {
    const user = userEvent.setup()
    render(<Selectbox {...props} />)

    await user.type(screen.getByRole("combobox"), "1")
    expect(screen.getByText("No results")).toBeInTheDocument()
  })

  it("filters options based on label with case insensitive", async () => {
    const user = userEvent.setup()
    render(<Selectbox {...props} />)
    const selectbox = screen.getByRole("combobox")

    await user.type(selectbox, "b")
    let options = screen.getAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("b")

    await user.clear(selectbox)
    await user.type(selectbox, "B")
    options = screen.getAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("b")
  })

  it("fuzzy filters options correctly", () => {
    // This test just makes sure the filter algorithm works correctly. The e2e
    // test actually types something in the selectbox and makes sure that it
    // shows the right options.

    const options = [
      { label: "e2e/scripts/components_iframe.py", value: "" },
      { label: "e2e/scripts/st_warning.py", value: "" },
      { label: "e2e/scripts/st_container.py", value: "" },
      { label: "e2e/scripts/st_dataframe_sort_column.py", value: "" },
      { label: "e2e/scripts/app_hotkeys.py", value: "" },
      { label: "e2e/scripts/st_info.py", value: "" },
      { label: "e2e/scripts/st_echo.py", value: "" },
      { label: "e2e/scripts/st_json.py", value: "" },
      { label: "e2e/scripts/st_experimental_get_query_params.py", value: "" },
      { label: "e2e/scripts/st_markdown.py", value: "" },
      { label: "e2e/scripts/st_color_picker.py", value: "" },
      { label: "e2e/scripts/st_expander.py", value: "" },
    ]

    const results1 = fuzzyFilterSelectOptions(options, "esstm")
    expect(results1.map(it => it.label)).toEqual([
      "e2e/scripts/st_markdown.py",
      "e2e/scripts/st_dataframe_sort_column.py",
      "e2e/scripts/st_experimental_get_query_params.py",
      "e2e/scripts/components_iframe.py",
    ])

    const results2 = fuzzyFilterSelectOptions(options, "eseg")
    expect(results2.map(it => it.label)).toEqual([
      "e2e/scripts/st_experimental_get_query_params.py",
    ])
  })

  it("predictably produces case sensitive matches", async () => {
    const user = userEvent.setup()
    const currProps = getProps({
      options: ["aa", "Aa", "aA"],
    })
    render(<Selectbox {...currProps} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "aa")

    const options = screen.queryAllByRole("option")
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent("aa")
    expect(options[1]).toHaveTextContent("Aa")
    expect(options[2]).toHaveTextContent("aA")
  })

  it("updates value if new value provided from parent", () => {
    const { rerender } = render(<Selectbox {...props} />)
    // Original value passed is 0
    expect(screen.getByText(props.options[0])).toBeInTheDocument()

    props = getProps({ value: "b" })
    rerender(<Selectbox {...props} />)
    expect(screen.getByText(props.options[1])).toBeInTheDocument()
  })

  it("does not commit changes when clicking outside of the selectbox", async () => {
    const user = userEvent.setup()
    render(<Selectbox {...props} />)
    const selectbox = screen.getByRole("combobox")
    await user.type(selectbox, "b")

    // Click outside of the selectbox
    await user.click(document.body)

    // Check that clicking outside of the selectbox does not commit the change and the default is kept
    expect(props.onChange).toHaveBeenCalledTimes(0)
    expect(screen.getByTestId("stSelectbox")).toHaveTextContent(
      props.options[0]
    )
  })

  it("does not call onChange when the user deletes characters", () => {
    render(<Selectbox {...props} />)
    const selectbox = screen.getByTestId("stSelectbox")
    expect(
      within(selectbox).getByText(props.options[0], { exact: true })
    ).toBeInTheDocument()

    const selectboxInput = screen.getByRole("combobox")

    // Simulate deleting a character
    // we are using fireEvent here instead of userEvent because userEvent
    // did not trigger the backspace event correctly.
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.keyDown(selectboxInput, {
      key: "Backspace",
      keyCode: 8,
      code: "Backspace",
    })

    // ensure that onChange was not called for the remove
    expect(props.onChange).toHaveBeenCalledTimes(0)
    // ensure that the input value was updated
    expect(
      within(selectbox).queryAllByText(props.options[0], { exact: true })
    ).toHaveLength(0)
  })

  it("allows new options when acceptNewOptions is true", async () => {
    const user = userEvent.setup()
    props = getProps({
      acceptNewOptions: true,
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")
    await user.type(selectboxInput, "hello world!")
    await user.keyboard("{enter}")
    expect(props.onChange).toHaveBeenCalledTimes(1)
    expect(props.onChange).toHaveBeenCalledWith("hello world!")
    const selectbox = screen.getByTestId("stSelectbox")
    expect(within(selectbox).getByText("hello world!")).toBeInTheDocument()
  })

  describe("on mobile", () => {
    beforeEach(() => {
      vi.spyOn(MobileUtil, "isMobile").mockReturnValue(true)
    })

    it("allows typing when acceptNewOptions is true even with few options", async () => {
      const user = userEvent.setup()
      props = getProps({ acceptNewOptions: true, options: ["a", "b", "c"] })
      render(<Selectbox {...props} />)
      const selectboxInput = screen.getByRole("combobox")
      await user.type(selectboxInput, "mobile new option")
      await user.keyboard("{enter}")
      expect(props.onChange).toHaveBeenCalledWith("mobile new option")
    })

    it("keeps input readonly when acceptNewOptions is false and few options", async () => {
      const user = userEvent.setup()
      props = getProps({ acceptNewOptions: false, options: ["a", "b", "c"] })
      render(<Selectbox {...props} />)
      const input = screen.getByRole("combobox")
      expect(input).toHaveAttribute("readonly")
      await user.type(input, "should not type")
      // No creatable option is shown, since typing is blocked
      expect(screen.queryByText(/Add:/i)).not.toBeInTheDocument()
    })
  })

  it("does not allow new options when acceptNewOptions is false", async () => {
    const user = userEvent.setup()
    props = getProps({
      acceptNewOptions: false,
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")
    await user.type(selectboxInput, "hello world!")
    await user.keyboard("{enter}")
    expect(props.onChange).toHaveBeenCalledTimes(0)
  })
})

describe("Selectbox widget with optional props", () => {
  // This goes against the previous solution to bug #3220, but that's on purpose.
  it("renders no label element if no text provided", () => {
    const props = getProps({ label: undefined })
    render(<Selectbox {...props} />)

    expect(screen.queryByTestId("stWidgetLabel")).not.toBeInTheDocument()
  })

  it("renders TooltipIcon if help text provided", () => {
    const props = getProps({ help: "help text" })
    render(<Selectbox {...props} />)

    expect(screen.getByTestId("stTooltipIcon")).toBeInTheDocument()
  })

  it("allows case sensitive new options to be added", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: ["aa", "Aa", "aA"],
      acceptNewOptions: true,
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "AA")

    expect(screen.getByText("Add: AA")).toBeInTheDocument()
  })
})
