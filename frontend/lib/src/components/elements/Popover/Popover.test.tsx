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
import { userEvent } from "@testing-library/user-event"

import { Block as BlockProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import * as UseFloatingOverlay from "~lib/hooks/useFloatingOverlay"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Popover, { clampPopoverSize, PopoverProps } from "./Popover"

const createWidgetMgr = (): WidgetStateManager =>
  new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })

const getProps = (
  elementProps: Partial<BlockProto.Popover> = {},
  props: Partial<PopoverProps> = {}
): PopoverProps => ({
  element: BlockProto.Popover.create({
    label: "label",
    disabled: false,
    help: "",
    ...elementProps,
  }),
  empty: false,
  stretchWidth: false,
  widgetMgr: createWidgetMgr(),
  ...props,
})

describe("Popover container", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(
      <Popover {...props}>
        <div>test</div>
      </Popover>
    )
    const popoverButton = screen.getByTestId("stPopover")
    expect(popoverButton).toBeInTheDocument()
    expect(popoverButton).toHaveClass("stPopover")
  })

  it("renders label on the popover", () => {
    const props = getProps()
    render(
      <Popover {...props}>
        <div>test</div>
      </Popover>
    )

    expect(screen.getByText(props.element.label)).toBeVisible()
  })

  it.each(["primary", "tertiary", "secondary"] as const)(
    "applies the %s button kind when element.type matches",
    type => {
      const props = getProps({ type })
      render(
        <Popover {...props}>
          <div>test</div>
        </Popover>
      )

      expect(screen.getByTestId("stPopoverButton")).toHaveAttribute(
        "kind",
        type
      )
    }
  )

  describe("wrap=false", () => {
    it("keeps the chevron visible and sets the full label as a native title", () => {
      const props = getProps({
        label: "A very long popover label",
        wrap: false,
      })
      render(
        <Popover {...props}>
          <div>test</div>
        </Popover>
      )

      expect(screen.getByTestId("stPopoverButton")).toHaveTextContent(
        "expand_more"
      )
      expect(screen.getByTitle("A very long popover label")).toBeVisible()
    })

    it("does not set a title when help is set (help tooltip takes over)", () => {
      const props = getProps({
        label: "A very long popover label",
        wrap: false,
        help: "Help wins",
      })
      render(
        <Popover {...props}>
          <div>test</div>
        </Popover>
      )

      expect(
        screen.queryByTitle("A very long popover label")
      ).not.toBeInTheDocument()
    })
  })

  it("should render the text when opened", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(
      <Popover {...props}>
        <div>test</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))
    // Text should be visible now
    expect(screen.queryByText("test")).toBeVisible()
  })

  it("closes when clicking outside the popover", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(
      <div>
        <button type="button">outside</button>
        <Popover {...props}>
          <div>test</div>
        </Popover>
      </div>
    )

    await user.click(screen.getByText("label"))
    expect(screen.queryByText("test")).toBeVisible()

    // Wait past the "just opened" guard that ignores the opening click.
    await new Promise(resolve => setTimeout(resolve, 60))

    await user.click(screen.getByText("outside"))
    expect(screen.queryByText("test")).not.toBeInTheDocument()
  })

  it("stays open when interacting with a Streamlit overlay root", async () => {
    // A widget inside the popover (e.g. multiselect) renders its dropdown in a
    // shared overlay host portalled outside the popover body. Clicking it must
    // not dismiss the popover. Regression test for
    // https://github.com/streamlit/streamlit/issues/15959.
    const user = userEvent.setup()
    const props = getProps()

    const overlayHost = document.createElement("div")
    overlayHost.setAttribute("data-st-overlay-root", "true")
    const overlayOption = document.createElement("button")
    overlayOption.textContent = "dropdown option"
    overlayHost.appendChild(overlayOption)
    document.body.appendChild(overlayHost)

    try {
      render(
        <Popover {...props}>
          <div>test</div>
        </Popover>
      )

      await user.click(screen.getByText("label"))
      expect(screen.queryByText("test")).toBeVisible()

      // Wait past the "just opened" guard so this click is treated as a real
      // outside interaction (which would otherwise close the popover).
      await new Promise(resolve => setTimeout(resolve, 60))

      await user.click(screen.getByText("dropdown option"))
      // The popover must remain open after interacting with the overlay root.
      expect(screen.queryByText("test")).toBeVisible()
    } finally {
      document.body.removeChild(overlayHost)
    }
  })

  it("stays open when a close-on-select overlay detaches the clicked node", async () => {
    // Some overlays (date picker calendar, single-select dropdown) close
    // synchronously on selection, detaching the clicked node before the
    // document click handler runs. Capturing the target on pointerdown keeps
    // the popover open. Regression test for
    // https://github.com/streamlit/streamlit/issues/15959.
    const user = userEvent.setup()
    const props = getProps()

    const overlayHost = document.createElement("div")
    overlayHost.setAttribute("data-st-overlay-root", "true")
    const overlayOption = document.createElement("button")
    overlayOption.textContent = "day 15"
    overlayHost.appendChild(overlayOption)
    document.body.appendChild(overlayHost)
    // Simulate the overlay detaching the clicked node on selection.
    overlayOption.addEventListener("click", () => overlayHost.remove())

    try {
      render(
        <Popover {...props}>
          <div>test</div>
        </Popover>
      )

      await user.click(screen.getByText("label"))
      expect(screen.queryByText("test")).toBeVisible()

      await new Promise(resolve => setTimeout(resolve, 60))

      await user.click(screen.getByText("day 15"))
      // pointerdown captured the click as inside an overlay root before the
      // node detached, so the popover stays open.
      expect(screen.queryByText("test")).toBeVisible()
    } finally {
      if (overlayHost.parentNode) {
        document.body.removeChild(overlayHost)
      }
    }
  })

  it("stays open when a keyboard-activated overlay option detaches before click", async () => {
    // Enter/Space on an overlay option can dispatch a `click` with no preceding
    // pointerdown, and a close-on-select overlay may detach the option first —
    // orphaning the click target. Recording the origin on the Enter keydown
    // (capture phase) keeps the popover open. Regression test for
    // https://github.com/streamlit/streamlit/issues/15959.
    const user = userEvent.setup()
    const props = getProps()

    const overlayHost = document.createElement("div")
    overlayHost.setAttribute("data-st-overlay-root", "true")
    const overlayOption = document.createElement("button")
    overlayOption.textContent = "day 15"
    overlayHost.appendChild(overlayOption)
    document.body.appendChild(overlayHost)

    try {
      render(
        <Popover {...props}>
          <div>test</div>
        </Popover>
      )

      await user.click(screen.getByText("label"))
      expect(screen.queryByText("test")).toBeVisible()

      await new Promise(resolve => setTimeout(resolve, 60))

      // Enter keydown inside the overlay records the interaction origin before
      // the overlay detaches the option node...
      overlayOption.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      )
      overlayHost.remove()
      // ...so the follow-up click with an orphaned target does not dismiss.
      document.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      expect(screen.queryByText("test")).toBeVisible()
    } finally {
      if (overlayHost.parentNode) {
        document.body.removeChild(overlayHost)
      }
    }
  })

  it("tags the popover body as an overlay root", async () => {
    // The body is marked data-st-overlay-root so a nested inner popover (whose
    // body is portalled outside the outer popover) doesn't dismiss the outer
    // popover. Regression test for
    // https://github.com/streamlit/streamlit/issues/15959.
    const user = userEvent.setup()
    const props = getProps()
    render(
      <Popover {...props}>
        <div>test</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))
    expect(screen.getByTestId("stPopoverBody")).toHaveAttribute(
      "data-st-overlay-root",
      "true"
    )
  })

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(
      <Popover {...props}>
        <button type="button">inside</button>
      </Popover>
    )

    const trigger = screen.getByTestId("stPopoverButton")
    await user.click(trigger)
    expect(screen.getByText("inside")).toBeVisible()

    await user.click(screen.getByText("inside"))
    await user.keyboard("{Escape}")

    expect(screen.queryByText("inside")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it("does not close on Escape when a nested expanded overlay has focus", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(
      <Popover {...props}>
        <button type="button" aria-expanded="true">
          nested select
        </button>
      </Popover>
    )

    await user.click(screen.getByText("label"))
    expect(screen.getByText("nested select")).toBeVisible()

    screen.getByText("nested select").focus()
    await user.keyboard("{Escape}")

    // Nested overlay should handle Escape first — parent stays open.
    expect(screen.getByText("nested select")).toBeVisible()
    expect(screen.getByTestId("stPopoverButton")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("should render correctly with width=stretch and help", async () => {
    const user = userEvent.setup()
    // Hover to see tooltip content
    render(
      <Popover
        {...getProps({ help: "mockHelpText" }, { stretchWidth: true })}
      />
    )

    // Ensure both the button and the tooltip target have the correct width
    const popoverButtonWidget = screen.getByRole("button")
    expect(popoverButtonWidget).toHaveStyle("width: 100%")
    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toHaveStyle("width: 100%")

    // Ensure the tooltip content is visible and has the correct text
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("mockHelpText")
  })

  it("should render correctly with help", async () => {
    const user = userEvent.setup()
    // Hover to see tooltip content
    render(<Popover {...getProps({ help: "mockHelpText" })} />)

    // Ensure both the button and the tooltip target have the correct width
    const popoverButtonWidget = screen.getByRole("button")
    // The button should stretch to the container and width will
    // be set on the Element Container.
    expect(popoverButtonWidget).toHaveStyle("width: 100%")
    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toHaveStyle("width: 100%")

    // Ensure the tooltip content is visible and has the correct text
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("mockHelpText")
  })

  it("passes width=stretch property without help correctly", () => {
    render(<Popover {...getProps({}, { stretchWidth: true })} />)

    const popoverButtonWidget = screen.getByRole("button")
    expect(popoverButtonWidget).toHaveStyle("width: 100%")
  })
})

describe("Dynamic popover (widget mode)", () => {
  it("calls widgetMgr.setBoolValue on toggle for widget popovers", async () => {
    const user = userEvent.setup()
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")

    const widgetId = "popover-widget-id"
    const fragmentId = "frag-1"
    const props = getProps({ id: widgetId }, { widgetMgr, fragmentId })

    render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))

    expect(setBoolValueSpy).toHaveBeenCalledWith(widgetId, true, {
      formId: undefined,
      fragmentId,
      fromUser: true,
    })
  })

  it("does NOT call widgetMgr.setBoolValue for non-widget popovers", async () => {
    const user = userEvent.setup()
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")

    const props = getProps({}, { widgetMgr })

    render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))

    expect(setBoolValueSpy).not.toHaveBeenCalled()
  })

  it("sends false when closing a widget popover", async () => {
    const user = userEvent.setup()
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")

    const widgetId = "popover-widget-id"
    const fragmentId = "frag-1"
    const props = getProps({ id: widgetId }, { widgetMgr, fragmentId })

    render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))
    expect(setBoolValueSpy).toHaveBeenLastCalledWith(widgetId, true, {
      formId: undefined,
      fragmentId,
      fromUser: true,
    })

    await user.click(screen.getByText("label"))
    expect(setBoolValueSpy).toHaveBeenLastCalledWith(widgetId, false, {
      formId: undefined,
      fragmentId,
      fromUser: true,
    })
  })

  it.each([
    {
      name: "Escape",
      dismiss: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.keyboard("{Escape}")
      },
      wrapOutside: false,
    },
    {
      name: "clicking outside",
      dismiss: async (user: ReturnType<typeof userEvent.setup>) => {
        // Wait past the "just opened" guard that ignores the opening click.
        await new Promise(resolve => setTimeout(resolve, 60))
        await user.click(screen.getByText("outside"))
      },
      wrapOutside: true,
    },
  ])(
    "sends false when $name closes a widget popover",
    async ({ dismiss, wrapOutside }) => {
      const user = userEvent.setup()
      const widgetMgr = createWidgetMgr()
      const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")

      const widgetId = "popover-widget-id"
      const fragmentId = "frag-1"
      const props = getProps({ id: widgetId }, { widgetMgr, fragmentId })
      const popover = (
        <Popover {...props}>
          <div>content</div>
        </Popover>
      )

      render(
        wrapOutside ? (
          <div>
            <button type="button">outside</button>
            {popover}
          </div>
        ) : (
          popover
        )
      )

      await user.click(screen.getByText("label"))
      expect(screen.getByText("content")).toBeVisible()

      await dismiss(user)

      expect(screen.queryByText("content")).not.toBeInTheDocument()
      expect(setBoolValueSpy).toHaveBeenLastCalledWith(widgetId, false, {
        formId: undefined,
        fragmentId,
        fromUser: true,
      })
    }
  )

  it("does NOT sync element.open for non-widget popovers", () => {
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")

    const props = getProps({ open: false }, { widgetMgr })

    const { rerender } = render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("aria-expanded", "false")

    const updatedProps = getProps({ open: true }, { widgetMgr })

    rerender(
      <Popover {...updatedProps}>
        <div>content</div>
      </Popover>
    )

    expect(button).toHaveAttribute("aria-expanded", "false")
    expect(setBoolValueSpy).not.toHaveBeenCalled()
  })

  it("syncs open state when element.open changes programmatically", () => {
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")

    const widgetId = "popover-widget-id"
    const fragmentId = "frag-1"
    const props = getProps(
      { open: false, id: widgetId },
      { widgetMgr, fragmentId }
    )

    const { rerender } = render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("aria-expanded", "false")

    const updatedProps = getProps(
      { open: true, id: widgetId },
      { widgetMgr, fragmentId }
    )

    rerender(
      <Popover {...updatedProps}>
        <div>content</div>
      </Popover>
    )

    expect(button).toHaveAttribute("aria-expanded", "true")
    // The widget manager state should also be updated (with fromUser: false
    // to avoid triggering a rerun) so that subsequent reruns send the
    // correct value back to the backend.
    expect(setBoolValueSpy).toHaveBeenCalledWith(widgetId, true, {
      formId: undefined,
      fragmentId,
      fromUser: false,
    })
  })

  it("syncs widget manager state on programmatic close to prevent stale reopens", () => {
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")

    const widgetId = "popover-widget-id"
    const fragmentId = "frag-1"

    // Start with the popover open (simulating it was opened by the user)
    const props = getProps(
      { open: true, id: widgetId },
      { widgetMgr, fragmentId }
    )

    const { rerender } = render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    const button = screen.getByTestId("stPopoverButton")
    expect(button).toHaveAttribute("aria-expanded", "true")

    // Backend programmatically closes the popover (e.g. st.session_state.key = False)
    const closedProps = getProps(
      { open: false, id: widgetId },
      { widgetMgr, fragmentId }
    )

    rerender(
      <Popover {...closedProps}>
        <div>content</div>
      </Popover>
    )

    expect(button).toHaveAttribute("aria-expanded", "false")
    // The widget manager must be updated with false so that the next rerun
    // (triggered by e.g. another popover) does not send stale "true" back.
    expect(setBoolValueSpy).toHaveBeenCalledWith(widgetId, false, {
      formId: undefined,
      fragmentId,
      fromUser: false,
    })
  })
})

