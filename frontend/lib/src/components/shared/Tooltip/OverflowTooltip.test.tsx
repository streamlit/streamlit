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

import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { WindowDimensionsProvider } from "~lib/components/shared/WindowDimensions/Provider"
import { mockTheme } from "~lib/mocks/mockTheme"

import OverflowTooltip from "./OverflowTooltip"
import { Placement } from "./Tooltip"

const wrapper = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <ThemeProvider theme={mockTheme.emotion}>
    <WindowDimensionsProvider>{children}</WindowDimensionsProvider>
  </ThemeProvider>
)

// See Tooltip.test.tsx for the full explanation of the fake-timers strategy.
describe("Tooltip component", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("should render when it fits onscreen", async () => {
    // offsetWidth >= scrollWidth → no overflow → tooltip stays disabled.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200)
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(100)

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <OverflowTooltip
        content="the content"
        placement={Placement.AUTO}
        style={{}}
      >
        the child
      </OverflowTooltip>,
      { wrapper }
    )

    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltip)
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.queryByText("the content")).not.toBeInTheDocument()
  })

  it("should render when ellipsized", async () => {
    // scrollWidth > offsetWidth → overflow → tooltip enabled and shows content.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100)
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(200)

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <OverflowTooltip
        content="the content"
        placement={Placement.AUTO}
        style={{}}
      >
        the child
      </OverflowTooltip>,
      { wrapper }
    )

    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltip)
    // Advance the TooltipTrigger's default 200 ms open delay.
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByText("the content")).toBeInTheDocument()
  })
})
