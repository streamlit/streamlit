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

import { screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { vi } from "vitest"

import { Block as BlockProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Expander, { ExpanderProps } from "./Expander"

const createWidgetMgr = (): WidgetStateManager =>
  new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })

const getProps = (
  elementProps: Partial<BlockProto.Expandable> = {},
  props: Partial<ExpanderProps> = {}
): ExpanderProps => ({
  element: BlockProto.Expandable.create({
    label: "hi",
    expanded: true,
    type: BlockProto.Expandable.Type.DEFAULT,
    ...elementProps,
  }),
  isStale: false,
  empty: false,
  widgetMgr: createWidgetMgr(),
  ...props,
})

describe("Expander container", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    const expanderContainer = screen.getByTestId("stExpander")
    expect(expanderContainer).toBeInTheDocument()
    expect(expanderContainer).toHaveClass("stExpander")
  })

  it("does not render a list", () => {
    const props = getProps()
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    const list = screen.queryByRole("list")
    expect(list).not.toBeInTheDocument()
  })

  it("renders expander label as expected", () => {
    const props = getProps()
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.getByText(props.element.label)).toBeInTheDocument()
  })

  it("renders expander with a spinner icon", () => {
    const props = getProps({ icon: "spinner", expanded: false })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.getByTestId("stExpanderIconSpinner")).toBeInTheDocument()
  })

  it("renders expander with a check icon", () => {
    const props = getProps({ icon: ":material/check:", expanded: false })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.getByTestId("stExpanderIconCheck")).toBeInTheDocument()
  })

  it("renders expander with a error icon", () => {
    const props = getProps({ icon: ":material/error:", expanded: false })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.getByTestId("stExpanderIconError")).toBeInTheDocument()
  })

  it("renders expander with an emoji icon", () => {
    const props = getProps({ icon: "🚀", expanded: false })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.getByTestId("stExpanderIcon")).toBeInTheDocument()
    expect(screen.getByText("🚀")).toBeInTheDocument()
  })

  it("renders expander with a material icon", () => {
    const props = getProps({ icon: ":material/add_circle:", expanded: false })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.getByTestId("stExpanderIcon")).toBeInTheDocument()
    expect(screen.getByText("add_circle")).toBeInTheDocument()
  })

  it("should render a expanded component", () => {
    const props = getProps()
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.getByText("test")).toBeVisible()
  })

  it("should render a collapsed component", () => {
    const props = getProps({ expanded: false })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.getByText("test")).not.toBeVisible()
  })

  it("should render the text when expanded", async () => {
    const user = userEvent.setup()
    const props = getProps({ expanded: false })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    await user.click(screen.getByText("hi"))
    expect(screen.getByText("test")).toBeVisible()
  })

  it("sets inert attribute on collapsed content", () => {
    const props = getProps({ expanded: false })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    const panel = screen.getByTestId("stExpanderDetails")
    expect(panel).toHaveAttribute("inert")
  })

  it("removes inert attribute on expanded content", () => {
    const props = getProps({ expanded: true })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    const panel = screen.getByTestId("stExpanderDetails")
    expect(panel).not.toHaveAttribute("inert")
  })

  it("toggles inert attribute when expanding", async () => {
    const user = userEvent.setup()
    const props = getProps({ expanded: false })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    const panel = screen.getByTestId("stExpanderDetails")
    expect(panel).toHaveAttribute("inert")

    await user.click(screen.getByText("hi"))
    expect(panel).not.toHaveAttribute("inert")
  })

  it("adds inert attribute when collapsing", async () => {
    const user = userEvent.setup()
    const props = getProps({ expanded: true })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    const panel = screen.getByTestId("stExpanderDetails")
    expect(panel).not.toHaveAttribute("inert")

    await user.click(screen.getByText("hi"))
    expect(panel).toHaveAttribute("inert")
  })
})

