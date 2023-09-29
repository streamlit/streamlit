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
import { render } from "@streamlit/lib/src/test_util"
import { screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"

import { LabelVisibilityOptions } from "@streamlit/lib/src/util/utils"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"
import Radio, { Props } from "./Radio"

const getProps = (props: Partial<Props> = {}): Props => ({
  width: 0,
  disabled: false,
  horizontal: false,
  value: 0,
  onChange: () => {},
  options: ["a", "b", "c"],
  captions: [],
  label: "Label",
  theme: mockTheme.emotion,
  ...props,
})

describe("Radio widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<Radio {...props} />)
    const radioGroup = screen.getByRole("radiogroup")
    const radioOptions = screen.getAllByRole("radio")

    expect(radioGroup).toBeInTheDocument()
    expect(radioOptions).toHaveLength(3)
  })

  it("renders without crashing if no label is provided", () => {
    const props = getProps({ label: undefined })
    render(<Radio {...props} />)
    const widgetLabel = screen.queryByText("Label")
    const radioOptions = screen.getByRole("radiogroup")

    expect(widgetLabel).toBeNull()
    expect(radioOptions).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Hidden,
    })
    render(<Radio {...props} />)

    const widgetLabel = screen.getByText("Label")
    expect(widgetLabel).toHaveStyle("visibility: hidden")
    expect(widgetLabel).not.toBeVisible()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Collapsed,
    })
    render(<Radio {...props} />)
    const widgetLabel = screen.getByText("Label")
    expect(widgetLabel).not.toBeVisible()
  })

  it("has correct className and style", () => {
    const props = getProps()
    render(<Radio {...props} />)
    const radioElement = screen.getByTestId("stRadio")

    expect(radioElement).toHaveClass("row-widget")
    expect(radioElement).toHaveClass("stRadio")
    expect(radioElement).toHaveStyle(`width: ${props.width}px`)
  })

  it("renders a label", () => {
    const props = getProps()
    render(<Radio {...props} />)
    const widgetLabel = screen.queryByText(`${props.label}`)

    expect(widgetLabel).toBeInTheDocument()
  })

  it("has a default value", () => {
    const props = getProps()
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")
    expect(radioOptions).toHaveLength(3)

    // @ts-expect-error
    const checked = radioOptions[props.value]
    expect(checked).toBeChecked()
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

  it("shows a message when there are no options to be shown", () => {
    const props = getProps({ options: [] })
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")
    const noOptionLabel = screen.getByText("No options to select.")

    expect(radioOptions).toHaveLength(1)
    expect(noOptionLabel).toBeInTheDocument()
  })

  it("handles value changes", () => {
    const props = getProps()
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")

    const secondOption = radioOptions[1]

    fireEvent.click(secondOption)

    expect(secondOption).toBeChecked()
  })
})
