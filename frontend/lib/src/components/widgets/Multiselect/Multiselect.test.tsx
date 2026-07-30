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
  streamlit,
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

    const removeButtons = screen.getAllByRole("button", { name: /^Remove / })
    expect(removeButtons).toHaveLength(2)
    // Tags are rendered with their value text
    expect(screen.getByText("b")).toBeVisible()
    expect(screen.getByText("c")).toBeVisible()
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

      expect(screen.getByPlaceholderText("Please select")).toBeVisible()
    })

    it("renders with custom placeholder", () => {
      const props = getProps({
        default: [],
        options: ["a", "b", "c"],
        placeholder: "Custom placeholder text",
      })
      render(<Multiselect {...props} />)

      expect(
        screen.getByPlaceholderText("Custom placeholder text")
      ).toBeVisible()
    })

    it("integrates with placeholder utility for default behavior", () => {
      const props = getProps({
        default: [],
        options: ["a", "b", "c"],
        placeholder: "",
        acceptNewOptions: false,
      })
      render(<Multiselect {...props} />)

      expect(screen.getByPlaceholderText("Choose options")).toBeVisible()
    })

    it("handles single space placeholder as a valid placeholder", () => {
      const props = getProps({
        default: [],
        options: ["a", "b", "c"],
        placeholder: " ",
      })
      render(<Multiselect {...props} />)

      expect(
        screen.queryByPlaceholderText("Choose options")
      ).not.toBeInTheDocument()
      expect(
        screen.queryByPlaceholderText("Choose or add options")
      ).not.toBeInTheDocument()
      expect(
        screen.queryByPlaceholderText("Add options")
      ).not.toBeInTheDocument()
      expect(
        screen.queryByPlaceholderText("No options to select")
      ).not.toBeInTheDocument()
    })
  })

  it("renders options", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: [] })
    render(<Multiselect {...props} />)

    await user.click(screen.getByRole("button", { name: "Open" }))

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
    const multiSelect = screen.getByRole("combobox")
    await user.type(multiSelect, "b")
    // Select the matching option from the list
    const match = screen.getByRole("option")
    await user.click(match)

    // Verify both values are now shown as tags
    expect(screen.getByText("a")).toBeVisible()
    expect(screen.getByText("b")).toBeVisible()
  })

  it("can remove options", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<Multiselect {...props} />)

    // Clear current selection via the tag's remove button
    const removeButton = screen.getByRole("button", { name: "Remove a" })
    await user.click(removeButton)

    // Should now see all options available again
    await user.click(screen.getByRole("button", { name: "Open" }))

    const options = screen.getAllByRole("option")
    // First option is "Select all", followed by the actual options
    expect(options.length).toBe(props.element.options.length + 1)
    expect(options[0]).toHaveTextContent("Select all")
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
    await user.click(screen.getByRole("button", { name: "Open" }))

    const options = screen.getAllByRole("option")
    // First option is "Select all", followed by the actual options
    expect(options.length).toBe(props.element.options.length + 1)
    expect(options[0]).toHaveTextContent("Select all")
    const dataOptions = options.slice(1)
    dataOptions.forEach((option, idx) => {
      expect(option).toHaveTextContent(props.element.options[idx])
    })
  })

  it("does not clear the selection on Escape regardless of default", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: [] })
    // Seed a user selection so there is a value to verify preservation.
    props.widgetMgr.setStringArrayValue(
      props.element,
      ["b"],
      { fromUi: true },
      undefined
    )
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<Multiselect {...props} />)

    expect(screen.getByRole("button", { name: "Remove b" })).toBeVisible()

    // Focus the input and close the dropdown that opens on click
    await user.click(screen.getByRole("combobox"))
    await user.keyboard("{Escape}")

    // Dropdown is closed — additional Escape presses must never clear
    // committed selections (WAI-ARIA APG: Escape dismisses popup, never
    // clears committed values). See #16109.
    await user.keyboard("{Escape}")
    await user.keyboard("{Escape}")

    expect(screen.getByRole("button", { name: "Remove b" })).toBeVisible()
    expect(props.widgetMgr.setStringArrayValue).not.toHaveBeenCalledWith(
      props.element,
      [],
      { fromUi: true },
      undefined
    )
  })

  it("resets its value when form is cleared", async () => {
    // Create a widget in a clearOnSubmit form
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<Multiselect {...props} />)

    // Change the widget value - add selection (b)
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

    // Our widget should be reset, and the widgetMgr should be updated.
    // The dropdown may still be open from the previous selection, so open it
    // if needed (multi-select keeps it open on selection).
    if (screen.queryAllByRole("option").length === 0) {
      await user.click(screen.getByRole("button", { name: "Open" }))
    }
    // Options list should have "Select all" + b & c available - default a selected
    const updatedOptions = screen.getAllByRole("option")
    expect(updatedOptions.length).toBe(3)
    expect(updatedOptions[0]).toHaveTextContent("Select all")
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
      await user.click(screen.getByRole("button", { name: "Open" }))
      // Options list should have "Select all" + b & c available - default a selected
      const options = screen.getAllByRole("option")
      expect(options.length).toBe(3)
      expect(options[0]).toHaveTextContent("Select all")
      const dataOptions = options.slice(1)
      expect(dataOptions[0]).toHaveTextContent("b")
      expect(dataOptions[1]).toHaveTextContent("c")
      // Select b from the list
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
      const removeButton = screen.getByRole("button", { name: "Remove a" })
      await user.click(removeButton)

      // Options list should have "Select all" + a & c available - b selected
      await user.click(screen.getByRole("button", { name: "Open" }))
      const updatedOptions = screen.getAllByRole("option")
      expect(updatedOptions.length).toBe(3)
      expect(updatedOptions[0]).toHaveTextContent("Select all")
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

  it("does not allow re-adding an already-selected custom value", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: ["apple", "banana"],
      acceptNewOptions: true,
    })
    render(<Multiselect {...props} />)
    const input = screen.getByRole("combobox")

    // Add a custom value "mango"
    await user.type(input, "mango")
    expect(screen.getByText("Add: mango")).toBeInTheDocument()
    await user.keyboard("{Enter}")

    // Verify "mango" was added as a tag
    expect(screen.getByText("mango")).toBeVisible()

    // Type "mango" again — "Add: mango" should NOT appear
    await user.type(input, "mango")
    expect(screen.queryByText("Add: mango")).not.toBeInTheDocument()
  })

  it("activates bulk action via Enter when acceptNewOptions is true", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: [],
      options: ["apple", "banana", "cherry"],
      acceptNewOptions: true,
    })
    render(<Multiselect {...props} />)
    const input = screen.getByRole("combobox")

    // Open dropdown and type a filter that matches multiple options
    await user.type(input, "a")

    // "Select X matches" bulk action should be visible
    const bulkAction = screen.getByText(/Select \d+ matches/)
    expect(bulkAction).toBeVisible()

    // Press ArrowDown to focus the bulk action, then Enter to activate it
    await user.keyboard("{ArrowDown}{Enter}")

    // All matching options should now be selected as tags
    expect(screen.getByText("apple")).toBeVisible()
    expect(screen.getByText("banana")).toBeVisible()

    // The input should NOT have created "a" as a custom value
    expect(screen.queryByText("a", { exact: true })).not.toBeInTheDocument()
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
    const dataOptions = options.slice(1)
    expect(dataOptions[0]).toHaveTextContent("aa")
    expect(dataOptions[1]).toHaveTextContent("Aa")
    expect(dataOptions[2]).toHaveTextContent("aA")
  })

  it("uses filterMode=contains for match filtering and bulk selection labels", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: [],
      options: ["apple", "grape", "banana"],
      filterMode: streamlit.SelectWidgetFilterMode.FILTER_MODE_CONTAINS,
    })
    render(<Multiselect {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "AP")

    const options = screen.queryAllByRole("option")
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent("Select 2 matches")
    expect(options[1]).toHaveTextContent("apple")
    expect(options[2]).toHaveTextContent("grape")
  })

  it("keeps all options visible and disables typing (inputmode=none) when filterMode is none", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: [],
      options: ["yes", "no", "maybe"],
      filterMode: streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE,
    })
    render(<Multiselect {...props} />)
    const input = screen.getByRole("combobox")

    expect(input).toHaveAttribute("inputmode", "none")
    expect(input).not.toHaveAttribute("readonly")

    await user.click(input)
    expect(screen.queryAllByRole("option")).toHaveLength(4)

    await user.type(input, "no")
    expect(screen.queryAllByRole("option")).toHaveLength(4)
  })

  it("allows Backspace to remove last tag when filterMode is none", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: [0, 1],
      options: ["yes", "no", "maybe"],
      filterMode: streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE,
    })
    render(<Multiselect {...props} />)
    const input = screen.getByRole("combobox")

    expect(screen.getByRole("button", { name: "Remove no" })).toBeVisible()

    await user.click(input)
    await user.keyboard("{Backspace}")

    expect(
      screen.queryByRole("button", { name: "Remove no" })
    ).not.toBeInTheDocument()
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
      // The tags container is the scrollable div inside the trigger
      const tagsContainer = multiselect.querySelector(
        "[data-testid='stMultiSelect'] div div"
      )?.firstElementChild?.firstElementChild

      expect(tagsContainer).not.toBeNull()
      if (!tagsContainer) {
        return
      }

      Object.defineProperty(tagsContainer, "scrollTop", {
        writable: true,
        configurable: true,
        value: 100,
      })
      tagsContainer.dispatchEvent(new Event("scroll", { bubbles: true }))

      const removeButtons = screen.getAllByRole("button", {
        name: /^Remove /,
      })
      await user.click(removeButtons[5])

      expect(tagsContainer.scrollTop).toBe(100)
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
      await user.click(screen.getByRole("button", { name: "Open" }))

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
      await user.click(screen.getByRole("button", { name: "Open" }))

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
      await user.click(screen.getByRole("button", { name: "Open" }))

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
      await user.click(screen.getByRole("button", { name: "Open" }))

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
      await user.click(screen.getByRole("button", { name: "Open" }))

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
      await user.click(screen.getByRole("button", { name: "Open" }))

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

    it("does not show Select all when there are >= 1000 options", async () => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
        320
      )
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
        300
      )
      const user = userEvent.setup()
      const options = Array.from({ length: 1000 }, (_, i) => `option_${i}`)
      const props = getProps({ default: [], options })
      render(<Multiselect {...props} />)

      await user.click(screen.getByRole("button", { name: "Open" }))

      expect(screen.queryByText("Select all")).not.toBeInTheDocument()
      // Options should still be visible
      expect(screen.getByText("option_0")).toBeVisible()
    })

    it("does not show Select X matches when there are >= 1000 options", async () => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
        320
      )
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
        300
      )
      const user = userEvent.setup()
      const options = Array.from({ length: 1000 }, (_, i) => `option_${i}`)
      const props = getProps({ default: [], options })
      render(<Multiselect {...props} />)

      const multiSelect = screen.getByRole("combobox")
      await user.click(multiSelect)
      // Search for options matching "option_1"
      await user.type(multiSelect, "option_1")

      // "Select X matches" should NOT be shown for >= 1000 total options
      expect(screen.queryByText(/Select \d+ matches/)).not.toBeInTheDocument()
      // But matching options should still be visible
      expect(screen.queryAllByText(/option_1/).length).toBeGreaterThan(0)
    })

    it("shows Select all when there are less than 1000 options", async () => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
        320
      )
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
        300
      )
      const user = userEvent.setup()
      const options = Array.from({ length: 999 }, (_, i) => `option_${i}`)
      const props = getProps({ default: [], options })
      render(<Multiselect {...props} />)

      await user.click(screen.getByRole("button", { name: "Open" }))

      expect(screen.getByText("Select all")).toBeVisible()
    })
  })
})

