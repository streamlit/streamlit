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

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { render } from "~lib/test_util"
import { LabelVisibilityOptions } from "~lib/util/utils"

import Radio, { Props } from "./Radio"

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

  it("renders non-blank captions", () => {
    const props = getProps({ captions: ["caption1", "", "caption2"] })
    render(<Radio {...props} />)

    expect(screen.getAllByTestId("stCaptionContainer")).toHaveLength(3)

    expect(screen.getByText("caption1")).toBeInTheDocument()
    expect(screen.getByText("caption2")).toBeInTheDocument()
  })

  it("has the correct captions", () => {
    const props = getProps({ captions: ["caption1", "caption2", "caption3"] })
    render(<Radio {...props} />)

    expect(screen.getAllByTestId("stCaptionContainer")).toHaveLength(3)

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

  it("renders each option with data-testid stRadioOption", () => {
    const props = getProps()
    render(<Radio {...props} />)

    const optionItems = screen.getAllByTestId("stRadioOption")
    expect(optionItems).toHaveLength(3)
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
