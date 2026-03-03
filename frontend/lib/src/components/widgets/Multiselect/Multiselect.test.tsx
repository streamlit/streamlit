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

import { act, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  LabelVisibility as LabelVisibilityProto,
  MultiSelect as MultiSelectProto,
} from "@streamlit/protobuf"

import { mockConvertRemToPx } from "~lib/mocks/mocks"
import { render } from "~lib/test_util"
import * as Utils from "~lib/theme/utils"
import * as MobileUtil from "~lib/util/isMobile"
import { WidgetStateManager } from "~lib/WidgetStateManager"

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
        value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
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
        value: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
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

    it("renders with custom placeholder", () => {
      const props = getProps({
        default: [],
        options: ["a", "b", "c"],
        placeholder: "Custom placeholder text",
      })
      render(<Multiselect {...props} />)

      expect(screen.getByText("Custom placeholder text")).toBeInTheDocument()
    })

    it("integrates with placeholder utility for default behavior", () => {
      const props = getProps({
        default: [],
        options: ["a", "b", "c"],
        placeholder: "", // Empty string to trigger default placeholder
        acceptNewOptions: false,
      })
      render(<Multiselect {...props} />)

      // Verifies that the integration with getSelectPlaceholder utility works
      expect(screen.getByText("Choose options")).toBeInTheDocument()
    })

    it("handles single space placeholder as a valid placeholder", () => {
      const props = getProps({
        default: [],
        options: ["a", "b", "c"],
        placeholder: " ",
      })
      render(<Multiselect {...props} />)

      // Should not show any default placeholder text since single space is provided
      expect(screen.queryByText("Choose options")).not.toBeInTheDocument()
      expect(
        screen.queryByText("Choose or add options")
      ).not.toBeInTheDocument()
      expect(screen.queryByText("Add options")).not.toBeInTheDocument()
      expect(
        screen.queryByText("No options to select")
      ).not.toBeInTheDocument()
    })
  })

  it("renders options", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: [] })
    render(<Multiselect {...props} />)

    const expandListButton = screen.getAllByTitle("open")[0]
    await user.click(expandListButton)

    const options = screen.getAllByRole("option")
    // First option is "Select all", followed by the actual options
    expect(options.length).toBe(props.element.options.length + 1)
    expect(options[0]).toHaveTextContent("Select all")
    // Skip the first option (Select all) when checking data options
    const dataOptions = options.slice(1)
    dataOptions.forEach((option, idx) => {
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
    // First option is "Select all", followed by the actual options
    expect(options.length).toBe(props.element.options.length + 1)
    expect(options[0]).toHaveTextContent("Select all")
    // Skip the first option (Select all) when checking data options
    const dataOptions = options.slice(1)
    dataOptions.forEach((option, idx) => {
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
    // First option is "Select all", followed by the actual options
    expect(options.length).toBe(props.element.options.length + 1)
    expect(options[0]).toHaveTextContent("Select all")
    // Skip the first option (Select all) when checking data options
    const dataOptions = options.slice(1)
    dataOptions.forEach((option, idx) => {
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
    // "Select all" is not shown when there's only 1 unselected option
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
    // Options list should have "Select all" + b & c available - default a selected
    const updatedOptions = screen.getAllByRole("option")
    expect(updatedOptions.length).toBe(3)
    expect(updatedOptions[0]).toHaveTextContent("Select all")
    // Skip the first option (Select all) when checking data options
    const dataOptions = updatedOptions.slice(1)
    expect(dataOptions[0]).toHaveTextContent("b")
    expect(dataOptions[1]).toHaveTextContent("c")

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
      // Options list should have "Select all" + b & c available - default a selected
      const options = screen.getAllByRole("option")
      expect(options.length).toBe(3)
      expect(options[0]).toHaveTextContent("Select all")
      // Skip the first option (Select all) when checking data options
      const dataOptions = options.slice(1)
      expect(dataOptions[0]).toHaveTextContent("b")
      expect(dataOptions[1]).toHaveTextContent("c")
      // Select b from the list (click directly on b, not "Select all")
      await user.click(screen.getByText("b"))

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

      // Options list should have "Select all" + a & c available - b selected
      const expandListButton = screen.getAllByTitle("open")[0]
      await user.click(expandListButton)
      const updatedOptions = screen.getAllByRole("option")
      expect(updatedOptions.length).toBe(3)
      expect(updatedOptions[0]).toHaveTextContent("Select all")
      // Skip the first option (Select all) when checking data options
      const dataOptions = updatedOptions.slice(1)
      expect(dataOptions[0]).toHaveTextContent("a")
      expect(dataOptions[1]).toHaveTextContent("c")
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
    // First option is "Select X matches", followed by the matched options
    expect(options).toHaveLength(4)
    expect(options[0]).toHaveTextContent("Select 3 matches")
    // Skip the first option when checking data options
    const dataOptions = options.slice(1)
    expect(dataOptions[0]).toHaveTextContent("aa")
    expect(dataOptions[1]).toHaveTextContent("Aa")
    expect(dataOptions[2]).toHaveTextContent("aA")
  })

  describe("scroll position preservation", () => {
    it("preserves scroll position when removing an item", async () => {
      const user = userEvent.setup()
      const options = Array.from({ length: 20 }, (_, i) => `Option ${i + 1}`)
      const props = getProps({
        default: options.map((_, i) => i),
        options,
      })
      render(<Multiselect {...props} />)

      const multiselect = screen.getByTestId("stMultiSelect")
      const valueContainer = multiselect.querySelector(
        '[data-baseweb="select"] > div > div:first-child'
      )

      expect(valueContainer).not.toBeNull()
      if (valueContainer === null) {
        return
      }

      Object.defineProperty(valueContainer, "scrollTop", {
        writable: true,
        configurable: true,
        value: 100,
      })
      valueContainer.dispatchEvent(new Event("scroll", { bubbles: true }))

      const deleteButtons = screen.getAllByTitle("Delete")
      await user.click(deleteButtons[5])

      expect(valueContainer.scrollTop).toBe(100)
    })
  })

  describe("on mobile", () => {
    beforeEach(() => {
      vi.spyOn(MobileUtil, "isMobile").mockReturnValue(true)
    })

    it("allows typing when acceptNewOptions is true even with few options", async () => {
      const user = userEvent.setup()
      const props = getProps({
        acceptNewOptions: true,
        options: ["a", "b", "c"],
      })
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      render(<Multiselect {...props} />)
      const selectboxInput = screen.getByRole("combobox")
      await user.type(selectboxInput, "mobile new option")
      await user.keyboard("{enter}")
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        ["a", "mobile new option"],
        { fromUi: true },
        undefined
      )
    })

    it("keeps input readonly when acceptNewOptions is false and few options", async () => {
      const user = userEvent.setup()
      const props = getProps({
        acceptNewOptions: false,
        options: ["a", "b", "c"],
      })
      render(<Multiselect {...props} />)
      const input = screen.getByRole("combobox")
      expect(input).toHaveAttribute("readonly")
      await user.type(input, "should not type")
      // No creatable option is shown, since typing is blocked
      expect(screen.queryByText(/Add:/i)).not.toBeInTheDocument()
    })
  })

  describe("Select all and Select X matches", () => {
    it("selects all options from empty state", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: [] })
      vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<Multiselect {...props} />)

      // Open dropdown
      const expandListButton = screen.getAllByTitle("open")[0]
      await user.click(expandListButton)

      // Click "Select all"
      const selectAll = screen.getByText("Select all")
      await user.click(selectAll)

      // All options should be selected
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        ["a", "b", "c"],
        { fromUi: true },
        undefined
      )
    })

    it("selects all remaining options when some are already selected", async () => {
      const user = userEvent.setup()
      // Start with "a" already selected
      const props = getProps({ default: [0] })
      vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<Multiselect {...props} />)

      // Open dropdown
      const expandListButton = screen.getAllByTitle("open")[0]
      await user.click(expandListButton)

      // Click "Select all"
      const selectAll = screen.getByText("Select all")
      await user.click(selectAll)

      // All options should be selected (a was already selected, b and c added)
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        ["a", "b", "c"],
        { fromUi: true },
        undefined
      )
    })

    it("selects matching options from empty state with search", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [],
        options: ["apple", "apricot", "banana", "cherry"],
      })
      vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<Multiselect {...props} />)

      // Type to filter
      const multiSelect = screen.getByRole("combobox")
      await user.type(multiSelect, "ap")

      // Should show "Select 2 matches"
      const selectMatches = screen.getByText("Select 2 matches")
      await user.click(selectMatches)

      // Only matching options should be selected
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        ["apple", "apricot"],
        { fromUi: true },
        undefined
      )
    })

    it("selects matching options when a matching item is already selected", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [0], // "apple" is already selected
        options: ["apple", "apricot", "banana", "cherry", "grape"],
      })
      vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<Multiselect {...props} />)

      // Type to filter - "apple" is already selected, so only "apricot" shows
      const multiSelect = screen.getByRole("combobox")
      await user.type(multiSelect, "ap")

      // Should show "Select 2 matches"
      const selectMatches = screen.getByText("Select 2 matches")
      await user.click(selectMatches)

      // Only matching options should be selected
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        ["apple", "apricot", "grape"],
        { fromUi: true },
        undefined
      )
    })

    it("respects maxSelections when using Select all", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [],
        options: ["a", "b", "c", "d", "e"],
        maxSelections: 3,
      })
      vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<Multiselect {...props} />)

      // Open dropdown
      const expandListButton = screen.getAllByTitle("open")[0]
      await user.click(expandListButton)

      // Click "Select all"
      const selectAll = screen.getByText("Select all")
      await user.click(selectAll)

      // Only first 3 options should be selected (respecting maxSelections)
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        ["a", "b", "c"],
        { fromUi: true },
        undefined
      )
    })

    it("respects maxSelections when using Select all with existing selections", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [0], // "a" already selected
        options: ["a", "b", "c", "d", "e"],
        maxSelections: 3,
      })
      vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<Multiselect {...props} />)

      // Open dropdown
      const expandListButton = screen.getAllByTitle("open")[0]
      await user.click(expandListButton)

      // Click "Select all"
      const selectAll = screen.getByText("Select all")
      await user.click(selectAll)

      // Only 2 more options should be added (a + 2 = 3 = maxSelections)
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        ["a", "b", "c"],
        { fromUi: true },
        undefined
      )
    })

    it("respects maxSelections when using Select X matches", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [],
        options: ["apple", "apricot", "banana", "grape", "pineapple"],
        maxSelections: 2,
      })
      vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<Multiselect {...props} />)

      // Type to filter
      const multiSelect = screen.getByRole("combobox")
      await user.type(multiSelect, "ap")

      // Should show "Select 4 matches"
      const selectMatches = screen.getByText("Select 4 matches")
      await user.click(selectMatches)

      // Only first 2 matches should be selected (respecting maxSelections)
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        ["apple", "apricot"],
        { fromUi: true },
        undefined
      )
    })

    it("does not show Select all when there are zero options", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [0], // "a" is already selected
        options: ["a"], // Only one option, and it's already selected
      })
      render(<Multiselect {...props} />)

      // Open dropdown - should show "no options" state since all are selected
      const multiSelect = screen.getByRole("combobox")
      await user.click(multiSelect)

      // Neither "Select all" nor "Select X matches" should appear
      expect(screen.queryByText("Select all")).not.toBeInTheDocument()
      expect(screen.queryByText(/Select \d+ matches/)).not.toBeInTheDocument()
    })

    it("does not show Select all when there is only one option", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [],
        options: ["a"],
      })
      render(<Multiselect {...props} />)

      // Open dropdown
      const expandListButton = screen.getAllByTitle("open")[0]
      await user.click(expandListButton)

      // Should only see the single option, no "Select all"
      const options = screen.getAllByRole("option")
      expect(options.length).toBe(1)
      expect(options[0]).toHaveTextContent("a")
      expect(screen.queryByText("Select all")).not.toBeInTheDocument()
      expect(screen.queryByText(/Select.*matches/)).not.toBeInTheDocument()
    })

    it("does not show Select X matches when only one option matches search", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [],
        options: ["apple", "banana", "cherry"],
      })
      render(<Multiselect {...props} />)

      // Type to filter - only "apple" matches
      const multiSelect = screen.getByRole("combobox")
      await user.type(multiSelect, "apple")

      // Should only see the single matching option
      const options = screen.getAllByRole("option")
      expect(options.length).toBe(1)
      expect(options[0]).toHaveTextContent("apple")
      expect(screen.queryByText("Select all")).not.toBeInTheDocument()
      expect(screen.queryByText(/Select.*matches/)).not.toBeInTheDocument()
    })

    it("shows Select all without search and Select X matches with search, never both", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [],
        options: ["apple", "apricot", "banana"],
      })
      render(<Multiselect {...props} />)

      // Open dropdown without search
      const expandListButton = screen.getAllByTitle("open")[0]
      await user.click(expandListButton)

      // Should show "Select all", not "Select X matches"
      expect(screen.getByText("Select all")).toBeInTheDocument()
      expect(screen.queryByText(/Select.*matches/)).not.toBeInTheDocument()

      // Now type to search
      const multiSelect = screen.getByRole("combobox")
      await user.type(multiSelect, "ap")

      // Should show "Select X matches", not "Select all"
      expect(screen.getByText("Select 2 matches")).toBeInTheDocument()
      expect(screen.queryByText("Select all")).not.toBeInTheDocument()
    })

    it("switches back to Select all when search is cleared", async () => {
      const user = userEvent.setup()
      const props = getProps({
        default: [],
        options: ["apple", "apricot", "banana"],
      })
      render(<Multiselect {...props} />)

      // Open dropdown and search
      const multiSelect = screen.getByRole("combobox")
      await user.click(multiSelect)
      await user.type(multiSelect, "ap")

      // Should show "Select X matches"
      expect(screen.getByText("Select 2 matches")).toBeInTheDocument()

      // Clear search
      await user.clear(multiSelect)

      // Should show "Select all" again
      expect(screen.getByText("Select all")).toBeInTheDocument()
      expect(screen.queryByText(/Select.*matches/)).not.toBeInTheDocument()
    })
  })
})

describe("Multiselect query param binding", () => {
  it("registers query param binding on mount when queryParamKey is set", () => {
    const props = getProps({ queryParamKey: "my_multi" })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<Multiselect {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_multi",
      "string_array_value",
      ["a"],
      true,
      "repeated"
    )
  })

  it("unregisters query param binding on unmount", () => {
    const props = getProps({ queryParamKey: "my_multi" })
    const unregisterSpy = vi.spyOn(
      props.widgetMgr,
      "unregisterQueryParamBinding"
    )

    const { unmount } = render(<Multiselect {...props} />)

    // Clear any calls from React Strict Mode's initial mount/unmount/remount cycle
    unregisterSpy.mockClear()

    unmount()

    expect(props.widgetMgr.unregisterQueryParamBinding).toHaveBeenCalledWith(
      props.element.id
    )
  })

  it("does not register query param binding when queryParamKey is not set", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<Multiselect {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
  })
})
