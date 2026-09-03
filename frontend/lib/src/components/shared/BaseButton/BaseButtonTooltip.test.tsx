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

import { act, cleanup, renderHook, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useFocusVisible } from "react-aria"

import { render } from "~lib/test_util"

import {
  BaseButtonTooltip,
  HELP_TOOLTIP_HOVER_DELAY_MS,
} from "./BaseButtonTooltip"

function renderHelpButton(): void {
  render(
    <BaseButtonTooltip help="Button help" containerWidth={false}>
      <button type="button">Click me</button>
    </BaseButtonTooltip>
  )
}

describe("BaseButtonTooltip", () => {
  it("renders children only when help is omitted", () => {
    render(
      <BaseButtonTooltip containerWidth={false}>
        <button type="button">Click me</button>
      </BaseButtonTooltip>
    )

    expect(screen.getByRole("button", { name: "Click me" })).toBeVisible()
    expect(
      screen.queryByTestId("stTooltipHoverTarget")
    ).not.toBeInTheDocument()
  })

  describe("help tooltip hover delay", () => {
    let user: ReturnType<typeof userEvent.setup>

    beforeAll(() => {
      // See Tooltip.test.tsx for why hover tests need this React Aria setup.
      renderHook(() => useFocusVisible())
    })

    beforeEach(() => {
      vi.useFakeTimers()
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
      user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    })

    afterEach(async () => {
      // Unhover first so React Aria starts its cooldown. Unmounting while
      // warmup is still armed would skip the delay on the next hover.
      const tooltipTarget = screen.queryByTestId("stTooltipHoverTarget")
      if (tooltipTarget) {
        await user.unhover(tooltipTarget)
      }
      act(() => {
        // Expire React Aria's global tooltip cooldown (not
        // HELP_TOOLTIP_HOVER_DELAY_MS) so the next test still honors the
        // open delay.
        vi.advanceTimersByTime(500)
        cleanup()
      })
      vi.useRealTimers()
    })

    it("shows the tooltip only after the hover delay", async () => {
      renderHelpButton()

      const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
      await user.hover(tooltipTarget)
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(HELP_TOOLTIP_HOVER_DELAY_MS - 1)
      })
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByTestId("stTooltipContent")).toHaveTextContent(
        "Button help"
      )
    })

    it("does not show the tooltip if the pointer leaves before the delay", async () => {
      renderHelpButton()

      const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
      await user.hover(tooltipTarget)
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()

      await user.unhover(tooltipTarget)
      act(() => {
        vi.advanceTimersByTime(HELP_TOOLTIP_HOVER_DELAY_MS + 100)
      })
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
    })
  })
})
