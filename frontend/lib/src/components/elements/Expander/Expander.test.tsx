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
import { vi } from "vitest"

import { Block as BlockProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Expander, { ExpanderProps } from "./Expander"

const getProps = (
  elementProps: Partial<BlockProto.Expandable> = {},
  props: Partial<ExpanderProps> = {}
): ExpanderProps => ({
  element: BlockProto.Expandable.create({
    label: "hi",
    expanded: true,
    ...elementProps,
  }),
  isStale: false,
  ...props,
})

const createWidgetMgr = (): WidgetStateManager =>
  new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
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

    expect(setBoolValueSpy).toHaveBeenCalledWith(
      { id: "expander-123" },
      true,
      { fromUi: true },
      "frag-1"
    )
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

  it("adds CSS class from blockId key", () => {
    const props = getProps({}, { blockId: "$$ID-abc123-my_expander" })

    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    const expander = screen.getByTestId("stExpander")
    expect(expander).toHaveClass("st-key-my_expander")
  })

  it("does not add CSS class when blockId is absent", () => {
    const props = getProps()

    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )

    const expander = screen.getByTestId("stExpander")
    expect(expander.className).not.toContain("st-key-")
  })
})
