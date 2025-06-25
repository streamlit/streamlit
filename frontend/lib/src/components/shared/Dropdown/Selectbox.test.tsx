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

import { render } from "~lib/test_util"
import { LabelVisibilityOptions } from "~lib/util/utils"
import * as Utils from "~lib/theme/utils"
import { mockConvertRemToPx } from "~lib/mocks/mocks"

import Selectbox, { Props } from "./Selectbox"

vi.mock("~lib/WidgetStateManager")

const getProps = (props: Partial<Props> = {}): Props => ({
  value: "a",
  label: "Label",
  options: ["a", "b", "c"],
  disabled: false,
  onChange: vi.fn(),
  placeholder: "Select...",
  filterMode: "fuzzy", // Default to fuzzy to match backend behavior
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

  it("pass placeholder prop correctly", () => {
    props = getProps({
      value: undefined,
      placeholder: "Please select",
    })
    render(<Selectbox {...props} />)
    expect(screen.getByText("Please select")).toBeInTheDocument()
  })

  it("renders a placeholder with empty options", () => {
    props = getProps({
      options: [],
      value: undefined,
    })
    render(<Selectbox {...props} />)

    expect(screen.getByText("No options to select")).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("renders a placeholder with empty options when acceptNewOptions is true", () => {
    props = getProps({
      options: [],
      acceptNewOptions: true,
      value: undefined,
    })
    render(<Selectbox {...props} />)

    expect(screen.getByText("Add an option")).toBeInTheDocument()
    expect(screen.getByRole("combobox")).not.toBeDisabled()
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
    // TODO: Utilize user-event instead of fireEvent
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.click(options[2])

    expect(props.onChange).toHaveBeenCalledWith("c")
    expect(screen.getByText(props.options[2])).toBeInTheDocument()
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

describe("filter_mode functionality", () => {
  const testOptions = ["Apple", "Banana", "Cherry", "Date", "apple pie"]

  it("uses fuzzy filtering by default", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: testOptions,
      filterMode: "fuzzy",
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "ale")
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(2)
    // Fuzzy search returns results based on score, so order may vary
    const optionTexts = options.map(option => option.textContent)
    expect(optionTexts).toContain("Apple")
    expect(optionTexts).toContain("apple pie")
  })

  it("uses exact filtering when filter_mode is 'exact'", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: testOptions,
      filterMode: "exact",
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "Cherry")
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("Cherry")

    await user.clear(selectboxInput)
    await user.type(selectboxInput, "pie")
    const optionsLower = screen.getAllByRole("option")
    expect(optionsLower).toHaveLength(1)
    expect(optionsLower[0]).toHaveTextContent("apple pie")
  })

  it("uses prefix filtering when filter_mode is 'prefix'", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: testOptions,
      filterMode: "prefix",
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "apple p")
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("apple pie")

    await user.clear(selectboxInput)
    await user.type(selectboxInput, "Ch")
    const optionsCapital = screen.getAllByRole("option")
    expect(optionsCapital).toHaveLength(1)
    expect(optionsCapital[0]).toHaveTextContent("Cherry")
  })

  it("uses case-sensitive filtering when filter_mode is 'case_sensitive'", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: testOptions,
      filterMode: "case_sensitive",
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "Apple")
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("Apple")

    await user.clear(selectboxInput)
    await user.type(selectboxInput, "apple")
    const optionsLower = screen.getAllByRole("option")
    expect(optionsLower).toHaveLength(1)
    expect(optionsLower[0]).toHaveTextContent("apple pie")

    await user.clear(selectboxInput)
    await user.type(selectboxInput, "APPLE")
    expect(screen.getByText("No results")).toBeInTheDocument()
  })

  it("disables filtering when filter_mode is null", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: testOptions,
      filterMode: null,
      acceptNewOptions: false, // Explicitly set to false
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    // Input should be readonly when filter_mode is null and acceptNewOptions is false
    expect(selectboxInput).toHaveAttribute("readonly")

    // Click to open dropdown should show all options
    await user.click(selectboxInput)
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(testOptions.length)
  })

  it("allows typing when filter_mode is null and acceptNewOptions is true", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: testOptions,
      filterMode: null,
      acceptNewOptions: true,
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    // Input should not be readonly when acceptNewOptions is true
    expect(selectboxInput).not.toHaveAttribute("readonly")

    await user.type(selectboxInput, "New Option")
    expect(screen.getByText("Add: New Option")).toBeInTheDocument()
    // Should not show existing options when typing
    expect(screen.queryByText("Apple")).not.toBeInTheDocument()
  })
})
