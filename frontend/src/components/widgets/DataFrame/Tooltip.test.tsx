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

import { screen } from "@testing-library/react"

import "@testing-library/jest-dom"

import { render } from "src/lib/test_util"

import Tooltip, { TooltipProps } from "./Tooltip"

describe("Dataframe Tooltip", () => {
  const defaultProps: TooltipProps = {
    top: 100,
    left: 100,
    content: "**This is a tooltip.**",
    clearTooltip: jest.fn(),
  }

  test("renders the tooltip with provided content", () => {
    render(<Tooltip {...defaultProps} />)

    const tooltipContent = screen.getByText("This is a tooltip.")
    expect(tooltipContent).toBeInTheDocument()
    // Uses markdown to render the content:
    expect(tooltipContent).toHaveStyle("font-weight: bold")
  })

  test("renders the tooltip at the correct position", () => {
    const customPositionProps: TooltipProps = {
      top: 200,
      left: 300,
      content: "Positioned tooltip.",
      clearTooltip: jest.fn(),
    }

    render(<Tooltip {...customPositionProps} />)

    const tooltipContent = screen.getByText("Positioned tooltip.")
    expect(tooltipContent).toBeInTheDocument()

    const invisibleDiv = document.querySelector(
      ".stTooltipTarget"
    ) as HTMLElement

    if (invisibleDiv) {
      expect(invisibleDiv).toHaveStyle("position: fixed")
      expect(invisibleDiv).toHaveStyle("top: 200px")
      expect(invisibleDiv).toHaveStyle("left: 300px")
    } else {
      fail("Invisible div not found")
    }
  })
})
