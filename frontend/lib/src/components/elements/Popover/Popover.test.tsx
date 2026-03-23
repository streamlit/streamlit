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

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Popover, { PopoverProps } from "./Popover"

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

    expect(setBoolValueSpy).toHaveBeenCalledWith(
      { id: widgetId },
      true,
      { fromUi: true },
      fragmentId
    )
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
    expect(setBoolValueSpy).toHaveBeenLastCalledWith(
      { id: widgetId },
      true,
      { fromUi: true },
      fragmentId
    )

    await user.click(screen.getByText("label"))
    expect(setBoolValueSpy).toHaveBeenLastCalledWith(
      { id: widgetId },
      false,
      { fromUi: true },
      fragmentId
    )
  })

  it("does NOT sync element.open for non-widget popovers", () => {
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")

    const props = getProps({ open: false }, { widgetMgr })

    const { rerender } = render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    const trigger = screen.getByRole("button").closest("[aria-expanded]")
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    const updatedProps = getProps({ open: true }, { widgetMgr })

    rerender(
      <Popover {...updatedProps}>
        <div>content</div>
      </Popover>
    )

    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(setBoolValueSpy).not.toHaveBeenCalled()
  })

  it("syncs open state when element.open changes programmatically", () => {
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")

    const widgetId = "popover-widget-id"
    const props = getProps({ open: false, id: widgetId }, { widgetMgr })

    const { rerender } = render(
      <Popover {...props}>
        <div>content</div>
      </Popover>
    )

    const trigger = screen.getByRole("button").closest("[aria-expanded]")
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    const updatedProps = getProps({ open: true, id: widgetId }, { widgetMgr })

    rerender(
      <Popover {...updatedProps}>
        <div>content</div>
      </Popover>
    )

    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(setBoolValueSpy).not.toHaveBeenCalled()
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
    const trigger = screen.getByRole("button").closest("[aria-expanded]")
    expect(trigger).toHaveAttribute("aria-expanded", "true")
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

    const trigger = screen.getByRole("button").closest("[aria-expanded]")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
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
    const trigger = screen.getByRole("button").closest("[aria-expanded]")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })
})
