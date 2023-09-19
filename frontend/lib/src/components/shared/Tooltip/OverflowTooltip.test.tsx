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
import { fireEvent, screen } from "@testing-library/react"

import OverflowTooltip from "./OverflowTooltip"
import { Placement } from "./Tooltip"
import { render } from "@streamlit/lib/src/test_util"

describe("Tooltip component", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("should render and match snapshots when it fits onscreen", () => {
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
      </OverflowTooltip>
    )

    const tooltip = screen.getByTestId("tooltipHoverTarget")
    fireEvent.mouseOver(tooltip)

    expect(useRefSpy).toHaveBeenCalledWith(null)
    expect(document.body).toMatchSnapshot()
  })

  it("should render and match snapshots when ellipsized", async () => {
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
      </OverflowTooltip>
    )

    const tooltip = screen.getByTestId("tooltipHoverTarget")
    fireEvent.mouseOver(tooltip)

    const tooltipContent = await screen.findByText("the content")
    expect(tooltipContent).toBeInTheDocument()

    expect(useRefSpy).toHaveBeenCalledWith(null)
    expect(document.body).toMatchSnapshot()
  })
})
