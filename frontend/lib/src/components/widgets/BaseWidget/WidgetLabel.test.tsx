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
import { screen } from "@testing-library/react"
import { render } from "@streamlit/lib/src/test_util"
import { LabelVisibilityOptions } from "@streamlit/lib/src/util/utils"

import { WidgetLabel, LabelProps } from "./WidgetLabel"

const getProps = (props?: Partial<LabelProps>): LabelProps => ({
  label: "Label",
  ...props,
})

describe("Widget Label", () => {
  it("renders WidgetLabel as expected", () => {
    const props = getProps()
    render(<WidgetLabel {...props} />)

    expect(screen.getByTestId("stWidgetLabel")).toBeInTheDocument()
  })

  it("renders label text as expected", () => {
    const props = getProps()
    render(<WidgetLabel {...props} />)

    expect(screen.getByTestId("stWidgetLabel")).toBeInTheDocument()
    // Test that isLabel prop is true, which makes font size smaller
    expect(screen.getByText(`${props.label}`)).toHaveStyle(`font-size: 14px`)
  })

  it("can be disabled", () => {
    const props = getProps({ disabled: true })
    render(<WidgetLabel {...props} />)

    expect(screen.getByTestId("stWidgetLabel")).toHaveAttribute("disabled")
  })

  it("can hide label visibility", () => {
    const props = getProps({ labelVisibility: LabelVisibilityOptions.Hidden })
    render(<WidgetLabel {...props} />)

    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })
})