describe("widget mode (widgetMgr + element.id)", () => {
  it("calls setBoolValue on toggle", async () => {
    const user = userEvent.setup()
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")
    const props = getProps(
      { expanded: false, id: "expander-123" },
      { widgetMgr, fragmentId: "frag-1" }
    )

    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    await user.click(screen.getByText("hi"))

    expect(setBoolValueSpy).toHaveBeenCalledWith("expander-123", true, {
      formId: undefined,
      fragmentId: "frag-1",
      fromUser: true,
    })
  })

  it("does not call setBoolValue when element.id is not set", async () => {
    const user = userEvent.setup()
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")
    // No element.id — non-widget mode (even though widgetMgr is provided)
    const props = getProps({ expanded: false })

    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    await user.click(screen.getByText("hi"))

    expect(setBoolValueSpy).not.toHaveBeenCalled()
  })

  it("does not enter widget mode when only blockId is set (CSS key styling)", async () => {
    const user = userEvent.setup()
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")
    // blockId set for CSS class but no element.id — should NOT be widget mode
    const props = getProps(
      { expanded: false },
      { widgetMgr, blockId: "$$ID-abc123-my_expander" }
    )

    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    await user.click(screen.getByText("hi"))

    expect(setBoolValueSpy).not.toHaveBeenCalled()
  })

  it("syncs widget manager state on programmatic expand change", () => {
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")

    const widgetId = "expander-123"
    const fragmentId = "frag-1"

    // Start collapsed
    const props = getProps(
      { expanded: false, id: widgetId },
      { widgetMgr, fragmentId }
    )

    const { rerender } = render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    expect(screen.getByText("test")).not.toBeVisible()

    // Backend programmatically expands (e.g. st.session_state.key = True)
    const expandedProps = getProps(
      { expanded: true, id: widgetId },
      { widgetMgr, fragmentId }
    )

    rerender(
      <Expander {...expandedProps}>
        <div>test</div>
      </Expander>
    )

    // The widget manager should be updated with fromUser: false so that
    // subsequent reruns send the correct value back to the backend
    expect(setBoolValueSpy).toHaveBeenCalledWith(widgetId, true, {
      formId: undefined,
      fragmentId,
      fromUser: false,
    })
  })

  it("syncs widget manager state on programmatic collapse to prevent stale reopens", () => {
    const widgetMgr = createWidgetMgr()
    const setBoolValueSpy = vi.spyOn(widgetMgr, "setBoolValue")

    const widgetId = "expander-123"
    const fragmentId = "frag-1"

    // Start expanded
    const props = getProps(
      { expanded: true, id: widgetId },
      { widgetMgr, fragmentId }
    )

    const { rerender } = render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    expect(screen.getByText("test")).toBeVisible()

    // Backend programmatically collapses (e.g. st.session_state.key = False)
    const collapsedProps = getProps(
      { expanded: false, id: widgetId },
      { widgetMgr, fragmentId }
    )

    rerender(
      <Expander {...collapsedProps}>
        <div>test</div>
      </Expander>
    )

    // The widget manager must be updated with false so that the next rerun
    // (triggered by e.g. another widget) does not send stale "true" back
    expect(setBoolValueSpy).toHaveBeenCalledWith(widgetId, false, {
      formId: undefined,
      fragmentId,
      fromUser: false,
    })
  })
})

describe("passive state persistence", () => {
  it("restores expanded state from elementStates on mount", () => {
    const blockId = "$$ID-abc123-my_expander"
    const widgetMgr = createWidgetMgr()

    widgetMgr.setElementState(blockId, "expanded", true)

    const props = getProps({ expanded: false }, { widgetMgr, blockId })

    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    // Stored state (true) overrides proto default (false)
    expect(screen.getByText("test")).toBeVisible()
  })

  it("uses proto default when no stored state exists", () => {
    const blockId = "$$ID-abc123-my_expander"
    const widgetMgr = createWidgetMgr()

    const props = getProps({ expanded: false }, { widgetMgr, blockId })

    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    expect(screen.getByText("test")).not.toBeVisible()
  })

  it("persists expanded state on toggle", async () => {
    const user = userEvent.setup()
    const blockId = "$$ID-abc123-my_expander"
    const widgetMgr = createWidgetMgr()

    const props = getProps({ expanded: false }, { widgetMgr, blockId })

    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    await user.click(screen.getByText("hi"))

    expect(widgetMgr.getElementState(blockId, "expanded")).toBe(true)
  })

  it("does NOT persist state when no blockId is set", async () => {
    const user = userEvent.setup()
    const widgetMgr = createWidgetMgr()

    const props = getProps({ expanded: false }, { widgetMgr })

    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    await user.click(screen.getByText("hi"))

    // No blockId → toggled state (true) should NOT have been stored
    expect(widgetMgr.getElementState("", "expanded")).not.toBe(true)
  })

  it("does NOT persist state for widget-mode expanders", async () => {
    const user = userEvent.setup()
    const blockId = "$$ID-abc123-my_expander"
    const widgetMgr = createWidgetMgr()

    const props = getProps(
      { expanded: false, id: "widget-123" },
      { widgetMgr, blockId }
    )

    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    await user.click(screen.getByText("hi"))

    // Widget mode: persistence should not write expanded state
    // (the hook id is "" so nothing meaningful is stored)
    expect(widgetMgr.getElementState(blockId, "expanded")).toBeUndefined()
  })

  it("uses server state even when elementStates has a stale value (widget mode)", () => {
    const blockId = "$$ID-abc123-my_expander"
    const widgetMgr = createWidgetMgr()

    // Pre-populate elementStates with stale "expanded = true"
    widgetMgr.setElementState(blockId, "expanded", true)

    // Widget mode (element.id set → on_change="rerun"): server says collapsed
    const props = getProps(
      { expanded: false, id: "widget-123" },
      { widgetMgr, blockId }
    )

    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    // Server value should win — content should NOT be visible (collapsed)
    expect(screen.getByText("test")).not.toBeVisible()
  })
})