describe("passive state persistence", () => {
  it("restores open state from elementStates on mount", () => {
    const blockId = "$$ID-abc123-my_popover"
    const widgetMgr = createWidgetMgr()

    widgetMgr.setElementState(blockId, "open", true)

    const props = getProps({}, { widgetMgr, blockId })

    render(
      <Popover {...props}>
        <div>popover content</div>
      </Popover>
    )

    // Stored state (true) overrides proto default (false)
    expect(screen.getByTestId("stPopoverButton")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("uses proto default when no stored state exists", () => {
    const blockId = "$$ID-abc123-my_popover"
    const widgetMgr = createWidgetMgr()

    const props = getProps({}, { widgetMgr, blockId })

    render(
      <Popover {...props}>
        <div>popover content</div>
      </Popover>
    )

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "false"
    )
  })

  it("persists open state on toggle", async () => {
    const user = userEvent.setup()
    const blockId = "$$ID-abc123-my_popover"
    const widgetMgr = createWidgetMgr()

    const props = getProps({}, { widgetMgr, blockId })

    render(
      <Popover {...props}>
        <div>popover content</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))

    expect(widgetMgr.getElementState(blockId, "open")).toBe(true)
  })

  it("persists closed state when Escape closes a passively keyed popover", async () => {
    const user = userEvent.setup()
    const blockId = "$$ID-abc123-my_popover"
    const widgetMgr = createWidgetMgr()

    const props = getProps({}, { widgetMgr, blockId })

    render(
      <Popover {...props}>
        <div>popover content</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))
    expect(widgetMgr.getElementState(blockId, "open")).toBe(true)

    await user.keyboard("{Escape}")

    expect(screen.queryByText("popover content")).not.toBeInTheDocument()
    expect(widgetMgr.getElementState(blockId, "open")).toBe(false)
  })

  it("does NOT persist state when no blockId is set", async () => {
    const user = userEvent.setup()
    const widgetMgr = createWidgetMgr()

    const props = getProps({}, { widgetMgr })

    render(
      <Popover {...props}>
        <div>popover content</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))

    // No blockId → toggled state (true) should NOT have been stored
    expect(widgetMgr.getElementState("", "open")).not.toBe(true)
  })

  it("does NOT persist state for widget-mode popovers", async () => {
    const user = userEvent.setup()
    const blockId = "$$ID-abc123-my_popover"
    const widgetMgr = createWidgetMgr()

    const props = getProps({ id: "widget-123" }, { widgetMgr, blockId })

    render(
      <Popover {...props}>
        <div>popover content</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))

    // Widget mode: persistence should not write open state
    expect(widgetMgr.getElementState(blockId, "open")).toBeUndefined()
  })

  it("uses server state even when elementStates has a stale value (widget mode)", () => {
    const blockId = "$$ID-abc123-my_popover"
    const widgetMgr = createWidgetMgr()

    // Pre-populate elementStates with stale "open = true"
    widgetMgr.setElementState(blockId, "open", true)

    // Widget mode (element.id set → on_change="rerun"): server says closed
    const props = getProps(
      { open: false, id: "widget-123" },
      { widgetMgr, blockId }
    )

    render(
      <Popover {...props}>
        <div>popover content</div>
      </Popover>
    )

    // Server value should win — popover should be closed
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "false"
    )
  })
})

