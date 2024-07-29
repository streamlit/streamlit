/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import "@testing-library/jest-dom"
import { fireEvent, screen } from "@testing-library/react"

import { render } from "@streamlit/lib/src/test_util"
import { LabelVisibilityOptions } from "@streamlit/lib/src/util/utils"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"

import { fuzzyFilterSelectOptions, Props, Selectbox } from "./Selectbox"

jest.mock("@streamlit/lib/src/WidgetStateManager")

const getProps = (props: Partial<Props> = {}): Props => ({
  value: 0,
  label: "Label",
  options: ["a", "b", "c"],
  width: 0,
  disabled: false,
  onChange: jest.fn(),
  theme: mockTheme.emotion,
  placeholder: "Select...",
  ...props,
})

describe("Selectbox widget", () => {
  let props: Props

  beforeEach(() => {
    props = getProps()
  })

  it("renders without crashing", () => {
    render(<Selectbox {...props} />)
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("has correct className and style", () => {
    render(<Selectbox {...props} />)
    const selectbox = screen.getByTestId("stSelectbox")
    expect(selectbox).toHaveClass("stSelectbox")
    expect(selectbox).toHaveClass("row-widget")
    expect(selectbox).toHaveStyle(`width: ${props.width}px`)
  })

  it("renders a label", () => {
    render(<Selectbox {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveTextContent(
      `${props.label}`
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Hidden,
    })
    render(<Selectbox {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Collapsed,
    })
    render(<Selectbox {...props} />)
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
    })
    render(<Selectbox {...props} />)

    expect(screen.getByText("No options to select.")).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("renders options", () => {
    render(<Selectbox {...props} />)
    const selectbox = screen.getByRole("combobox")
    fireEvent.click(selectbox)
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

  it("is able to select an option", () => {
    render(<Selectbox {...props} />)
    const selectbox = screen.getByRole("combobox")
    // Open the dropdown
    fireEvent.click(selectbox)
    const options = screen.getAllByRole("option")
    fireEvent.click(options[1])

    expect(props.onChange).toHaveBeenCalledWith(1)
    expect(screen.getByText(props.options[1])).toBeInTheDocument()
  })

  it("doesn't filter options based on index", () => {
    render(<Selectbox {...props} />)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } })
    expect(screen.getByText("No results")).toBeInTheDocument()
  })

  it("filters options based on label with case insensitive", () => {
    render(<Selectbox {...props} />)
    const selectbox = screen.getByRole("combobox")

    fireEvent.change(selectbox, { target: { value: "b" } })
    let options = screen.getAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("b")

    fireEvent.change(selectbox, { target: { value: "B" } })
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

  it("updates value if new value provided from parent", () => {
    const { rerender } = render(<Selectbox {...props} />)
    // Original value passed is 0
    expect(screen.getByText(props.options[0])).toBeInTheDocument()

    props = getProps({ value: 1 })
    rerender(<Selectbox {...props} />)
    expect(screen.getByText(props.options[1])).toBeInTheDocument()
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
})