describe("compact mode (type=COMPACT)", () => {
  it("renders compact expander expanded with content visible", () => {
    const props = getProps({
      expanded: true,
      type: BlockProto.Expandable.Type.COMPACT,
    })
    render(
      <Expander {...props}>
        <div>test content</div>
      </Expander>
    )
    expect(screen.getByText("test content")).toBeVisible()
  })

  it("renders compact expander collapsed with content hidden", () => {
    const props = getProps({
      expanded: false,
      type: BlockProto.Expandable.Type.COMPACT,
    })
    render(
      <Expander {...props}>
        <div>test content</div>
      </Expander>
    )
    expect(screen.getByText("test content")).not.toBeVisible()
  })

  it("expands and collapses compact expander when clicking", async () => {
    const user = userEvent.setup()
    const props = getProps({
      expanded: false,
      type: BlockProto.Expandable.Type.COMPACT,
    })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    // Click to expand
    await user.click(screen.getByText("hi"))
    expect(screen.getByText("test")).toBeVisible()

    // Click to collapse - verify via inert attribute (more reliable than visibility in jsdom)
    await user.click(screen.getByText("hi"))
    const panel = screen.getByTestId("stExpanderDetails")
    expect(panel).toHaveAttribute("inert")
  })

  it("renders compact expander with icon", () => {
    const props = getProps({
      icon: ":material/psychology:",
      type: BlockProto.Expandable.Type.COMPACT,
    })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.getByTestId("stExpanderIcon")).toBeVisible()
    expect(screen.getByText("psychology")).toBeVisible()
  })
})

