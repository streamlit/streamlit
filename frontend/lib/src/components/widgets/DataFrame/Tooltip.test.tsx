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

import { render } from "~lib/test_util"

import Tooltip, { TooltipProps } from "./Tooltip"

describe("Dataframe Tooltip", () => {
  const defaultProps: TooltipProps = {
    top: 100,
    left: 100,
    content: "**This is a tooltip.**",
    clearTooltip: vi.fn(),
  }

  it("renders the tooltip with provided content", () => {
    render(<Tooltip {...defaultProps} />)

    const tooltipContent = screen.getByText("This is a tooltip.")
    expect(tooltipContent).toBeVisible()
    // Uses markdown to render the content:
    expect(tooltipContent).toHaveStyle("font-weight: 600")
  })

  it("renders the tooltip at the correct position", () => {
    const customPositionProps: TooltipProps = {
      top: 200,
      left: 300,
      content: "Positioned tooltip.",
      clearTooltip: vi.fn(),
    }

    render(<Tooltip {...customPositionProps} />)

    expect(screen.getByText("Positioned tooltip.")).toBeVisible()

    const invisibleDiv = screen.getByTestId("stDataFrameTooltipTarget")
    expect(invisibleDiv).toHaveStyle("position: fixed")
    expect(invisibleDiv).toHaveStyle("top: 200px")
    expect(invisibleDiv).toHaveStyle("left: 300px")
  })

  it("calls clearTooltip when Escape is pressed", () => {
    const clearTooltip = vi.fn()
    render(<Tooltip {...defaultProps} clearTooltip={clearTooltip} />)

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    )

    expect(clearTooltip).toHaveBeenCalledTimes(1)
  })

  it("does not call clearTooltip for non-Escape keys", () => {
    const clearTooltip = vi.fn()
    render(<Tooltip {...defaultProps} clearTooltip={clearTooltip} />)

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    )

    expect(clearTooltip).not.toHaveBeenCalled()
  })

  it("calls clearTooltip when a pointer-down occurs outside the tooltip", () => {
    const clearTooltip = vi.fn()
    render(<Tooltip {...defaultProps} clearTooltip={clearTooltip} />)

    // jsdom doesn't implement PointerEvent; MouseEvent works since the
    // listener only checks the event name, not the event type.
    document.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }))

    expect(clearTooltip).toHaveBeenCalledTimes(1)
  })

  it("does not call clearTooltip when a pointer-down occurs inside the tooltip", () => {
    const clearTooltip = vi.fn()
    render(<Tooltip {...defaultProps} clearTooltip={clearTooltip} />)

    const tooltipContent = screen.getByTestId("stDataFrameTooltipContent")
    tooltipContent.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true })
    )

    expect(clearTooltip).not.toHaveBeenCalled()
  })
})
