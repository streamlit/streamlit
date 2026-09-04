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

import { screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { render } from "~lib/test_util"
import { lightTheme } from "~lib/theme/themeConfigs"
import { LabelVisibilityOptions } from "~lib/util/utils"

import Radio, { Props } from "./Radio"

const { bodyText, fadedText40 } = lightTheme.emotion.colors

const getProps = (props: Partial<Props> = {}): Props => ({
  disabled: false,
  horizontal: false,
  value: 0,
  onChange: vi.fn(),
  options: ["a", "b", "c"],
  captions: [],
  label: "Label",
  ...props,
})

describe("Radio widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<Radio {...props} />)
    expect(screen.getByRole("radiogroup")).toBeVisible()
    expect(screen.getAllByRole("radio")).toHaveLength(3)
  })

  it("renders without crashing if no label is provided", () => {
    const props = getProps({ label: undefined })
    render(<Radio {...props} />)
    expect(screen.queryByText("Label")).toBeNull()
    expect(screen.getByRole("radiogroup")).toBeVisible()
  })

  it("passes labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Hidden,
    })
    render(<Radio {...props} />)

    const widgetLabel = screen.getByText("Label")
    expect(widgetLabel).toHaveStyle("visibility: hidden")
    expect(widgetLabel).not.toBeVisible()
  })

  it("passes labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Collapsed,
    })
    render(<Radio {...props} />)
    expect(screen.getByText("Label")).not.toBeVisible()
  })

  it("has correct className", () => {
    const props = getProps()
    render(<Radio {...props} />)
    expect(screen.getByTestId("stRadio")).toHaveClass("stRadio")
  })

  it("renders a label", () => {
    const props = getProps()
    render(<Radio {...props} />)
    expect(screen.queryByText(`${props.label}`)).toBeInTheDocument()
  })

  it("has a default value", () => {
    const props = getProps()
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")
    expect(radioOptions).toHaveLength(3)

    // @ts-expect-error
    const checked = radioOptions[props.value]
    expect(checked).toBeChecked()
    // Remaining options must not be checked
    expect(radioOptions[1]).not.toBeChecked()
    expect(radioOptions[2]).not.toBeChecked()
  })

  it("can be disabled", () => {
    const props = getProps({ disabled: true })
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")

    radioOptions.forEach(option => {
      expect(option).toBeDisabled()
    })
  })

  it("has the correct options", () => {
    const props = getProps()
    render(<Radio {...props} />)

    props.options.forEach(option => {
      expect(screen.getByText(option)).toBeInTheDocument()
    })
  })

  it("doesn't render captions when there are none", () => {
    const props = getProps()
    render(<Radio {...props} />)

    expect(screen.queryAllByTestId("stCaptionContainer")).toHaveLength(0)
  })

  it.each([true, false])(
    "describes only the captioned options when some are skipped, horizontal=%s",
    horizontal => {
      const props = getProps({
        horizontal,
        options: ["o1", "o2", "o3", "o4"],
        captions: ["c1", "c2", "", "c4"],
      })
      render(<Radio {...props} />)
      const radioOptions = screen.getAllByRole("radio")

      expect(screen.getAllByTestId("stRadioCaption")).toHaveLength(3)
      expect(radioOptions[0]).toHaveAccessibleDescription("c1")
      expect(radioOptions[2]).not.toHaveAccessibleDescription()
      expect(radioOptions[3]).toHaveAccessibleDescription("c4")

      // Only the horizontal layout reserves the skipped option's caption line.
      expect(screen.queryAllByTestId("stRadioCaptionSpacer")).toHaveLength(
        horizontal ? 1 : 0
      )
    }
  )

  it("skips blank captions", () => {
    const props = getProps({ captions: ["caption1", "", "caption2"] })
    render(<Radio {...props} />)

    // Counts the caption element, not StreamlitMarkdown's container: a spacer
    // renders caption-styled markdown too.
    expect(screen.getAllByTestId("stRadioCaption")).toHaveLength(2)

    expect(screen.getByText("caption1")).toBeVisible()
    expect(screen.getByText("caption2")).toBeVisible()
  })

  it("describes an option with the caption's rendered text, not its markdown", () => {
    const props = getProps({ captions: ["**fast**", "slow", "medium"] })
    render(<Radio {...props} />)

    expect(screen.getAllByRole("radio")[0]).toHaveAccessibleDescription("fast")
  })

  it("leaves captions inert when there are no options", () => {
    const props = getProps({ options: [], captions: ["hi"] })
    render(<Radio {...props} />)

    // The placeholder option is ours, not the user's, so nothing captions it.
    expect(screen.queryAllByTestId("stRadioCaption")).toHaveLength(0)
    expect(screen.getAllByRole("radio")[0]).not.toHaveAccessibleDescription()
  })

  it("keeps a caption out of the option's accessible name", () => {
    const props = getProps({ captions: ["fast", "slow", "medium"] })
    render(<Radio {...props} />)

    expect(screen.getAllByRole("radio")[0]).toHaveAccessibleName("a")
  })

  it("reserves caption space in horizontal groups without describing the option", () => {
    const props = getProps({
      horizontal: true,
      captions: ["Opt in", "", "Opt out"],
    })
    render(<Radio {...props} />)

    // The spacer keeps partially-captioned horizontal rows aligned, so it has
    // to render content — but it must stay out of the accessible tree rather
    // than becoming a blank description.
    const spacer = screen.getByTestId("stRadioCaptionSpacer")
    expect(spacer).toHaveAttribute("aria-hidden", "true")
    expect(screen.getAllByRole("radio")[1]).not.toHaveAccessibleDescription()
  })

  it("ignores captions past the last option when reserving space", () => {
    const props = getProps({
      horizontal: true,
      options: ["a"],
      captions: ["", "unused"],
    })
    render(<Radio {...props} />)

    // "unused" is never rendered, so it must not make the group reserve caption
    // space for a caption that no option shows.
    expect(
      screen.queryByTestId("stRadioCaptionSpacer")
    ).not.toBeInTheDocument()
    expect(screen.queryAllByTestId("stRadioCaption")).toHaveLength(0)
  })

  it("renders neither captions nor spacers when every caption is blank", () => {
    const props = getProps({ horizontal: true, captions: ["", " ", ""] })
    render(<Radio {...props} />)

    // Captioning only some options is supported, but when none of them actually
    // has one there is nothing to reserve space for.
    expect(
      screen.queryByTestId("stRadioCaptionSpacer")
    ).not.toBeInTheDocument()
    expect(screen.queryAllByTestId("stRadioCaption")).toHaveLength(0)
    expect(screen.getAllByRole("radio")[0]).not.toHaveAccessibleDescription()
  })

  it.each([
    { disabled: true, color: fadedText40, cursor: "not-allowed" },
    { disabled: false, color: bodyText, cursor: "pointer" },
  ])(
    "dims option text and caption together and sets the label cursor when disabled=$disabled",
    ({ disabled, color, cursor }) => {
      const props = getProps({
        disabled,
        captions: ["fast", "slow", "medium"],
      })
      render(<Radio {...props} />)

      // The field's data-disabled rule sets the colour that both the option text
      // and the caption inherit; the label keeps its own cursor rule.
      expect(screen.getAllByTestId("stCaptionContainer")[0]).toHaveStyle({
        color,
      })
      // Scoped to the option: the widget label also renders a markdown
      // container, and it gets these colours from StyledWidgetLabel instead.
      expect(
        within(screen.getAllByTestId("stRadioOption")[0]).getByTestId(
          "stMarkdownContainer"
        )
      ).toHaveStyle({ color })
      expect(screen.getAllByTestId("stRadioOption")[0]).toHaveStyle({ cursor })
    }
  )

  it("does not select an option when its caption is clicked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = getProps({
      onChange,
      value: 0,
      captions: ["fast", "slow", "medium"],
    })
    render(<Radio {...props} />)

    // The caption is supplementary text outside the label, not a click target.
    await user.click(screen.getByText("slow"))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getAllByRole("radio")[1]).not.toBeChecked()
    expect(screen.getAllByRole("radio")[0]).toBeChecked()
  })

  it("treats options past the end of captions as having no caption", () => {
    // `st.radio` does not require captions to be as long as options, so an
    // out-of-range read must not describe the option with empty content.
    const props = getProps({ captions: ["only one"] })
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")

    expect(radioOptions[0]).toHaveAccessibleDescription("only one")
    expect(radioOptions[1]).not.toHaveAccessibleDescription()
    expect(radioOptions[2]).not.toHaveAccessibleDescription()
    expect(screen.getAllByTestId("stCaptionContainer")).toHaveLength(1)
  })

  it.each(["", " "])(
    "gives an option no description when its caption is %j",
    blank => {
      const props = getProps({ captions: ["fast", blank, "medium"] })
      render(<Radio {...props} />)
      const radioOptions = screen.getAllByRole("radio")

      // The backend passes whitespace through unchanged, so both spellings of
      // "no caption" must stay out of aria-describedby.
      expect(radioOptions[1]).not.toHaveAccessibleDescription()
      expect(radioOptions[1]).toHaveAccessibleName("b")
      expect(screen.getAllByTestId("stRadioCaption")).toHaveLength(2)
    }
  )

  it("has the correct captions", () => {
    const props = getProps({ captions: ["caption1", "caption2", "caption3"] })
    render(<Radio {...props} />)

    expect(screen.getAllByTestId("stRadioCaption")).toHaveLength(3)

    props.captions.forEach(caption => {
      expect(screen.getByText(caption)).toBeInTheDocument()
    })
  })

  it("shows a message and disables all options when there are no options", () => {
    const props = getProps({ options: [] })
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")
    expect(radioOptions).toHaveLength(1)
    expect(screen.getByText("No options to select.")).toBeInTheDocument()
    // Auto-disabled when options list is empty
    expect(radioOptions[0]).toBeDisabled()
  })

  it("handles value changes", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")

    const secondOption = radioOptions[1]

    await user.click(secondOption)

    expect(secondOption).toBeChecked()
    expect(radioOptions[0]).not.toBeChecked()
  })

  it("calls onChange with the correct index when an option is selected", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = getProps({ onChange, value: 0 })
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")

    await user.click(radioOptions[2])

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it("does not call onChange when the group is disabled", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = getProps({ onChange, disabled: true })
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")

    await user.click(radioOptions[1])

    expect(onChange).not.toHaveBeenCalled()
  })

  it("renders no checked radio when value is null (empty selection)", () => {
    const props = getProps({ value: null })
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")

    radioOptions.forEach(option => {
      expect(option).not.toBeChecked()
    })
  })

  it("puts the stRadioOption test id on each option's label", () => {
    const props = getProps()
    render(<Radio {...props} />)

    const optionItems = screen.getAllByTestId("stRadioOption")
    expect(optionItems).toHaveLength(3)
    // e2e helpers click stRadioOption (app_utils.get_radio_option), so it
    // must stay on the input's <label>, not the Field wrapper.
    const firstRadio = screen.getAllByRole("radio")[0]
    expect(firstRadio.closest("label")).toBe(optionItems[0])
  })

  it("selects an option when its stRadioOption element is clicked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = getProps({ onChange, value: 0 })
    render(<Radio {...props} />)

    const radioOptions = screen.getAllByRole("radio")
    // Other tests click the hidden input; this one clicks the e2e helper target.
    await user.click(screen.getAllByTestId("stRadioOption")[1])

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(1)
    expect(radioOptions[1]).toBeChecked()
    expect(radioOptions[0]).not.toBeChecked()
  })

  it("forwards data-testid to the radio group element", () => {
    const props = getProps()
    render(<Radio {...props} />)

    const radioGroup = screen.getByTestId("stRadioGroup")
    expect(radioGroup).toBeVisible()
    expect(radioGroup).toHaveAttribute("role", "radiogroup")
  })

  it("sets aria-label on the radiogroup matching the widget label", () => {
    const props = getProps({ label: "My Radio" })
    render(<Radio {...props} />)

    expect(screen.getByRole("radiogroup", { name: "My Radio" })).toBeVisible()
  })

  it("radiogroup has no aria-label when label is not provided", () => {
    const props = getProps({ label: undefined })
    render(<Radio {...props} />)

    const group = screen.getByRole("radiogroup")
    expect(group).not.toHaveAttribute("aria-label")
  })

  it("sets data-orientation=vertical for vertical layout", () => {
    const props = getProps({ horizontal: false })
    render(<Radio {...props} />)

    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "data-orientation",
      "vertical"
    )
  })

  it("sets data-orientation=horizontal for horizontal layout", () => {
    const props = getProps({ horizontal: true })
    render(<Radio {...props} />)

    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "data-orientation",
      "horizontal"
    )
  })

  it("ArrowDown moves selection to next option in vertical group", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = getProps({ onChange, value: 0, horizontal: false })
    render(<Radio {...props} />)

    const [first, second] = screen.getAllByRole("radio")
    await user.click(first)
    await user.keyboard("{ArrowDown}")

    expect(second).toBeChecked()
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it("ArrowRight moves selection to next option in horizontal group", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = getProps({ onChange, value: 0, horizontal: true })
    render(<Radio {...props} />)

    const [first, second] = screen.getAllByRole("radio")
    await user.click(first)
    await user.keyboard("{ArrowRight}")

    expect(second).toBeChecked()
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it("ArrowLeft moves selection to previous option in horizontal group", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = getProps({ onChange, value: 1, horizontal: true })
    render(<Radio {...props} />)

    const [first, second] = screen.getAllByRole("radio")
    await user.click(second)
    await user.keyboard("{ArrowLeft}")

    expect(first).toBeChecked()
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it("ArrowUp moves selection to previous option in vertical group", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = getProps({ onChange, value: 1, horizontal: false })
    render(<Radio {...props} />)

    const [first, second] = screen.getAllByRole("radio")
    await user.click(second)
    await user.keyboard("{ArrowUp}")

    expect(first).toBeChecked()
    expect(onChange).toHaveBeenCalledWith(0)
  })
})
