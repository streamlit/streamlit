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
  type RenderResult,
  screen,
} from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { setInteractionModality, useFocusVisible } from "react-aria"

import { FLOATING_OVERLAY_PORTAL_ID } from "~lib/components/core/Portal/constants"
import { render } from "~lib/test_util"

import Tooltip, { Placement, type TooltipProps } from "./Tooltip"

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
// vi.advanceTimersByTime() inside act().  This also keeps Floating UI's
// autoUpdate requestAnimationFrame (which becomes a fake setTimeout) within
// act(), preventing the "not wrapped in act" guard in vitest.setup.ts from
// throwing and crashing the React scheduler.
//
// userEvent is configured with advanceTimers so it properly drives the fake
// timer queue during its own async event scheduling.

describe("Tooltip element", () => {
  beforeAll(() => {
    // eslint-disable-next-line testing-library/no-render-in-lifecycle -- useFocusVisible must run once so React Aria registers the document pointer listener that hover tests depend on.
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
    // FloatingPortal creates this host when PortalProvider is absent. Remove
    // it so a later test can attach its own.
    document.getElementById(FLOATING_OVERLAY_PORTAL_ID)?.remove()
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
    expect(tooltipContent).toBeVisible()

    const tooltip = screen.getByRole("tooltip")
    expect(tooltip).toContainElement(tooltipContent)
    expect(tooltip.style.opacity).toBe("")
    expect(tooltip.style.clipPath).toBe("")
    expect(tooltipTarget).toHaveAttribute("aria-describedby", tooltip.id)
  })

  it("portals an open tooltip into the shared overlay host", async () => {
    document.getElementById(FLOATING_OVERLAY_PORTAL_ID)?.remove()
    const host = document.createElement("div")
    host.id = FLOATING_OVERLAY_PORTAL_ID
    host.setAttribute("data-react-aria-top-layer", "true")
    document.body.appendChild(host)

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip()

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    await user.hover(screen.getByTestId("stTooltipHoverTarget"))
    act(() => {
      vi.advanceTimersByTime(0)
    })

    const tooltip = screen.getByRole("tooltip")
    expect(host.contains(tooltip)).toBe(true)
    expect(tooltip).toBeVisible()
  })

  it("stays open while the pointer is over an interactive tooltip", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip({ closeDelay: 300 })

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(0)
    })

    const tooltipContent = screen.getByTestId("stTooltipContent")
    await user.unhover(tooltipTarget)
    await user.hover(tooltipContent)
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(tooltipContent).toBeVisible()
  })

  it("closes when the pointer moves onto a non-interactive tooltip", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip({ closeDelay: 300, interactive: false })

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(0)
    })

    const tooltipContent = screen.getByTestId("stTooltipContent")
    await user.unhover(tooltipTarget)
    await user.hover(tooltipContent)
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
  })

  it("closes after the pointer leaves the trigger and the tooltip", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip({ closeDelay: 300 })

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(screen.getByTestId("stTooltipContent")).toBeVisible()

    await user.unhover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(screen.getByTestId("stTooltipContent")).toBeVisible()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
  })

  it("renders its children", () => {
    renderTooltip({ children: <div>Child Element</div> })

    expect(screen.getByTestId("stTooltipHoverTarget")).toBeInTheDocument()
    expect(screen.getByText("Child Element")).toBeInTheDocument()
  })

  it("does not constrain trigger width by default", () => {
    renderTooltip()

    const trigger = screen.getByTestId("stTooltipHoverTarget")
    expect(trigger.style.maxWidth).toBe("")
    expect(trigger.style.minWidth).toBe("")
    expect(trigger.style.width).toBe("auto")
  })

  it("constrains trigger width when constrainWidth is set", () => {
    renderTooltip({ constrainWidth: true })

    const trigger = screen.getByTestId("stTooltipHoverTarget")
    expect(trigger.style.maxWidth).toBe("100%")
    expect(trigger.style.minWidth).toBe("0")
    expect(trigger.style.width).toBe("auto")
  })

  it("stretches the trigger when containerWidth is set", () => {
    renderTooltip({ containerWidth: true })

    const trigger = screen.getByTestId("stTooltipHoverTarget")
    expect(trigger.style.width).toBe("100%")
    expect(trigger.style.maxWidth).toBe("")
    expect(trigger.style.minWidth).toBe("")
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
      // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
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

  describe("focus", () => {
    /** Renders a tooltip around a "trigger" button and returns that button. */
    const renderWithTriggerButton = (): HTMLElement => {
      render(
        <>
          <Tooltip {...getProps()}>
            <button type="button">trigger</button>
          </Tooltip>
          <button type="button">other</button>
        </>
      )
      return screen.getByRole("button", { name: "trigger" })
    }

    it("opens on keyboard focus and stays open when the pointer leaves", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const trigger = renderWithTriggerButton()

      await user.tab()
      expect(trigger).toHaveFocus()
      expect(screen.getByTestId("stTooltipContent")).toBeVisible()

      const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
      await user.hover(tooltipTarget)
      await user.unhover(tooltipTarget)
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(screen.getByTestId("stTooltipContent")).toBeVisible()
    })

    it("opens on hover and closes on pointer leave while a mouse click keeps focus on the trigger", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const trigger = renderWithTriggerButton()
      const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")

      await user.click(trigger)
      act(() => {
        vi.advanceTimersByTime(0)
      })
      expect(trigger).toHaveFocus()
      expect(screen.getByTestId("stTooltipContent")).toBeVisible()

      await user.unhover(tooltipTarget)
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(trigger).toHaveFocus()
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()

      await user.hover(tooltipTarget)
      // Advance asynchronously so the reopened tooltip's Floating UI position
      // update, which resolves on a microtask, runs inside act().
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(trigger).toHaveFocus()
      expect(screen.getByTestId("stTooltipContent")).toBeVisible()

      await user.unhover(tooltipTarget)
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
    })

    it.each([
      ["mouse", "[MouseLeft]"],
      ["touch", "[TouchA]"],
    ])(
      "does not open when code moves focus to the trigger after a %s press elsewhere",
      async (_pointerType, keys) => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        const trigger = renderWithTriggerButton()
        const other = screen.getByRole("button", { name: "other" })

        // Mirrors a dialog restoring focus to its trigger after a press on the
        // dialog's close button.
        await user.pointer({ keys, target: other })
        act(() => {
          trigger.focus()
        })
        act(() => {
          vi.advanceTimersByTime(500)
        })

        expect(trigger).toHaveFocus()
        expect(
          screen.queryByTestId("stTooltipContent")
        ).not.toBeInTheDocument()
      }
    )

    it("opens when code moves focus to the trigger after a keyboard interaction", () => {
      const trigger = renderWithTriggerButton()

      // Mirrors a dialog restoring focus to its trigger after Escape.
      act(() => {
        setInteractionModality("keyboard")
        trigger.focus()
      })
      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(trigger).toHaveFocus()
      expect(screen.getByTestId("stTooltipContent")).toBeVisible()
    })

    it("opens on a touch tap and stays open after the touch ends", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const trigger = renderWithTriggerButton()

      await user.pointer({ keys: "[TouchA]", target: trigger })
      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(trigger).toHaveFocus()
      expect(screen.getByTestId("stTooltipContent")).toBeVisible()

      // The pointer of the first tap leaves before it focuses the trigger, so
      // a second tap checks that pointer leave keeps a tapped tooltip open.
      await user.pointer({ keys: "[TouchA]", target: trigger })
      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(screen.getByTestId("stTooltipContent")).toBeVisible()
    })

    it("does not open when code moves focus to the trigger after a tap that did not focus it", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(
        <Tooltip {...getProps()}>
          {/* Like WebKit, which doesn't focus a tapped button. */}
          <button type="button" onMouseDown={e => e.preventDefault()}>
            trigger
          </button>
        </Tooltip>
      )
      const trigger = screen.getByRole("button", { name: "trigger" })

      await user.pointer({ keys: "[TouchA]", target: trigger })
      expect(trigger).not.toHaveFocus()

      // Mirrors a popover or dialog returning focus to the trigger it was
      // opened from.
      act(() => {
        trigger.focus()
      })
      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(trigger).toHaveFocus()
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
    })

    it("does not reopen when code restores focus after tapping an already focused trigger", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const trigger = renderWithTriggerButton()
      const other = screen.getByRole("button", { name: "other" })

      await user.pointer({ keys: "[TouchA]", target: trigger })
      // The second tap records a touch without a focus event, as when
      // reopening a dialog from a trigger that the previous dialog refocused.
      await user.pointer({ keys: "[TouchA]", target: trigger })
      act(() => {
        other.focus()
      })
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()

      act(() => {
        trigger.focus()
      })
      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(trigger).toHaveFocus()
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
    })
  })
})