describe("step mode (type=STEP)", () => {
  const { State, Type } = BlockProto.Expandable

  const getStepProps = (
    elementProps: Partial<BlockProto.Expandable> = {},
    props: Partial<ExpanderProps> = {}
  ): ExpanderProps =>
    getProps({ type: Type.STEP, expanded: false, ...elementProps }, props)

  /** The <summary> disclosure control, or null for a non-collapsible step. */
  const getSummary = (): HTMLElement | null =>
    screen.getByTestId("stExpander").querySelector("summary")

  it("renders a step without the bordered expander chrome", () => {
    render(
      <Expander {...getStepProps()}>
        <div>test</div>
      </Expander>
    )

    const details = screen.getByTestId("stExpander").querySelector("details")
    expect(details).not.toHaveStyle("border-style: solid")
    expect(screen.getByTestId("stExpanderDetails")).toHaveStyle(
      "border-top: none"
    )
  })

  it("keeps the bordered chrome for a default expander", () => {
    render(
      <Expander {...getProps()}>
        <div>test</div>
      </Expander>
    )

    const details = screen.getByTestId("stExpander").querySelector("details")
    expect(details).toHaveStyle("border-style: solid")
    expect(
      screen.queryByTestId("stExpanderStepConnector")
    ).not.toBeInTheDocument()
  })

  it("renders a connector and toggles aria-expanded for a step with content", async () => {
    const user = userEvent.setup()
    render(
      <Expander {...getStepProps()}>
        <div>step content</div>
      </Expander>
    )

    expect(screen.getByTestId("stExpanderStepConnector")).toBeVisible()
    expect(getSummary()).toHaveAttribute("aria-expanded", "false")

    await user.click(screen.getByText("hi"))

    expect(getSummary()).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("step content")).toBeVisible()
  })

  it("does not make a step without content collapsible", async () => {
    const user = userEvent.setup()
    render(
      <Expander {...getStepProps({}, { empty: true })}>
        <div>step content</div>
      </Expander>
    )

    expect(screen.getByText("hi")).toBeVisible()
    expect(
      screen.queryByTestId("stExpanderStepConnector")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stExpanderStepChevron")
    ).not.toBeInTheDocument()
    expect(getSummary()).toBeNull()
    expect(screen.queryByText("step content")).not.toBeInTheDocument()

    await user.click(screen.getByText("hi"))

    expect(getSummary()).toBeNull()
    expect(screen.queryByText("step content")).not.toBeInTheDocument()
  })

  it("stays expanded when its content only arrives on a later render", () => {
    const { rerender } = render(
      <Expander {...getStepProps({ expanded: true }, { empty: true })}>
        <div>late content</div>
      </Expander>
    )

    expect(screen.queryByText("late content")).not.toBeInTheDocument()

    // The step swaps its plain header for a <details> as soon as the first
    // child arrives, which must not reset the expanded state.
    rerender(
      <Expander {...getStepProps({ expanded: true })}>
        <div>late content</div>
      </Expander>
    )

    expect(screen.getByText("late content")).toBeVisible()
  })

  it.each([
    [
      "a complete status shows a filled check",
      { state: State.COMPLETE },
      "check_circle",
    ],
    ["an errored status shows an error icon", { state: State.ERROR }, "error"],
    ["a stateless step shows a neutral placeholder", {}, "circle"],
    [
      "a user icon is used when there is no state",
      { icon: ":material/bolt:" },
      "bolt",
    ],
  ])("%s", (_description, elementProps, expectedIcon) => {
    render(
      <Expander {...getStepProps(elementProps)}>
        <div>test</div>
      </Expander>
    )

    const stepIcon = screen.getByTestId("stExpanderStepIcon")
    expect(within(stepIcon).getByText(expectedIcon)).toBeVisible()
  })

  it.each([
    ["a running status shows a spinner", { state: State.RUNNING }],
    [
      "the state wins over a user icon",
      { icon: ":material/bolt:", state: State.RUNNING },
    ],
  ])("%s", (_description, elementProps) => {
    render(
      <Expander {...getStepProps(elementProps)}>
        <div>test</div>
      </Expander>
    )

    const stepIcon = screen.getByTestId("stExpanderStepIcon")
    expect(within(stepIcon).getByTestId("stSpinnerIcon")).toBeVisible()
    expect(within(stepIcon).queryByText("bolt")).not.toBeInTheDocument()
  })

  it("announces the status state as part of the accessible name", () => {
    render(
      <Expander
        {...getStepProps({ label: "Loading data", state: State.RUNNING })}
      >
        <div>test</div>
      </Expander>
    )

    expect(getSummary()).toHaveAccessibleName("Loading data — running")
  })

  it("announces the status state for a step without content", () => {
    render(
      <Expander
        {...getStepProps(
          { label: "Loading data", state: State.RUNNING },
          { empty: true }
        )}
      >
        <div>test</div>
      </Expander>
    )

    expect(screen.getByTestId("stExpander")).toHaveTextContent(
      "Loading data — running"
    )
  })

  it("omits the state from the accessible name of a stateless step", () => {
    render(
      <Expander {...getStepProps({ label: "Loading data" })}>
        <div>test</div>
      </Expander>
    )

    expect(getSummary()).toHaveAccessibleName("Loading data")
  })

  it("rounds the step header so its focus ring matches the other styles", () => {
    const summaryRadius = (): string => {
      const summary = getSummary()
      if (!summary) {
        throw new Error("expected the expander to render a summary")
      }
      return getComputedStyle(summary).borderRadius
    }

    // Compact is the reference because it rounds uniformly, while the default
    // style rounds only its top corners once expanded.
    const { unmount } = render(
      <Expander {...getProps({ type: Type.COMPACT })}>
        <div>test</div>
      </Expander>
    )
    const compactRadius = summaryRadius()
    unmount()

    render(
      <Expander {...getStepProps()}>
        <div>test</div>
      </Expander>
    )

    expect(summaryRadius()).toBe(compactRadius)
  })

  it("keeps the chevron hidden until the header is hovered or focused", () => {
    render(
      <Expander {...getStepProps()}>
        <div>test</div>
      </Expander>
    )

    // The chevron is always mounted and revealed purely via CSS, so that
    // keyboard focus swaps it in without a re-render. jsdom does not evaluate
    // :hover / :focus-visible, so the reveal itself is covered by the E2E test.
    expect(screen.getByTestId("stExpanderStepChevron")).not.toBeVisible()
    expect(screen.getByTestId("stExpanderStepIcon")).toBeVisible()
  })

  it.each([
    ["default", Type.DEFAULT],
    ["compact", Type.COMPACT],
  ])("leaves the %s style free of step markup", (_description, type) => {
    render(
      <Expander {...getProps({ type, state: State.RUNNING })}>
        <div>test</div>
      </Expander>
    )

    expect(
      screen.queryByTestId("stExpanderStepConnector")
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId("stExpanderStepIcon")).not.toBeInTheDocument()
    expect(getSummary()).not.toHaveAttribute("aria-expanded")
    // Only the step style appends the state to the accessible name.
    expect(screen.queryByText("— running")).not.toBeInTheDocument()
  })
})
