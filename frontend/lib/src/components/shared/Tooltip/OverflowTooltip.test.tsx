/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import { fireEvent, render, screen } from "@testing-library/react"

import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"
import ThemeProvider from "@streamlit/lib/src/components/core/ThemeProvider"

import OverflowTooltip from "./OverflowTooltip"
import { Placement } from "./Tooltip"

describe("Tooltip component", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("should render when it fits onscreen", () => {
    const useRefSpy = jest.spyOn(React, "useRef").mockReturnValue({
      current: {
        // Pretend the body is greater than its onscreen area.
        offsetWidth: 200,
        scrollWidth: 100,
      },
    })

    jest.spyOn(React, "useEffect").mockImplementation(f => f())

    render(
      <OverflowTooltip
        content="the content"
        placement={Placement.AUTO}
        style={{}}
      >
        the child
      </OverflowTooltip>,
      {
        wrapper: ({ children }) => (
          <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
        ),
      }
    )

    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    fireEvent.mouseOver(tooltip)

    expect(screen.queryByText("the content")).not.toBeInTheDocument()

    expect(useRefSpy).toHaveBeenCalledWith(null)
  })

  it("should render when ellipsized", async () => {
    const useRefSpy = jest.spyOn(React, "useRef").mockReturnValue({
      current: {
        // Pretend the body is smaller than its onscreen area.
        offsetWidth: 100,
        scrollWidth: 200,
      },
    })

    jest.spyOn(React, "useEffect").mockImplementation(f => f())

    render(
      <OverflowTooltip
        content="the content"
        placement={Placement.AUTO}
        style={{}}
      >
        the child
      </OverflowTooltip>,
      {
        wrapper: ({ children }) => (
          <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
        ),
      }
    )

    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    fireEvent.mouseOver(tooltip)

    const tooltipContent = await screen.findByText("the content")
    expect(tooltipContent).toBeInTheDocument()

    expect(useRefSpy).toHaveBeenCalledWith(null)
  })
})
