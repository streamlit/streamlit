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

import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"

import TooltipIcon, {
  getHelpTooltipAriaLabel,
  InlineTooltipIcon,
} from "./TooltipIcon"

describe("TooltipIcon element", () => {
  it("renders a TooltipIcon", () => {
    render(
      <ThemeProvider
        theme={mockTheme.emotion}
        baseuiTheme={mockTheme.basewebTheme}
      >
        <TooltipIcon content="" ariaLabel="Help" />
      </ThemeProvider>
    )
    const tooltipIcon = screen.getByTestId("stTooltipIcon")
    expect(tooltipIcon).toBeInTheDocument()
  })

  it("InlineTooltipIcon uses a default 'Help' aria-label", () => {
    render(
      <ThemeProvider
        theme={mockTheme.emotion}
        baseuiTheme={mockTheme.basewebTheme}
      >
        <InlineTooltipIcon content="Help text" />
      </ThemeProvider>
    )

    expect(screen.getByRole("button", { name: "Help" })).toBeInTheDocument()
  })

  it("InlineTooltipIcon ariaLabel can be overridden", () => {
    render(
      <ThemeProvider
        theme={mockTheme.emotion}
        baseuiTheme={mockTheme.basewebTheme}
      >
        <InlineTooltipIcon content="Help text" ariaLabel="More information" />
      </ThemeProvider>
    )

    expect(
      screen.getByRole("button", { name: "More information" })
    ).toBeInTheDocument()
  })

  describe("InlineTooltipIcon prop forwarding", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("forwards containerWidth and onMouseEnterDelay to TooltipIcon", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      render(
        <ThemeProvider
          theme={mockTheme.emotion}
          baseuiTheme={mockTheme.basewebTheme}
        >
          <InlineTooltipIcon
            content="Help text"
            containerWidth
            onMouseEnterDelay={500}
          />
        </ThemeProvider>
      )

      // containerWidth -> Tooltip hover target wrapper spans full width.
      expect(screen.getByTestId("stTooltipHoverTarget")).toHaveStyle(
        "width: 100%"
      )

      // onMouseEnterDelay -> tooltip should not show until delay has elapsed.
      await user.hover(screen.getByRole("button", { name: "Help" }))
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(await screen.findByTestId("stTooltipContent")).toHaveTextContent(
        "Help text"
      )
    })
  })

  it("falls back to a default aria-label when ariaLabel is an empty string", async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider
        theme={mockTheme.emotion}
        baseuiTheme={mockTheme.basewebTheme}
      >
        {/* Passing an empty string to validate runtime safety for ariaLabel fallback. */}
        <TooltipIcon content="Help text" ariaLabel="" />
      </ThemeProvider>
    )

    await user.tab()
    expect(screen.getByRole("button", { name: "Help" })).toHaveFocus()
  })

  it("renders a focusable trigger button by default", async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider
        theme={mockTheme.emotion}
        baseuiTheme={mockTheme.basewebTheme}
      >
        <TooltipIcon content="Help text" ariaLabel="Help for widget" />
      </ThemeProvider>
    )

    await user.tab()
    expect(
      screen.getByRole("button", { name: "Help for widget" })
    ).toHaveFocus()
  })

  it("shows tooltip content on keyboard focus and closes on blur", async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider
        theme={mockTheme.emotion}
        baseuiTheme={mockTheme.basewebTheme}
      >
        <TooltipIcon content="Help text" ariaLabel="Help for widget" />
        <button type="button">After</button>
      </ThemeProvider>
    )

    await user.tab()
    expect(
      screen.getByRole("button", { name: "Help for widget" })
    ).toHaveFocus()

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("Help text")

    // Blur by tabbing to the next focusable element.
    await user.tab()
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus()

    await waitFor(() => {
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
    })
  })

  it("closes the tooltip on Escape", async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider
        theme={mockTheme.emotion}
        baseuiTheme={mockTheme.basewebTheme}
      >
        <TooltipIcon content="Help text" ariaLabel="Help for widget" />
      </ThemeProvider>
    )

    await user.tab()
    const trigger = screen.getByRole("button", { name: "Help for widget" })
    expect(trigger).toHaveFocus()
    await screen.findByTestId("stTooltipContent")

    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
    })
    // Closing a tooltip should not steal focus from its trigger.
    expect(trigger).toHaveFocus()
  })

  it("normalizes whitespace in getHelpTooltipAriaLabel", () => {
    expect(getHelpTooltipAriaLabel("  My \n widget\tlabel  ")).toBe(
      "Help for My widget label"
    )
    expect(getHelpTooltipAriaLabel("")).toBe("Help")
    expect(getHelpTooltipAriaLabel(null)).toBe("Help")
  })
})
