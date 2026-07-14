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
  createEvent,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { streamlit } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import * as MobileUtil from "~lib/util/isMobile"
import { LabelVisibilityOptions } from "~lib/util/utils"

import Selectbox, { Props } from "./Selectbox"

vi.mock("~lib/WidgetStateManager")

const getProps = (props: Partial<Props> = {}): Props => ({
  value: "a",
  label: "Label",
  options: ["a", "b", "c"],
  disabled: false,
  onChange: vi.fn(),
  placeholder: "Select...",
  acceptNewOptions: false,
  filterMode: streamlit.SelectWidgetFilterMode.FILTER_MODE_FUZZY,
  ...props,
})

/** Click the Open button to reveal the ComboBox dropdown. */
async function openDropdown(
  user: ReturnType<typeof userEvent.setup>
): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Open" }))
}

/** Force a non-zero viewport so the virtualizer renders a window of rows. */
function mockVirtualizerViewport(): void {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(320)
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300)
}

describe("Selectbox widget", () => {
  let props: Props

  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    props = getProps()
  })

  it("renders without crashing", () => {
    render(<Selectbox {...props} />)
    expect(screen.getByRole("combobox")).toBeVisible()
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
    expect(screen.getByPlaceholderText("Please select")).toBeVisible()
  })

  it("integrates with placeholder utility - disabled state when no options", () => {
    props = getProps({
      options: [],
      value: undefined,
      placeholder: "",
    })
    render(<Selectbox {...props} />)

    expect(screen.getByPlaceholderText("No options to select")).toBeVisible()
    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("renders options", async () => {
    const user = userEvent.setup()
    render(<Selectbox {...props} />)
    await openDropdown(user)
    const options = screen.getAllByRole("option")

    expect(options).toHaveLength(props.options.length)
    options.forEach((option, index) => {
      expect(option).toHaveTextContent(props.options[index])
    })
  })

  it("virtualizes large option lists", async () => {
    mockVirtualizerViewport()
    const user = userEvent.setup()
    const largeOptions = Array.from(
      { length: 16_000 },
      (_, index) => `Option ${index}`
    )
    props = getProps({
      options: largeOptions,
      value: undefined,
    })
    render(<Selectbox {...props} />)

    await openDropdown(user)

    // Only a small window of the 16k options is rendered when virtualized:
    // an upper bound guards against rendering the full list, and asserting a
    // mid-window option is present guards against under-rendering (e.g. a
    // single row) that an upper bound alone would not catch.
    const renderedOptions = await screen.findAllByRole("option")
    expect(renderedOptions.length).toBeLessThan(100)
    expect(screen.getByRole("option", { name: "Option 0" })).toBeVisible()
    expect(screen.getByRole("option", { name: "Option 5" })).toBeVisible()
    expect(
      screen.queryByRole("option", { name: "Option 15999" })
    ).not.toBeInTheDocument()
  })

  it("could be disabled", () => {
    props = getProps({
      disabled: true,
    })
    render(<Selectbox {...props} />)
    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("does not open the dropdown when disabled and clicked", async () => {
    const user = userEvent.setup()
    props = getProps({ disabled: true })
    render(<Selectbox {...props} />)
    await user.click(screen.getByRole("combobox"))
    expect(screen.queryByRole("option")).not.toBeInTheDocument()
  })

  it("does not open the dropdown when disabled and ArrowDown is pressed", async () => {
    const user = userEvent.setup()
    props = getProps({ disabled: true })
    render(<Selectbox {...props} />)
    const input = screen.getByRole("combobox")
    await user.click(input)
    await user.keyboard("{ArrowDown}")
    expect(screen.queryByRole("option")).not.toBeInTheDocument()
  })

  it("does not open the dropdown when no options are available", async () => {
    const user = userEvent.setup()
    props = getProps({ options: [], value: undefined, placeholder: "" })
    render(<Selectbox {...props} />)
    await user.click(screen.getByRole("combobox"))
    expect(screen.queryByRole("option")).not.toBeInTheDocument()
  })

  it("is able to select an option", async () => {
    const user = userEvent.setup()
    render(<Selectbox {...props} />)
    await openDropdown(user)
    const options = screen.getAllByRole("option")
    await user.click(options[2])

    expect(props.onChange).toHaveBeenCalledWith("c")
    expect(screen.getByDisplayValue("c")).toBeVisible()
  })

  it("selects an option via arrow-nav + Enter (racHandledEnterRef path)", async () => {
    // Exercises the most complex keyboard path: ArrowDown navigates to "b"
    // which RAC commits via onSelectionChange (setting racHandledEnterRef),
    // then Enter fires our bubble-phase handler which must NOT double-commit.
    const user = userEvent.setup()
    render(<Selectbox {...props} />)
    const input = screen.getByRole("combobox")

    await user.click(input)
    // With initial value "a" (index 0), ArrowDown navigates to "b" (index 1).
    // RAC fires onSelectionChange("1") which commits "b" and sets racHandledEnterRef.
    // Press Enter immediately after — our handler sees racHandledEnterRef=true
    // and skips, so onChange is called exactly once total (not twice).
    await user.keyboard("{ArrowDown}{Enter}")

    await waitFor(() => {
      expect(props.onChange).toHaveBeenCalledTimes(1)
      expect(props.onChange).toHaveBeenCalledWith("b")
    })
    expect(screen.getByDisplayValue("b")).toBeVisible()
  })

  it("doesn't filter options based on index", async () => {
    const user = userEvent.setup()
    render(<Selectbox {...props} />)
    const selectbox = screen.getByRole("combobox")
    await openDropdown(user)
    await user.clear(selectbox)
    await user.type(selectbox, "1")
    // None of ["a","b","c"] match "1" by label — no data options visible.
    // The empty-state wrapper has role="option" so we check that none of the
    // actual data options are present, and that the "No results" message shows.
    expect(screen.queryByRole("option", { name: "a" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "b" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "c" })).not.toBeInTheDocument()
    expect(screen.getByText("No results")).toBeInTheDocument()
  })

  it("filters options based on label with case insensitive", async () => {
    const user = userEvent.setup()
    render(<Selectbox {...props} />)
    const selectbox = screen.getByRole("combobox")
    await openDropdown(user)

    await user.clear(selectbox)
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

  it("predictably produces case sensitive matches", async () => {
    const user = userEvent.setup()
    const currProps = getProps({
      options: ["aa", "Aa", "aA"],
      value: undefined,
    })
    render(<Selectbox {...currProps} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "aa")

    await waitFor(() => {
      const options = screen.queryAllByRole("option")
      expect(options).toHaveLength(3)
      expect(options[0]).toHaveTextContent("aa")
      expect(options[1]).toHaveTextContent("Aa")
      expect(options[2]).toHaveTextContent("aA")
    })
  })

  it("filters options using contains mode", async () => {
    const user = userEvent.setup()
    const currProps = getProps({
      options: ["apple", "grape", "banana"],
      filterMode: streamlit.SelectWidgetFilterMode.FILTER_MODE_CONTAINS,
      value: undefined,
    })
    render(<Selectbox {...currProps} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "AP")

    await waitFor(() => {
      const options = screen.queryAllByRole("option")
      expect(options).toHaveLength(2)
      expect(options[0]).toHaveTextContent("apple")
      expect(options[1]).toHaveTextContent("grape")
      expect(
        screen.queryByRole("option", { name: "banana" })
      ).not.toBeInTheDocument()
    })
  })

  it("filters options using prefix mode", async () => {
    const user = userEvent.setup()
    const currProps = getProps({
      options: ["apple", "apricot", "grape"],
      filterMode: streamlit.SelectWidgetFilterMode.FILTER_MODE_PREFIX,
      value: undefined,
    })
    render(<Selectbox {...currProps} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "ap")

    await waitFor(() => {
      const options = screen.queryAllByRole("option")
      expect(options).toHaveLength(2)
      expect(options[0]).toHaveTextContent("apple")
      expect(options[1]).toHaveTextContent("apricot")
      expect(
        screen.queryByRole("option", { name: "grape" })
      ).not.toBeInTheDocument()
    })
  })

  it("keeps all options visible and blocks typing when filterMode is none", async () => {
    const user = userEvent.setup()
    const currProps = getProps({
      options: ["yes", "no", "maybe"],
      filterMode: streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE,
      value: undefined,
    })
    render(<Selectbox {...currProps} />)
    const selectboxInput = screen.getByRole("combobox")

    // filter_mode=None uses inputMode="none" (not readOnly) to suppress the
    // mobile software keyboard. readOnly would break both focus-on-click and
    // React Aria's keyboard navigation, so the input must stay editable-but-focusable.
    expect(selectboxInput).toHaveAttribute("inputmode", "none")
    expect(selectboxInput).not.toHaveAttribute("readonly")

    // Clicking focuses the input and opens the dropdown with the full list.
    await user.click(selectboxInput)
    await waitFor(() => {
      expect(screen.queryAllByRole("option")).toHaveLength(3)
    })

    // Typing is blocked, so no visible text is entered and the list stays
    // unfiltered. Using keyboard() (not type()) avoids an implicit re-click,
    // proving the earlier click is what focused the input.
    await user.keyboard("no")
    expect(selectboxInput).toHaveValue("")
    expect(screen.queryAllByRole("option")).toHaveLength(3)

    // Arrow/Enter navigation works straight after the click with no manual
    // focus() — this catches the click-then-keyboard focus regression. Landing
    // on "no" (the second option) rules out an auto-select-first fallback.
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}")
    expect(currProps.onChange).toHaveBeenCalledWith("no")
  })

  it("blocks paste and IME composition input when filterMode is none", async () => {
    const user = userEvent.setup()
    const currProps = getProps({
      options: ["yes", "no", "maybe"],
      filterMode: streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE,
      value: undefined,
    })
    render(<Selectbox {...currProps} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.click(selectboxInput)
    await waitFor(() => {
      expect(screen.queryAllByRole("option")).toHaveLength(3)
    })

    // Pasting must not enter text or filter the list: onPaste calls
    // preventDefault, so the input value never changes and the full list stays.
    await user.paste("maybe")
    expect(selectboxInput).toHaveValue("")
    expect(screen.queryAllByRole("option")).toHaveLength(3)

    // IME composition: onCompositionStart calls preventDefault as a best-effort
    // block. Real browsers may ignore preventDefault on compositionstart, so we
    // only assert that our handler requests cancellation (not that jsdom reports
    // the event as canceled, which would be a jsdom-only artifact). The value and
    // option list must stay unchanged regardless.
    const compositionEvent = createEvent.compositionStart(selectboxInput, {
      data: "n",
    })
    const preventDefaultSpy = vi.spyOn(compositionEvent, "preventDefault")
    fireEvent(selectboxInput, compositionEvent)
    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(selectboxInput).toHaveValue("")
    expect(screen.queryAllByRole("option")).toHaveLength(3)
  })

  it("updates value if new value provided from parent", () => {
    const { rerender } = render(<Selectbox {...props} />)
    expect(screen.getByDisplayValue(props.options[0])).toBeVisible()

    props = getProps({ value: "b" })
    rerender(<Selectbox {...props} />)
    expect(screen.getByDisplayValue(props.options[1])).toBeVisible()
  })

  it("preserves value after prop change and blur without selection", async () => {
    // Regression test for https://github.com/streamlit/streamlit/issues/13435
    // When value is set programmatically (e.g., via session state) and user
    // opens/closes dropdown without selecting, the new value should be preserved.
    const user = userEvent.setup()
    const { rerender } = render(<Selectbox {...props} />)

    expect(screen.getByDisplayValue(props.options[0])).toBeVisible()

    props = getProps({ value: "b" })
    rerender(<Selectbox {...props} />)
    expect(screen.getByDisplayValue(props.options[1])).toBeVisible()

    await openDropdown(user)

    // Close by clicking outside (blur) without making a selection
    await user.click(document.body)

    await waitFor(() => {
      expect(screen.getByDisplayValue("b")).toBeVisible()
    })
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it("committedValueRef blur regression: selecting then tabbing shows selected value", async () => {
    // Validates that the committedValueRef pattern prevents the input from
    // reverting to the stale propValue when onBlur fires after onSelectionChange.
    const user = userEvent.setup()
    render(<Selectbox {...props} />)

    await openDropdown(user)
    const options = screen.getAllByRole("option")
    await user.click(options[2])

    // Selection is committed synchronously — input shows "c" immediately
    expect(screen.getByDisplayValue("c")).toBeVisible()

    // Click outside to trigger blur — committedValueRef prevents revert to "a"
    await user.click(document.body)

    expect(screen.getByDisplayValue("c")).toBeVisible()
  })

  it("does not commit changes when clicking outside of the selectbox", async () => {
    const user = userEvent.setup()
    render(<Selectbox {...props} />)
    const selectbox = screen.getByRole("combobox")
    await openDropdown(user)
    await user.clear(selectbox)
    await user.type(selectbox, "b")

    await user.click(document.body)

    await waitFor(() => {
      expect(props.onChange).not.toHaveBeenCalled()
      expect(screen.getByDisplayValue(props.options[0])).toBeVisible()
    })
  })

  it("does not call onChange when the user deletes characters", async () => {
    const user = userEvent.setup()
    render(<Selectbox {...props} />)
    const input = screen.getByRole("combobox")
    expect(input).toHaveValue("a")

    await user.click(input)
    await user.keyboard("{Backspace}")

    expect(props.onChange).not.toHaveBeenCalled()
    expect(input).not.toHaveValue("a")
  })

  it("allows new options when acceptNewOptions is true via Enter", async () => {
    const user = userEvent.setup()
    props = getProps({
      acceptNewOptions: true,
      value: undefined,
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")
    await user.type(selectboxInput, "hello world!")
    await user.keyboard("{enter}")
    expect(props.onChange).toHaveBeenCalledTimes(1)
    expect(props.onChange).toHaveBeenCalledWith("hello world!")
    expect(screen.getByDisplayValue("hello world!")).toBeVisible()
  })

  it("allows new options when acceptNewOptions is true via clicking Add option", async () => {
    const user = userEvent.setup()
    props = getProps({
      acceptNewOptions: true,
      value: undefined,
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    // user.click focuses the input AND opens the dropdown (via RAC's press handler).
    // Then fireEvent.change sets the input value without triggering a blur/focus
    // cycle (which would close the dropdown via RAC's shouldCloseOnBlur path).
    await user.click(selectboxInput)
    act(() => {
      // eslint-disable-next-line testing-library/prefer-user-event
      fireEvent.change(selectboxInput, { target: { value: "hello world!" } })
    })

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /Add: hello world!/i })
      ).toBeVisible()
    })
    await user.click(
      screen.getByRole("option", { name: /Add: hello world!/i })
    )

    expect(props.onChange).toHaveBeenCalledTimes(1)
    expect(props.onChange).toHaveBeenCalledWith("hello world!")
  })

  describe("on mobile", () => {
    beforeEach(() => {
      vi.spyOn(MobileUtil, "isMobile").mockReturnValue(true)
    })

    it("allows typing when acceptNewOptions is true even with few options", async () => {
      const user = userEvent.setup()
      props = getProps({
        acceptNewOptions: true,
        options: ["a", "b", "c"],
        value: undefined,
      })
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
      expect(screen.queryByText(/Add:/i)).not.toBeInTheDocument()
    })

    it("uses inputMode=none instead of readonly for filterMode none", () => {
      // On mobile, a small non-creatable selectbox normally gets `readonly` to
      // suppress the software keyboard (see the test above). filter_mode=None
      // must opt out of that via the `!isFilterNone` term and instead rely on
      // inputMode="none", so the input stays focusable for React Aria keyboard
      // navigation while the mobile keyboard is still suppressed. Desktop tests
      // run with isMobile() false, so this is the only place the mobile-gated
      // `!isFilterNone` term is exercised.
      props = getProps({
        acceptNewOptions: false,
        options: ["yes", "no", "maybe"],
        filterMode: streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE,
      })
      render(<Selectbox {...props} />)
      const input = screen.getByRole("combobox")
      expect(input).toHaveAttribute("inputmode", "none")
      expect(input).not.toHaveAttribute("readonly")
    })
  })

  it("does not allow new options when acceptNewOptions is false", async () => {
    const user = userEvent.setup()
    props = getProps({
      acceptNewOptions: false,
      value: undefined,
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")
    await user.type(selectboxInput, "hello world!")
    await user.keyboard("{enter}")
    expect(props.onChange).not.toHaveBeenCalled()
  })
})

describe("Selectbox widget with optional props", () => {
  it("renders no label element if no text provided", () => {
    const props = getProps({ label: undefined })
    render(<Selectbox {...props} />)

    expect(screen.queryByTestId("stWidgetLabel")).not.toBeInTheDocument()
  })

  it("renders TooltipIcon if help text provided", () => {
    const props = getProps({ help: "help text" })
    render(<Selectbox {...props} />)

    expect(screen.getByTestId("stTooltipIcon")).toBeVisible()
  })

  it("allows case sensitive new options to be added", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: ["aa", "Aa", "aA"],
      acceptNewOptions: true,
      value: undefined,
    })
    render(<Selectbox {...props} />)
    const selectboxInput = screen.getByRole("combobox")

    await user.type(selectboxInput, "AA")

    // "AA" is case-sensitively distinct from "aa", "Aa", "aA" → Add option shown
    expect(screen.getByRole("option", { name: /Add: AA/i })).toBeVisible()
  })
})
