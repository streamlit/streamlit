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

import {
  act,
  cleanup,
  renderHook,
  RenderResult,
  screen,
} from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useFocusVisible } from "react-aria"

import { render } from "~lib/test_util"

import Tooltip, { Placement, TooltipProps } from "./Tooltip"

const getProps = (
  propOverrides: Partial<TooltipProps> = {}
): TooltipProps => ({
  placement: Placement.AUTO,
  content: <div>Tooltip content text.</div>,
  children: null,
  onMouseEnterDelay: 0,
  ...propOverrides,
})

const renderTooltip = (props: Partial<TooltipProps> = {}): RenderResult => {
  return render(<Tooltip {...getProps(props)} />)
}

// React Aria's useTooltipTrigger checks getInteractionModality() === 'pointer'
// in onHoverStart.  That module-level variable is only updated when a document-
// level 'pointermove' listener (registered via useFocusVisible / setupGlobal-
// FocusEvents) fires.  We must:
//   1. (beforeAll) Call useFocusVisible once so setupGlobalFocusEvents runs
//      and registers the listener on the document.  The listener persists for
//      the whole test suite run since it's added at the module level.
//   2. (beforeEach) Dispatch a 'pointermove' event so currentModality is set
//      to 'pointer' before each test.
//
// Fake timers: React Aria's TooltipTrigger open-delay is a setTimeout.  With
// vi.useFakeTimers() we control when that timer fires by calling
// vi.advanceTimersByTime() inside act().  This also keeps the
// useOverlayPosition requestAnimationFrame (which becomes a fake setTimeout)
// within act(), preventing the "not wrapped in act" guard in vitest.setup.ts
// from throwing and crashing the React scheduler.
//
// userEvent is configured with advanceTimers so it properly drives the fake
// timer queue during its own async event scheduling.

describe("Tooltip element", () => {
  beforeAll(() => {
    // Register React Aria's global pointermove listener so interaction
    // modality tracking works during hover tests.
    renderHook(() => useFocusVisible())
  })

  beforeEach(() => {
    vi.useFakeTimers()
    // Prime the interaction modality to 'pointer' so React Aria's
    // onHoverStart enables hover-triggered tooltip opening.  JSDOM does not
    // implement PointerEvent so setupGlobalFocusEvents registers 'mousemove'
    // instead of 'pointermove'.  Fire mousemove to trigger that listener.
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
  })

  afterEach(() => {
    // Unmount within act() so Floating UI's autoUpdate disconnect (which
    // calls flushSync internally) runs inside the act boundary.
    act(() => {
      cleanup()
    })
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("renders a Tooltip", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip()

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toBeInTheDocument()

    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(0)
    })

    const tooltipContent = screen.getByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("Tooltip content text.")
  })

  it("renders its children", () => {
    renderTooltip({ children: <div>Child Element</div> })

    expect(screen.getByTestId("stTooltipHoverTarget")).toBeInTheDocument()
    expect(screen.getByText("Child Element")).toBeInTheDocument()
  })

  it("sets the same content", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const content = <span>Help Text</span>
    renderTooltip({ content })

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(0)
    })

    const tooltipContent = screen.getByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("Help Text")
  })

  it("uses error testids/classes when error prop is true", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const content = <span>Error Text</span>
    renderTooltip({ content, error: true })

    const tooltipTarget = screen.getByTestId("stTooltipErrorHoverTarget")
    expect(tooltipTarget).toBeVisible()

    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(0)
    })

    const tooltipContent = screen.getByTestId("stTooltipErrorContent")
    expect(tooltipContent).toHaveTextContent("Error Text")
  })

  it("does not show tooltip when content is empty", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip({ content: null })

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
  })

  it("closes on Escape key", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip()

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")

    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(screen.getByTestId("stTooltipContent")).toBeInTheDocument()

    // Escape should close the tooltip regardless of how it was opened.
    await user.keyboard("{Escape}")
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
  })

  it("does not swallow Escape from other handlers while tooltip is open", async () => {
    const outerKeyDown = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div onKeyDown={outerKeyDown}>
        <Tooltip {...getProps()}>
          <button>trigger</button>
        </Tooltip>
      </div>
    )

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")

    // Open the tooltip via hover
    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(screen.getByTestId("stTooltipContent")).toBeInTheDocument()

    // Focus the button inside and press Escape
    await user.click(screen.getByRole("button", { name: "trigger" }))
    await user.keyboard("{Escape}")

    // The outer handler must still receive the Escape event — this is the
    // core bugfix: React Aria's useTooltipTrigger previously called
    // stopPropagation() on Escape in a capture listener, swallowing it.
    expect(outerKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({ key: "Escape" })
    )
  })
})
