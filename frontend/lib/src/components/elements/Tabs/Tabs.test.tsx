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

import { Block as BlockProto } from "@streamlit/protobuf"

import { BlockNode } from "~lib/AppNode"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Tabs, { TabProps } from "./Tabs"

vi.mock("~lib/WidgetStateManager")

const FAKE_SCRIPT_HASH = "fake_script_hash"

function makeTab(label: string, children: BlockNode[] = []): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    new BlockProto({ allowEmpty: true, tab: { label } })
  )
}

function makeTabsNode(
  tabs: number,
  options?: { blockId?: string; widgetId?: string }
): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    Array.from({ length: tabs }, (_element, index) => makeTab(`Tab ${index}`)),
    new BlockProto({
      allowEmpty: true,
      id: options?.blockId ?? "",
      tabContainer: {
        id: options?.widgetId ?? undefined,
      },
    })
  )
}

function createWidgetMgr(): WidgetStateManager {
  return new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })
}

const getProps = (props?: Partial<TabProps>): TabProps =>
  Object({
    widgetsDisabled: false,
    node: makeTabsNode(5),
    isStale: false,
    widgetMgr: createWidgetMgr(),
    ...props,
    renderTabContent: vi.fn(),
  })

describe("st.tabs", () => {
  it("renders without crashing", () => {
    render(<Tabs {...getProps()} />)

    const tabsElement = screen.getByTestId("stTabs")
    expect(tabsElement).toBeInTheDocument()
    expect(tabsElement).toHaveClass("stTabs")

    const tabsContainer = screen.getByRole("tablist")
    expect(tabsContainer).toBeInTheDocument()
    const tabs = within(tabsContainer).getAllByRole("tab")
    expect(tabs).toHaveLength(5)
  })

  it("sets the tab labels correctly", () => {
    render(<Tabs {...getProps()} />)
    const tabs = screen.getAllByRole("tab")
    expect(tabs).toHaveLength(5)

    tabs.forEach((tab, index) => {
      expect(tab).toHaveTextContent(`Tab ${index}`)
    })
  })

  it("sets the correct default tab index", () => {
    const node = makeTabsNode(3)
    node.deltaBlock.tabContainer = { defaultTabIndex: 2 }

    render(<Tabs {...getProps({ node })} />)

    const tabs = screen.getAllByRole("tab")
    expect(tabs[2]).toHaveAttribute("aria-selected", "true")
  })

  it("selects the first occurrence when default points to a duplicate label", () => {
    const node = new BlockNode(
      FAKE_SCRIPT_HASH,
      [makeTab("Unique"), makeTab("Dupe"), makeTab("Dupe")],
      new BlockProto({ allowEmpty: true })
    )
    node.deltaBlock.tabContainer = { defaultTabIndex: 1 }

    render(<Tabs {...getProps({ node })} />)

    const tabs = screen.getAllByRole("tab")
    expect(tabs[1]).toHaveAttribute("aria-selected", "true")
  })

  it("doesn't disable tabs when widgets are disabled", () => {
    render(<Tabs {...getProps({ widgetsDisabled: true })} />)
    const tabs = screen.getAllByRole("tab")

    tabs.forEach((_, index) => {
      // the selected tab does not have the disabled prop as true in baseweb
      if (index == 0) {
        return
      }
      expect(tabs[index]).not.toBeDisabled()
    })
  })

  describe("dynamic tabs (widget state tracking)", () => {
    it("calls widgetMgr.setStringValue on tab click for dynamic tabs", async () => {
      const user = userEvent.setup()
      const widgetId = "$$ID-abc123-my_tabs"
      const widgetMgr = createWidgetMgr()

      vi.spyOn(widgetMgr, "setStringValue")

      // widgetId on tabContainer signals dynamic/widget mode
      const node = makeTabsNode(3, { blockId: widgetId, widgetId })
      render(<Tabs {...getProps({ node, widgetMgr })} />)

      const tabs = screen.getAllByRole("tab")
      await user.click(tabs[2])

      expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
        { id: widgetId, formId: "" },
        "Tab 2",
        { fromUi: true },
        undefined
      )
    })

    it("does NOT call widgetMgr.setStringValue on tab click for non-dynamic tabs", async () => {
      const user = userEvent.setup()
      const widgetMgr = createWidgetMgr()

      vi.spyOn(widgetMgr, "setStringValue")

      // No widgetId on tabContainer → not dynamic
      const node = makeTabsNode(3, { blockId: "$$ID-abc123-my_tabs" })
      render(<Tabs {...getProps({ node, widgetMgr })} />)

      const tabs = screen.getAllByRole("tab")
      await user.click(tabs[1])

      expect(tabs[1]).toHaveAttribute("aria-selected", "true")
      expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
    })

    it("syncs tab selection when defaultTabIndex changes programmatically", () => {
      const widgetId = "$$ID-abc123-my_tabs"
      const widgetMgr = createWidgetMgr()

      const node = makeTabsNode(3, { blockId: widgetId, widgetId })
      node.deltaBlock.tabContainer = { defaultTabIndex: 0, id: widgetId }

      const { rerender } = render(<Tabs {...getProps({ node, widgetMgr })} />)

      // Initially first tab is selected
      let tabs = screen.getAllByRole("tab")
      expect(tabs[0]).toHaveAttribute("aria-selected", "true")

      // Simulate backend updating defaultTabIndex to 2
      const updatedNode = makeTabsNode(3, { blockId: widgetId, widgetId })
      updatedNode.deltaBlock.tabContainer = {
        defaultTabIndex: 2,
        id: widgetId,
      }

      rerender(<Tabs {...getProps({ node: updatedNode, widgetMgr })} />)

      tabs = screen.getAllByRole("tab")
      expect(tabs[2]).toHaveAttribute("aria-selected", "true")
      expect(tabs[0]).toHaveAttribute("aria-selected", "false")
    })
  })
})
