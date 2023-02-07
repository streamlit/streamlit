/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import { fireEvent } from "@testing-library/react"
import { render } from "src/lib/test_util"

import { LabelVisibilityOptions } from "src/lib/utils"
import { lightTheme } from "src/theme"
import Radio, { Props } from "./Radio"

const getProps = (props: Partial<Props> = {}): Props => ({
  width: 0,
  disabled: false,
  horizontal: false,
  value: 0,
  onChange: () => {},
  options: ["a", "b", "c"],
  label: "Label",
  theme: lightTheme.emotion,
  ...props,
})

describe("Radio widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = render(<Radio {...props} />)
    const radioGroup = wrapper.baseElement.querySelectorAll("#RadioGroup")
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup label")

    expect(radioGroup).toHaveLength(1)
    expect(radioOptions).toHaveLength(3)
  })

  it("renders without crashing if no label is provided", () => {
    const props = getProps({ label: undefined })
    const wrapper = render(<Radio {...props} />)
    const radioGroup = wrapper.baseElement.querySelectorAll("#RadioGroup")
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup label")

    expect(radioGroup).toHaveLength(1)
    expect(radioOptions).toHaveLength(3)
  })

  it("pass labelVisibility prop to WidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Hidden,
    })
    const wrapper = render(<Radio {...props} />)

    expect(wrapper.getByText(`${props.label}`)).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Collapsed,
    })
    const wrapper = render(<Radio {...props} />)
    expect(wrapper.getByText(`${props.label}`)).not.toBeVisible()
  })

  it("has correct className and style", () => {
    const props = getProps()
    const wrapper = render(<Radio {...props} />)
    const wrappedDiv = wrapper.baseElement.querySelector(".stRadio")

    expect(wrappedDiv).toHaveClass("row-widget")
    expect(wrappedDiv).toHaveStyle(`width: ${props.width}`)
  })

  it("renders a label", () => {
    const props = getProps()
    const wrapper = render(<Radio {...props} />)
    expect(wrapper.getByText(`${props.label}`)).toBeInTheDocument()
  })

  it("has a default value", () => {
    const props = getProps()
    const wrapper = render(<Radio {...props} />)

    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")
    const defaultOption = radioOptions[props.value]
    expect(defaultOption).toBeChecked()
  })

  it("can be disabled", () => {
    const props = getProps({ disabled: true })
    const wrapper = render(<Radio {...props} />)
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")
    radioOptions.forEach(option => {
      expect(option).toHaveAttribute("disabled")
    })
  })

  // it("can be horizontally aligned", () => {
  // })

  it("has the correct options", () => {
    const props = getProps()
    const wrapper = render(<Radio {...props} />)
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")
    const radioText = wrapper.baseElement.querySelectorAll(
      "#RadioGroup input + div"
    )

    radioOptions.forEach((option, index) => {
      expect(option).toHaveAttribute("value", index.toString())
      expect(radioText[index]).toHaveTextContent(props.options[index])
    })
  })

  it("shows a message when there are no options to be shown", () => {
    const props = getProps({ options: [] })
    const wrapper = render(<Radio {...props} />)
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")
    const radioText = wrapper.baseElement.querySelectorAll(
      "#RadioGroup input + div"
    )

    expect(radioOptions).toHaveLength(1)
    expect(radioText).toHaveLength(1)
    expect(radioText[0]).toHaveTextContent("No options to select.")
  })

  it("handles value changes", () => {
    const props = getProps()
    const wrapper = render(<Radio {...props} />)
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")
    const firstOption = radioOptions[0]
    const secondOption = radioOptions[1]

    // inital state
    expect(firstOption).toBeChecked()
    expect(secondOption).not.toBeChecked()
    fireEvent.click(secondOption)
    // updated state
    expect(firstOption).not.toBeChecked()
    expect(secondOption).toBeChecked()
  })
})
