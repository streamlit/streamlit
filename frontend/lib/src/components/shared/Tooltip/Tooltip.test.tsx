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
import { userEvent } from "@testing-library/user-event"
import { BaseProvider, LightTheme } from "baseui"

import { render } from "~lib/test_util"

import Tooltip, { Placement, TooltipProps } from "./Tooltip"

const getProps = (
  propOverrides: Partial<TooltipProps> = {}
): TooltipProps => ({
  placement: Placement.AUTO,
  content: <div>Tooltip content text.</div>,
  children: null,
  ...propOverrides,
})

// Wrap in BaseProvider to avoid warnings
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
const renderTooltip = (props: Partial<TooltipProps> = {}): any => {
  return render(
    <BaseProvider theme={LightTheme}>
      <Tooltip {...getProps(props)} />
    </BaseProvider>
  )
}

describe("Tooltip element", () => {
  it("renders a Tooltip", async () => {
    const user = userEvent.setup()
    renderTooltip()

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toBeInTheDocument()

    // Hover to see tooltip content
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("Tooltip content text.")
  })

  it("renders its children", () => {
    renderTooltip({ children: <div>Child Element</div> })

    expect(screen.getByTestId("stTooltipHoverTarget")).toBeInTheDocument()
    expect(screen.getByText("Child Element")).toBeInTheDocument()
  })

  it("sets the same content", async () => {
    const user = userEvent.setup()
    const content = <span>Help Text</span>
    renderTooltip({ content })

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toBeInTheDocument()

    // Hover to see tooltip content
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("Help Text")
  })

  it("uses error testids/classes when error prop is true", async () => {
    const user = userEvent.setup()
    const content = <span>Error Text</span>
    renderTooltip({ content, error: true })

    const tooltipTarget = screen.getByTestId("stTooltipErrorHoverTarget")
    expect(tooltipTarget).toBeVisible()

    // Hover to see tooltip content
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipErrorContent")
    expect(tooltipContent).toHaveTextContent("Error Text")
  })
})
