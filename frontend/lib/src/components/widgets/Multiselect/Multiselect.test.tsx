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

import { act, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  MultiSelect as MultiSelectProto,
} from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"
import * as Utils from "~lib/theme/utils"
import { mockConvertRemToPx } from "~lib/mocks/mocks"

import Multiselect, { Props } from "./Multiselect"

const getProps = (
  elementProps: Partial<MultiSelectProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: MultiSelectProto.create({
    id: "1",
    label: "Label",
    default: [0],
    options: ["a", "b", "c"],
    placeholder: "Please select",
    filterMode: "fuzzy", // Default to fuzzy to match backend behavior
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...widgetProps,
})

describe("Multiselect widget", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.spyOn(Utils, "convertRemToPx").mockImplementation(mockConvertRemToPx)
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<Multiselect {...props} />)

    const multiSelect = screen.getByTestId("stMultiSelect")
    expect(multiSelect).toBeInTheDocument()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<Multiselect {...props} />)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      props.element.default.map(index => props.element.options[index]),
      {
        fromUi: false,
      },
      undefined
    )
  })

  it("gets correct value from proto", () => {
    const props = getProps({
      rawValues: ["b", "c"],
      setValue: true,
    })
    render(<Multiselect {...props} />)

    const selections = screen.getAllByRole("button")
    // one of the buttons is the dropdown button
    expect(selections.length).toBe(3)
    expect(selections[0]).toHaveTextContent("b")
    expect(selections[1]).toHaveTextContent("c")
  })

  it("can pass fragmentId to setStringArrayValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<Multiselect {...props} />)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      props.element.default.map(index => props.element.options[index]),
      {
        fromUi: false,
      },
      "myFragmentId"
    )
  })

  it("has correct className", () => {
    const props = getProps()
    render(<Multiselect {...props} />)
    const multiSelect = screen.getByTestId("stMultiSelect")

    expect(multiSelect).toHaveClass("stMultiSelect")
  })

  it("renders a label", () => {
    const props = getProps()
    render(<Multiselect {...props} />)

    const widgetLabel = screen.queryByText(`${props.element.label}`)
    expect(widgetLabel).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<Multiselect {...props} />)
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
    render(<Multiselect {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  describe("placeholder", () => {
    it("renders when default is empty", () => {
      const props = getProps({ default: [] })
      render(<Multiselect {...props} />)

      const placeholder = screen.getByText("Please select")
      expect(placeholder).toBeInTheDocument()
    })

    it("renders with empty options", () => {
      const props = getProps({ default: [], options: [] })
      render(<Multiselect {...props} />)

      const placeholder = screen.getByText("No options to select")
      expect(placeholder).toBeInTheDocument()
    })

    it("renders with empty options when acceptNewOptions is true", () => {
      const props = getProps({
        default: [],
        options: [],
        acceptNewOptions: true,
      })
      render(<Multiselect {...props} />)

      expect(screen.getByText("Add options")).toBeInTheDocument()
      expect(screen.getByRole("combobox")).not.toBeDisabled()
    })
  })

  it("renders options", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: [] })
    render(<Multiselect {...props} />)

    const expandListButton = screen.getAllByTitle("open")[0]
    await user.click(expandListButton)

    const options = screen.getAllByRole("option")
    expect(options.length).toBe(props.element.options.length)
    options.forEach((option, idx) => {
      expect(option).toHaveTextContent(props.element.options[idx])
    })
  })

  it("filters based on label, not value", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: [] })
    render(<Multiselect {...props} />)

    const multiSelect = screen.getByRole("combobox")

    await user.type(multiSelect, "1")
    expect(screen.getByText("No results")).toBeInTheDocument()

    await user.clear(multiSelect)
    await user.type(multiSelect, "a")
    const match = screen.getByRole("option")
    expect(match).toHaveTextContent("a")
  })

  it("can be disabled", () => {
    const props = getProps({}, { disabled: true })
    render(<Multiselect {...props} />)
    const multiSelect = screen.getByRole("combobox")
    expect(multiSelect).toBeDisabled()
  })

  it("can select multiple options", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<Multiselect {...props} />)

    // Add new selection (b) in addition to existing selection (a)
    // by typing in the preferred option
    const multiSelect = screen.getByRole("combobox")
    await user.type(multiSelect, "b")
    // Select the matching option from the list
    const match = screen.getByRole("option")
    await user.click(match)

    const selections = screen.getAllByRole("button")
    expect(selections[0]).toHaveTextContent("a")
    expect(selections[1]).toHaveTextContent("b")
  })

  it("can remove options", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<Multiselect {...props} />)

    // Clear current selection
    const deleteOptionButton = screen.getAllByTitle("Delete")[0]
    await user.click(deleteOptionButton)

    // Should now see all options available again
    const expandListButton = screen.getAllByTitle("open")[0]
    await user.click(expandListButton)

    const options = screen.getAllByRole("option")
    expect(options.length).toBe(props.element.options.length)
    options.forEach((option, idx) => {
      expect(option).toHaveTextContent(props.element.options[idx])
    })
  })

  it("can clear all", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<Multiselect {...props} />)

    // Clear all selections
    const clearAllButton = screen.getByRole("button", { name: "Clear all" })
    await user.click(clearAllButton)

    // Should now see all options available again
    const expandListButton = screen.getAllByTitle("open")[0]
    await user.click(expandListButton)

    const options = screen.getAllByRole("option")
    expect(options.length).toBe(props.element.options.length)
    options.forEach((option, idx) => {
      expect(option).toHaveTextContent(props.element.options[idx])
    })
  })

  it("resets its value when form is cleared", async () => {
    // Create a widget in a clearOnSubmit form
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<Multiselect {...props} />)

    // Change the widget value - add selection (b)
    // to existing selection (a) by typing in
    const multiSelect = screen.getByRole("combobox")
    await user.type(multiSelect, "b")
    // Select the matching option from the list
    const match = screen.getByRole("option")
    await user.click(match)

    // Options list should only have c available - a & b selected
    const remainingOptions = screen.getAllByRole("option")
    expect(remainingOptions.length).toBe(1)
    expect(remainingOptions[0]).toHaveTextContent("c")

    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [props.element.options[0], props.element.options[1]],
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
    const expandListButton = screen.getAllByTitle("open")[0]
    await user.click(expandListButton)
    // Options list should only have b & c available - default a selected
    const updatedOptions = screen.getAllByRole("option")
    expect(updatedOptions.length).toBe(2)
    expect(updatedOptions[0]).toHaveTextContent("b")
    expect(updatedOptions[1]).toHaveTextContent("c")

    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default.map(index => props.element.options[index]),
      {
        fromUi: true,
      },
      undefined
    )
  })

  describe("properly invalidates going over max selections", () => {
    it("has correct noResultsMsg when maxSelections is not passed", async () => {
      const user = userEvent.setup()
      const props = getProps(
        MultiSelectProto.create({
          id: "1",
          label: "Label",
          default: [0],
          options: ["a", "b", "c"],
        })
      )
      render(<Multiselect {...props} />)

      // Type something with no matches
      const multiSelect = screen.getByRole("combobox")
      await user.type(multiSelect, "z")

      expect(screen.getByText("No results")).toBeInTheDocument()
    })

    it("has correct noResultsMsg when no match and selections < maxSelections", async () => {
      const user = userEvent.setup()
      const props = getProps(
        MultiSelectProto.create({
          id: "1",
          label: "Label",
          default: [0],
          options: ["a", "b", "c"],
          maxSelections: 3,
        })
      )
      render(<Multiselect {...props} />)

      // Type something with no matches
      const multiSelect = screen.getByRole("combobox")
      await user.type(multiSelect, "z")

      expect(screen.getByText("No results")).toBeInTheDocument()
    })

    it("has correct noResultsMsg when maxSelections reached", async () => {
      const user = userEvent.setup()
      const props = getProps(
        MultiSelectProto.create({
          id: "1",
          label: "Label",
          default: [0],
          options: ["a", "b", "c"],
          maxSelections: 2,
        })
      )
      render(<Multiselect {...props} />)

      // Select another option, b, from the dropdown list
      const expandListButton = screen.getAllByTitle("open")[0]
      // Open the list
      await user.click(expandListButton)
      // Options list should only have b & c available - default a selected
      const options = screen.getAllByRole("option")
      expect(options.length).toBe(2)
      expect(options[0]).toHaveTextContent("b")
      expect(options[1]).toHaveTextContent("c")
      // Select b from the list
      await user.click(options[0])

      expect(
        screen.getByText(
          "You can only select up to 2 options. Remove an option first."
        )
      ).toBeInTheDocument()
    })

    it("does not allow for more selection when an option is picked & maxSelections === 1", async () => {
      const user = userEvent.setup()
      const props = getProps(
        MultiSelectProto.create({
          id: "1",
          label: "Label",
          default: [0],
          options: ["a", "b", "c"],
          maxSelections: 1,
        })
      )
      render(<Multiselect {...props} />)

      const multiSelect = screen.getByRole("combobox")
      await user.click(multiSelect)

      expect(
        screen.getByText(
          "You can only select up to 1 option. Remove an option first."
        )
      ).toBeInTheDocument()
    })

    it("does allow an option to be removed when we are at max selections", async () => {
      const user = userEvent.setup()
      const props = getProps(
        MultiSelectProto.create({
          id: "1",
          label: "Label",
          default: [0, 1],
          options: ["a", "b", "c"],
          maxSelections: 2,
        })
      )
      render(<Multiselect {...props} />)

      // Clear a selection
      const deleteOptionButton = screen.getAllByTitle("Delete")[0]
      await user.click(deleteOptionButton)

      // Options list should only have a & c available - b selected
      const expandListButton = screen.getAllByTitle("open")[0]
      await user.click(expandListButton)
      const updatedOptions = screen.getAllByRole("option")
      expect(updatedOptions.length).toBe(2)
      expect(updatedOptions[0]).toHaveTextContent("a")
      expect(updatedOptions[1]).toHaveTextContent("c")
    })
  })

  it("allows case sensitive new options to be added", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: ["aa", "Aa", "aA"],
      acceptNewOptions: true,
    })
    render(<Multiselect {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "AA")

    expect(screen.getByText("Add: AA")).toBeInTheDocument()
  })

  it("predictably produces case sensitive matches", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: [],
      options: ["aa", "Aa", "aA"],
    })
    render(<Multiselect {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "aa")

    const options = screen.queryAllByRole("option")
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent("aa")
    expect(options[1]).toHaveTextContent("Aa")
    expect(options[2]).toHaveTextContent("aA")
  })

  describe("filter_mode functionality", () => {
    const testOptions = ["Apple", "Banana", "Cherry", "Date", "apple pie"]

    it("uses fuzzy filtering by default", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [],
        options: testOptions,
        filterMode: "fuzzy",
      })
      render(<Multiselect {...props} />)
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
        default: [],
        options: testOptions,
        filterMode: "exact",
      })
      render(<Multiselect {...props} />)
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
        default: [],
        options: testOptions,
        filterMode: "prefix",
      })
      render(<Multiselect {...props} />)
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
        default: [],
        options: testOptions,
        filterMode: "case_sensitive",
      })
      render(<Multiselect {...props} />)
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
        default: [],
        options: testOptions,
        filterMode: null,
        acceptNewOptions: false,
      })
      render(<Multiselect {...props} />)
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
        default: [],
        options: testOptions,
        filterMode: null,
        acceptNewOptions: true,
      })
      render(<Multiselect {...props} />)
      const selectboxInput = screen.getByRole("combobox")

      // Input should not be readonly when acceptNewOptions is true
      expect(selectboxInput).not.toHaveAttribute("readonly")

      await user.type(selectboxInput, "New Option")
      expect(screen.getByText("Add: New Option")).toBeInTheDocument()
      // Should not show existing options when typing
      expect(screen.queryByText("Apple")).not.toBeInTheDocument()
    })
  })
})
