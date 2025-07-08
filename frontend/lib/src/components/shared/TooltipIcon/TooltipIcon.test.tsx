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
import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"

import TooltipIcon from "./TooltipIcon"

describe("TooltipIcon element", () => {
  it("renders a TooltipIcon", () => {
    render(
      <ThemeProvider
        theme={mockTheme.emotion}
        baseuiTheme={mockTheme.basewebTheme}
      >
        <TooltipIcon content="" />
      </ThemeProvider>
    )
    const tooltipIcon = screen.getByTestId("stTooltipIcon")
    expect(tooltipIcon).toBeInTheDocument()
  })
})
