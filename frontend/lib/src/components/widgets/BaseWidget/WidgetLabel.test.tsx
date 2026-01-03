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

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"
import { LabelVisibilityOptions } from "~lib/util/utils"

import { LabelProps, WidgetLabel } from "./WidgetLabel"
import { WidgetLabelHelpIconInline } from "./WidgetLabelHelpIconInline"

const getProps = (props?: Partial<LabelProps>): LabelProps => ({
  label: "Label",
  ...props,
})

describe("Widget Label", () => {
  it("does not hide help icons from assistive tech", () => {
    render(
      <ThemeProvider
        theme={mockTheme.emotion}
        baseuiTheme={mockTheme.basewebTheme}
      >
        <WidgetLabel label="My widget">
          <WidgetLabelHelpIconInline
            content="help text"
            ariaLabel="Help for My widget"
          />
        </WidgetLabel>
      </ThemeProvider>
    )

    const label = screen.getByTestId("stWidgetLabel")
    expect(label).not.toHaveAttribute("aria-hidden", "true")

    const helpButton = screen.getByRole("button", {
      name: "Help for My widget",
    })
    expect(helpButton.closest('[aria-hidden="true"]')).toBeNull()
  })

  it("does not render nested <label> elements when using inline help wrapper", () => {
    render(
      <ThemeProvider
        theme={mockTheme.emotion}
        baseuiTheme={mockTheme.basewebTheme}
      >
        <WidgetLabel label="My widget">
          <WidgetLabelHelpIconInline
            content="help text"
            ariaLabel="Help for My widget"
          />
        </WidgetLabel>
      </ThemeProvider>
    )

    const outerLabel = screen.getByTestId("stWidgetLabel")
    expect(outerLabel.tagName.toLowerCase()).toBe("label")

    // This used to happen when our inline help wrapper was implemented as a <label>,
    // producing invalid nested labels: <label>...<label>...</label></label>.
    expect(outerLabel.querySelector("label")).toBeNull()
  })

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