describe("Popover chevron visibility", () => {
  it.each([
    ":material/menu:",
    ":material/more_vert:",
    ":material/more_horiz:",
  ])("hides chevron when label is menu-style icon %s", async label => {
    const user = userEvent.setup()
    const props = getProps({ label })
    render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    const button = screen.getByTestId("stPopoverButton")

    // Chevron should not be present when closed
    expect(button).not.toHaveTextContent("expand_more")

    // Open popover and check chevron is still not shown
    await user.click(button)
    expect(button).not.toHaveTextContent("expand_less")
  })

  it("shows chevron for regular labels", () => {
    const props = getProps({ label: "Actions" })
    render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    const button = screen.getByTestId("stPopoverButton")
    expect(button).toHaveTextContent("expand_more")
  })

  it("shows chevron when label is menu icon but icon prop is also set", () => {
    const props = getProps({
      label: ":material/menu:",
      icon: ":material/edit:",
    })
    render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    const button = screen.getByTestId("stPopoverButton")
    expect(button).toHaveTextContent("expand_more")
  })
})

describe("clampPopoverSize", () => {
  // The e2e test covers user-visible overflow; these lock the arithmetic.
  const designMaxWidthPx = 704
  const cssMinWidthPx = 320

  it("clamps max-width to the available space when space is the tighter bound", () => {
    const { maxWidth } = clampPopoverSize({
      availableWidth: 500,
      availableHeight: 800,
      designMaxWidthPx,
      cssMinWidthPx,
    })

    expect(maxWidth).toBe("500px")
  })

  it("caps max-width at the design width on wide viewports", () => {
    const { maxWidth } = clampPopoverSize({
      availableWidth: 5000,
      availableHeight: 800,
      designMaxWidthPx,
      cssMinWidthPx,
    })

    expect(maxWidth).toBe("704px")
  })

  it("keeps the 70vh ceiling alongside the available-height clamp", () => {
    const { maxHeight } = clampPopoverSize({
      availableWidth: 500,
      availableHeight: 640.7,
      designMaxWidthPx,
      cssMinWidthPx,
    })

    expect(maxHeight).toBe("min(640px, 70vh)")
  })

  it("lowers min-width when CSS would otherwise overflow the clamp", () => {
    const { minWidth } = clampPopoverSize({
      availableWidth: 300,
      availableHeight: 800,
      designMaxWidthPx,
      cssMinWidthPx,
    })

    expect(minWidth).toBe("300px")
  })

  it("leaves min-width alone when CSS already fits", () => {
    const { minWidth } = clampPopoverSize({
      availableWidth: 500,
      availableHeight: 800,
      designMaxWidthPx,
      cssMinWidthPx,
    })

    expect(minWidth).toBe("")
  })

  it("lowers a stretch min-width that sits between the design cap and the viewport", () => {
    // The case the applied-max comparison exists for: available space exceeds
    // the design cap, and the stretch min-width falls in between.
    const { maxWidth, minWidth } = clampPopoverSize({
      availableWidth: 900,
      availableHeight: 800,
      designMaxWidthPx,
      cssMinWidthPx: 800,
    })

    expect(maxWidth).toBe("704px")
    expect(minWidth).toBe("704px")
  })

  it("floors fractional space and never goes negative", () => {
    const { maxWidth, maxHeight } = clampPopoverSize({
      availableWidth: 499.9,
      availableHeight: -20,
      designMaxWidthPx,
      cssMinWidthPx,
    })

    expect(maxWidth).toBe("499px")
    expect(maxHeight).toBe("min(0px, 70vh)")
  })
})

