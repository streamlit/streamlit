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
import { Mocked } from "vitest"

import { Block as BlockProto } from "@streamlit/protobuf"

import { ScriptRunState } from "~lib/ScriptRunState"
import { render, renderWithContexts } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Popover, { PopoverProps } from "./Popover"

const createMockWidgetMgr = (): Mocked<WidgetStateManager> =>
  ({
    setBoolValue: vi.fn(),
  }) as unknown as Mocked<WidgetStateManager>

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
    const widgetMgr = createMockWidgetMgr()

    const widgetId = "popover-widget-id"
    const fragmentId = "frag-1"
    // id on the element signals widget mode
    const props = getProps({ id: widgetId }, { widgetMgr, fragmentId })

    render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))

    expect(widgetMgr.setBoolValue).toHaveBeenCalledWith(
      { id: widgetId },
      true,
      { fromUi: true },
      fragmentId
    )
  })

  it("does NOT call widgetMgr.setBoolValue for non-widget popovers", async () => {
    const user = userEvent.setup()
    const widgetMgr = createMockWidgetMgr()

    // No id → not a widget (even though widgetMgr is available)
    const props = getProps({}, { widgetMgr })

    render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))

    expect(widgetMgr.setBoolValue).not.toHaveBeenCalled()
  })

  it("sends false when closing a widget popover", async () => {
    const user = userEvent.setup()
    const widgetMgr = createMockWidgetMgr()

    const widgetId = "popover-widget-id"
    const fragmentId = "frag-1"
    const props = getProps({ id: widgetId }, { widgetMgr, fragmentId })

    render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    // Open the popover
    await user.click(screen.getByText("label"))
    expect(widgetMgr.setBoolValue).toHaveBeenLastCalledWith(
      { id: widgetId },
      true,
      { fromUi: true },
      fragmentId
    )

    // Close by clicking the button again
    await user.click(screen.getByText("label"))
    expect(widgetMgr.setBoolValue).toHaveBeenLastCalledWith(
      { id: widgetId },
      false,
      { fromUi: true },
      fragmentId
    )
  })

  it("does NOT sync element.open for non-widget popovers", () => {
    const widgetMgr = createMockWidgetMgr()

    // No id — non-widget popover
    const props = getProps({ open: false }, { widgetMgr })

    const { rerender } = render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    const trigger = screen.getByRole("button").closest("[aria-expanded]")
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    // Rerender with open=true but still no id
    const updatedProps = getProps({ open: true }, { widgetMgr })

    rerender(
      <Popover {...updatedProps}>
        <div>content</div>
      </Popover>
    )

    // Should remain closed — non-widget popovers ignore element.open changes
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(widgetMgr.setBoolValue).not.toHaveBeenCalled()
  })

  it("syncs open state when element.open changes programmatically", () => {
    const widgetMgr = createMockWidgetMgr()

    const widgetId = "popover-widget-id"
    const props = getProps({ open: false, id: widgetId }, { widgetMgr })

    const { rerender } = render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    // Initially closed — trigger element should indicate collapsed state
    const trigger = screen.getByRole("button").closest("[aria-expanded]")
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    // Backend sets open=true (programmatic control via session_state)
    const updatedProps = getProps({ open: true, id: widgetId }, { widgetMgr })

    rerender(
      <Popover {...updatedProps}>
        <div>content</div>
      </Popover>
    )

    // Trigger should now indicate expanded state
    expect(trigger).toHaveAttribute("aria-expanded", "true")

    // The sync effect should only update local UI state, not send a value
    // back to the backend (which would cause a feedback loop).
    expect(widgetMgr.setBoolValue).not.toHaveBeenCalled()
  })

  it("does not show skeleton during unrelated script runs after loading completes", async () => {
    const user = userEvent.setup()
    const widgetMgr = createMockWidgetMgr()

    const widgetId = "popover-widget-id"
    const props = getProps({ id: widgetId }, { widgetMgr, empty: true })

    // Start with NOT_RUNNING, scriptRunId = "run-1"
    const { rerenderWithContexts } = renderWithContexts(
      <Popover {...props}>
        <div>content</div>
      </Popover>,
      {
        scriptRunContext: {
          scriptRunState: ScriptRunState.NOT_RUNNING,
          scriptRunId: "run-1",
        },
      }
    )

    // User opens the empty widget popover → skeleton should show
    await user.click(screen.getByText("label"))
    expect(screen.queryByTestId("stPopoverSkeleton")).toBeVisible()

    // Triggered run completes: new scriptRunId, back to NOT_RUNNING
    rerenderWithContexts(
      <Popover {...props}>
        <div>content</div>
      </Popover>,
      {
        scriptRunContext: {
          scriptRunState: ScriptRunState.NOT_RUNNING,
          scriptRunId: "run-2",
        },
      }
    )

    // Skeleton should be gone (run completed, content still empty)
    expect(screen.queryByTestId("stPopoverSkeleton")).not.toBeInTheDocument()

    // An unrelated script run starts (e.g. user interacted with another widget)
    rerenderWithContexts(
      <Popover {...props}>
        <div>content</div>
      </Popover>,
      {
        scriptRunContext: {
          scriptRunState: ScriptRunState.RUNNING,
          scriptRunId: "run-3",
        },
      }
    )

    // Skeleton must NOT reappear — this is an unrelated run
    expect(screen.queryByTestId("stPopoverSkeleton")).not.toBeInTheDocument()
  })
})