describe("Multiselect query param binding", () => {
  beforeEach(() => {
    vi.spyOn(Utils, "convertRemToPx").mockImplementation(mockConvertRemToPx)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

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

describe("Multiselect tag accessibility", () => {
  beforeEach(() => {
    vi.spyOn(Utils, "convertRemToPx").mockImplementation(mockConvertRemToPx)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function getTags(): HTMLElement[] {
    return screen.getAllByLabelText(/.*/, {
      selector: "[data-tag]",
    })
  }

  it("renders tags with ARIA attributes and roving tabindex", () => {
    const props = getProps({
      default: [0, 1, 2],
      options: ["alpha", "beta", "gamma"],
    })
    render(<Multiselect {...props} />)

    const tags = getTags()
    expect(tags).toHaveLength(3)

    // Tags are wrapped in a group with accessible label
    const group = screen.getByRole("group", { name: "Selected values" })
    expect(group).toBeVisible()

    // Each tag has correct semantics
    expect(tags[0]).toHaveAttribute("aria-label", "alpha")
    expect(tags[1]).toHaveAttribute("aria-label", "beta")

    // Only first tag is tabbable (roving tabindex)
    expect(tags[0]).toHaveAttribute("tabindex", "0")
    expect(tags[1]).toHaveAttribute("tabindex", "-1")
    expect(tags[2]).toHaveAttribute("tabindex", "-1")
  })

  it("disables tag focus and hides remove buttons when disabled", () => {
    const props = getProps(
      { default: [0, 1], options: ["a", "b", "c"] },
      { disabled: true }
    )
    render(<Multiselect {...props} />)

    const tags = getTags()
    expect(tags[0]).toHaveAttribute("tabindex", "-1")
    expect(tags[1]).toHaveAttribute("tabindex", "-1")
    expect(
      screen.queryByRole("button", { name: "Remove a" })
    ).not.toBeInTheDocument()
  })

  it("navigates between tags with arrow keys, Home, and End", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: [0, 1, 2],
      options: ["a", "b", "c"],
    })
    render(<Multiselect {...props} />)

    const tags = getTags()
    act(() => tags[0].focus())
    expect(tags[0]).toHaveFocus()

    // ArrowRight moves to next
    await user.keyboard("{ArrowRight}")
    expect(tags[1]).toHaveFocus()
    expect(tags[0]).toHaveAttribute("tabindex", "-1")
    expect(tags[1]).toHaveAttribute("tabindex", "0")

    // ArrowLeft moves back
    await user.keyboard("{ArrowLeft}")
    expect(tags[0]).toHaveFocus()

    // End jumps to last
    await user.keyboard("{End}")
    expect(tags[2]).toHaveFocus()

    // Home jumps to first
    await user.keyboard("{Home}")
    expect(tags[0]).toHaveFocus()

    // ArrowRight from last moves to input
    await user.keyboard("{End}")
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("combobox")).toHaveFocus()
  })

  it("removes a tag with Delete key", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: [0, 1, 2],
      options: ["a", "b", "c"],
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    render(<Multiselect {...props} />)

    const tags = getTags()
    act(() => tags[0].focus())

    // Delete removes first tag
    await user.keyboard("{Delete}")
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      ["b", "c"],
      { fromUi: true },
      undefined
    )
  })

  it("maintains correct tabindex after Backspace removal", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: [0, 1, 2],
      options: ["a", "b", "c"],
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    const { rerender } = render(<Multiselect {...props} />)

    // Navigate to the middle tag via keyboard (ArrowRight from first)
    let tags = getTags()
    act(() => tags[0].focus())
    await user.keyboard("{ArrowRight}")
    expect(tags[1]).toHaveFocus()
    expect(tags[1]).toHaveAttribute("tabindex", "0")

    // Backspace removes focused tag; left neighbor gets tabindex=0
    await user.keyboard("{Backspace}")
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      ["a", "c"],
      { fromUi: true },
      undefined
    )

    // Simulate rerender with updated value
    const updatedProps = getProps({
      default: [0, 2],
      options: ["a", "b", "c"],
    })
    rerender(<Multiselect {...updatedProps} />)

    tags = getTags()
    expect(tags).toHaveLength(2)
    // After removing middle tag, the right neighbor (now at index 1) is tabbable
    expect(tags[0]).toHaveAttribute("tabindex", "-1")
    expect(tags[1]).toHaveAttribute("tabindex", "0")
  })

  it("moves tabindex to left neighbor when last tag is Backspace-removed", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: [0, 1, 2],
      options: ["a", "b", "c"],
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")
    const { rerender } = render(<Multiselect {...props} />)

    // Navigate to the last tag
    let tags = getTags()
    act(() => tags[0].focus())
    await user.keyboard("{End}")
    expect(tags[2]).toHaveFocus()

    // Backspace last tag — no right neighbor, so left gets focus
    await user.keyboard("{Backspace}")
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      ["a", "b"],
      { fromUi: true },
      undefined
    )

    const updatedProps = getProps({
      default: [0, 1],
      options: ["a", "b", "c"],
    })
    rerender(<Multiselect {...updatedProps} />)

    tags = getTags()
    expect(tags).toHaveLength(2)
    // Left neighbor (index 1) should now be tabbable
    expect(tags[0]).toHaveAttribute("tabindex", "-1")
    expect(tags[1]).toHaveAttribute("tabindex", "0")
  })

  it("moves focus to input when the last tag is removed", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: [0],
      options: ["a", "b", "c"],
    })
    render(<Multiselect {...props} />)

    const tags = getTags()
    act(() => tags[0].focus())

    await user.keyboard("{Delete}")
    expect(screen.getByRole("combobox")).toHaveFocus()
  })
})