describe("Popover floating overlay options", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("configures flip/shift boundaries inside the sidebar", () => {
    const overlaySpy = vi.spyOn(UseFloatingOverlay, "useFloatingOverlay")
    render(
      <IsSidebarContext.Provider value={true}>
        <Popover {...getProps()}>
          <div>content</div>
        </Popover>
      </IsSidebarContext.Provider>
    )

    const options = overlaySpy.mock.calls[0][0]
    expect(options.flipOptions).toEqual({
      boundary: document.documentElement,
    })
    expect(options.shiftOptions).toEqual({
      boundary: document.documentElement,
      padding: UseFloatingOverlay.SHIFT_VIEWPORT_PADDING,
    })
    // Size middleware still applies for narrow embeds.
    expect(options.extraMiddleware).toHaveLength(1)
  })

  it("omits flip/shift boundaries outside the sidebar", () => {
    const overlaySpy = vi.spyOn(UseFloatingOverlay, "useFloatingOverlay")
    render(
      <IsSidebarContext.Provider value={false}>
        <Popover {...getProps()}>
          <div>content</div>
        </Popover>
      </IsSidebarContext.Provider>
    )

    const options = overlaySpy.mock.calls[0][0]
    expect(options.flipOptions).toBeUndefined()
    expect(options.shiftOptions).toBeUndefined()
    // Size middleware still applies for narrow embeds.
    expect(options.extraMiddleware).toHaveLength(1)
  })
})
