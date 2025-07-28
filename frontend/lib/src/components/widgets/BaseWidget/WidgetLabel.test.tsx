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

import { screen } from "@testing-library/react"

import { render } from "~lib/test_util"
import { LabelVisibilityOptions } from "~lib/util/utils"

import { LabelProps, WidgetLabel } from "./WidgetLabel"

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

    // Use the smaller font size for the markdown container
    const markdownContainer = screen.getByTestId("stMarkdownContainer")
    expect(markdownContainer).toHaveStyle("font-size: 0.875rem")
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
