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
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { Block as BlockProto } from "@streamlit/protobuf"

import { BlockNode } from "~lib/AppNode"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Tabs, { TabProps } from "./Tabs"

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

function mockTabListScrollMetrics(
  tablist: HTMLElement,
  metrics: {
    scrollLeft?: number
    scrollWidth?: number
    clientWidth?: number
  }
): void {
  const scrollLeft = metrics.scrollLeft ?? 0
  const scrollWidth = metrics.scrollWidth ?? 1000
  const clientWidth = metrics.clientWidth ?? 200
  Object.defineProperties(tablist, {
    scrollLeft: {
      configurable: true,
      get: () => scrollLeft,
    },
    scrollWidth: {
      configurable: true,
      get: () => scrollWidth,
    },
    clientWidth: {
      configurable: true,
      get: () => clientWidth,
    },
  })
}

describe("st.tabs", () => {
  it("renders without crashing", () => {
    render(<Tabs {...getProps()} />)

    const tabsElement = screen.getByTestId("stTabs")
    expect(tabsElement).toBeVisible()
    expect(tabsElement).toHaveClass("stTabs")

    const tabsContainer = screen.getByRole("tablist")
    expect(tabsContainer).toBeVisible()
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
      if (index === 0) {
        return
      }
      expect(tabs[index]).not.toBeDisabled()
    })
  })

  it("does not show scroll arrows when tabs don't overflow", () => {
    render(<Tabs {...getProps()} />)

    // Scroll arrows should not be visible when there's no overflow
    // (JSDOM doesn't implement actual scrolling, so overflow won't be detected)
    expect(screen.queryByTestId("stTabsScrollLeft")).not.toBeInTheDocument()
    expect(screen.queryByTestId("stTabsScrollRight")).not.toBeInTheDocument()
  })

  describe("CSS key class", () => {
    it("applies st-key-* class when blockId is a valid element id", () => {
      const node = makeTabsNode(3, { blockId: "$$ID-abc123-my_tabs" })
      render(<Tabs {...getProps({ node })} />)

      const tabsElement = screen.getByTestId("stTabs")
      expect(tabsElement).toHaveClass("st-key-my_tabs")
    })

    it("does not apply st-key-* class when blockId is empty", () => {
      const node = makeTabsNode(3)
      render(<Tabs {...getProps({ node })} />)

      const tabsElement = screen.getByTestId("stTabs")
      expect(tabsElement).toHaveClass("stTabs")
      expect(tabsElement.className).not.toContain("st-key-")
    })
  })

  describe("passive state persistence", () => {
    it("restores stored active tab on mount", () => {
      const blockId = "$$ID-abc123-my_tabs"
      const widgetMgr = createWidgetMgr()

      widgetMgr.setElementState(blockId, "activeTabLabel", "Tab 2")

      const node = makeTabsNode(3, { blockId })
      render(<Tabs {...getProps({ node, widgetMgr })} />)

      const tabs = screen.getAllByRole("tab")
      expect(tabs[2]).toHaveAttribute("aria-selected", "true")
    })

    it("falls back to default when stored label is not in tab list", () => {
      const blockId = "$$ID-abc123-my_tabs"
      const widgetMgr = createWidgetMgr()

      widgetMgr.setElementState(blockId, "activeTabLabel", "Nonexistent")

      const node = makeTabsNode(3, { blockId })
      render(<Tabs {...getProps({ node, widgetMgr })} />)

      const tabs = screen.getAllByRole("tab")
      expect(tabs[0]).toHaveAttribute("aria-selected", "true")
    })

    it("persists active tab label on tab click", async () => {
      const user = userEvent.setup()
      const blockId = "$$ID-abc123-my_tabs"
      const widgetMgr = createWidgetMgr()

      const node = makeTabsNode(3, { blockId })
      render(<Tabs {...getProps({ node, widgetMgr })} />)

      const tabs = screen.getAllByRole("tab")
      await user.click(tabs[1])

      expect(widgetMgr.getElementState(blockId, "activeTabLabel")).toBe(
        "Tab 1"
      )
    })

    it("does NOT persist state when no blockId is set", async () => {
      const user = userEvent.setup()
      const widgetMgr = createWidgetMgr()

      const node = makeTabsNode(3)
      render(<Tabs {...getProps({ node, widgetMgr })} />)

      const tabs = screen.getAllByRole("tab")
      await user.click(tabs[1])

      expect(widgetMgr.getElementState("", "activeTabLabel")).toBeUndefined()
    })

    it("does NOT persist state for dynamic (widget) tabs", async () => {
      const user = userEvent.setup()
      const widgetId = "$$ID-abc123-my_tabs"
      const widgetMgr = createWidgetMgr()

      vi.spyOn(widgetMgr, "setStringValue")

      const node = makeTabsNode(3, { blockId: widgetId, widgetId })
      render(<Tabs {...getProps({ node, widgetMgr })} />)

      const tabs = screen.getAllByRole("tab")
      await user.click(tabs[1])

      // Widget mode should use setStringValue, not elementState persistence
      expect(
        widgetMgr.getElementState(widgetId, "activeTabLabel")
      ).toBeUndefined()
      expect(widgetMgr.setStringValue).toHaveBeenCalled()
    })

    it("uses default when no stored state exists", () => {
      const blockId = "$$ID-abc123-my_tabs"
      const widgetMgr = createWidgetMgr()

      const node = makeTabsNode(3, { blockId })
      render(<Tabs {...getProps({ node, widgetMgr })} />)

      const tabs = screen.getAllByRole("tab")
      expect(tabs[0]).toHaveAttribute("aria-selected", "true")
    })

    it("restores persisted tab after rerender with new node reference", async () => {
      const user = userEvent.setup()
      const blockId = "$$ID-abc123-my_tabs"
      const widgetMgr = createWidgetMgr()

      const node = makeTabsNode(3, { blockId })
      const { rerender } = render(<Tabs {...getProps({ node, widgetMgr })} />)

      const tabs = screen.getAllByRole("tab")
      await user.click(tabs[1])
      expect(tabs[1]).toHaveAttribute("aria-selected", "true")

      // Rerender with a new node that has the same labels but a fresh
      // children array reference (simulates a rerun with unchanged tabs).
      const freshNode = makeTabsNode(3, { blockId })
      rerender(<Tabs {...getProps({ node: freshNode, widgetMgr })} />)

      const updatedTabs = screen.getAllByRole("tab")
      expect(updatedTabs[1]).toHaveAttribute("aria-selected", "true")
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

  describe("overflow and scroll controls", () => {
    const OriginalResizeObserver = globalThis.ResizeObserver

    afterEach(() => {
      globalThis.ResizeObserver = OriginalResizeObserver
    })

    it("shows only the right scroll control when the tab strip overflows at the start", async () => {
      render(<Tabs {...getProps()} />)
      const tablist = screen.getByRole("tablist")
      mockTabListScrollMetrics(tablist, {
        scrollLeft: 0,
        scrollWidth: 800,
        clientWidth: 200,
      })
      fireEvent.scroll(tablist)

      await waitFor(() => {
        expect(screen.getByTestId("stTabsScrollRight")).toBeVisible()
      })
      expect(screen.queryByTestId("stTabsScrollLeft")).not.toBeInTheDocument()
    })

    it("shows only the left scroll control when scrolled to the end", async () => {
      render(<Tabs {...getProps()} />)
      const tablist = screen.getByRole("tablist")
      mockTabListScrollMetrics(tablist, {
        scrollLeft: 500,
        scrollWidth: 700,
        clientWidth: 200,
      })
      fireEvent.scroll(tablist)

      await waitFor(() => {
        expect(screen.getByTestId("stTabsScrollLeft")).toBeVisible()
      })
      expect(screen.queryByTestId("stTabsScrollRight")).not.toBeInTheDocument()
    })

    it("invokes scrollBy on the tab list when scroll arrow buttons are clicked", async () => {
      const user = userEvent.setup()
      render(<Tabs {...getProps()} />)
      const tablist = screen.getByRole("tablist")

      mockTabListScrollMetrics(tablist, {
        scrollLeft: 50,
        scrollWidth: 900,
        clientWidth: 200,
      })
      fireEvent.scroll(tablist)

      await waitFor(() => {
        expect(screen.getByTestId("stTabsScrollLeft")).toBeVisible()
        expect(screen.getByTestId("stTabsScrollRight")).toBeVisible()
      })

      const scrollBySpy = vi.fn()
      Object.defineProperty(tablist, "scrollBy", {
        configurable: true,
        value: scrollBySpy,
        writable: true,
      })

      await user.click(screen.getByTestId("stTabsScrollLeft"))
      expect(scrollBySpy).toHaveBeenCalledWith({
        left: -200,
        behavior: "smooth",
      })

      await user.click(screen.getByTestId("stTabsScrollRight"))
      expect(scrollBySpy).toHaveBeenCalledWith({
        left: 200,
        behavior: "smooth",
      })
    })

    it("updates scroll affordances when ResizeObserver fires", async () => {
      let resizeCallback: ResizeObserverCallback | undefined
      globalThis.ResizeObserver = class {
        constructor(cb: ResizeObserverCallback) {
          resizeCallback = cb
        }

        observe = vi.fn()
        disconnect = vi.fn()
        unobserve = vi.fn()
      } as unknown as typeof ResizeObserver

      render(<Tabs {...getProps()} />)
      const tablist = screen.getByRole("tablist")

      expect(resizeCallback).toBeDefined()
      mockTabListScrollMetrics(tablist, {
        scrollLeft: 0,
        scrollWidth: 600,
        clientWidth: 200,
      })
      act(() => {
        resizeCallback?.([], {} as ResizeObserver)
      })

      await waitFor(() => {
        expect(screen.getByTestId("stTabsScrollRight")).toBeVisible()
      })
      expect(screen.queryByTestId("stTabsScrollLeft")).not.toBeInTheDocument()
    })
  })

  describe("tab list reconciliation when labels or counts change", () => {
    it("passively keyed tabs persist fallback label when the tab list is replaced and the selection is invalid", async () => {
      const user = userEvent.setup()
      const blockId = "$$ID-abc123-my_tabs"
      const widgetMgr = createWidgetMgr()
      vi.spyOn(widgetMgr, "setElementState")

      const node = makeTabsNode(3, { blockId })
      const { rerender } = render(<Tabs {...getProps({ node, widgetMgr })} />)

      await user.click(screen.getAllByRole("tab")[2])

      const replacement = new BlockNode(
        FAKE_SCRIPT_HASH,
        [makeTab("Alpha"), makeTab("Beta")],
        new BlockProto({ allowEmpty: true, id: blockId })
      )

      rerender(<Tabs {...getProps({ node: replacement, widgetMgr })} />)

      await waitFor(() => {
        const tabs = screen.getAllByRole("tab")
        expect(tabs[0]).toHaveAttribute("aria-selected", "true")
        expect(tabs[0]).toHaveTextContent("Alpha")
      })
      expect(widgetMgr.getElementState(blockId, "activeTabLabel")).toBe(
        "Alpha"
      )
      expect(widgetMgr.setElementState).toHaveBeenCalledWith(
        blockId,
        "activeTabLabel",
        "Alpha"
      )
    })

    it("does not write element state when the tab list is replaced without a block id", async () => {
      const user = userEvent.setup()
      const widgetMgr = createWidgetMgr()
      vi.spyOn(widgetMgr, "setElementState")

      const node = makeTabsNode(3)
      const { rerender } = render(<Tabs {...getProps({ node, widgetMgr })} />)

      await user.click(screen.getAllByRole("tab")[2])

      const replacement = new BlockNode(
        FAKE_SCRIPT_HASH,
        [makeTab("Alpha"), makeTab("Beta")],
        new BlockProto({ allowEmpty: true })
      )

      rerender(<Tabs {...getProps({ node: replacement, widgetMgr })} />)

      await waitFor(() => {
        expect(screen.getAllByRole("tab")[0]).toHaveAttribute(
          "aria-selected",
          "true"
        )
      })
      expect(widgetMgr.setElementState).not.toHaveBeenCalled()
    })

    it("keeps the same tab label selected when the number of tabs changes and that label still exists", async () => {
      const user = userEvent.setup()
      const widgetMgr = createWidgetMgr()

      const node = new BlockNode(
        FAKE_SCRIPT_HASH,
        [makeTab("A"), makeTab("B"), makeTab("C")],
        new BlockProto({ allowEmpty: true })
      )
      const { rerender } = render(<Tabs {...getProps({ node, widgetMgr })} />)

      await user.click(screen.getAllByRole("tab")[1])

      const longerList = new BlockNode(
        FAKE_SCRIPT_HASH,
        [makeTab("X"), makeTab("B"), makeTab("Y"), makeTab("Z")],
        new BlockProto({ allowEmpty: true })
      )

      rerender(<Tabs {...getProps({ node: longerList, widgetMgr })} />)

      await waitFor(() => {
        const tabs = screen.getAllByRole("tab")
        expect(tabs[1]).toHaveAttribute("aria-selected", "true")
        expect(tabs[1]).toHaveTextContent("B")
      })
      expect(screen.getAllByRole("tab")[0]).toHaveAttribute(
        "aria-selected",
        "false"
      )
    })

    it("falls back to the default tab when the count changes and the prior label is gone", async () => {
      const user = userEvent.setup()
      const blockId = "$$ID-reconcile-tabs"
      const widgetMgr = createWidgetMgr()

      const node = new BlockNode(
        FAKE_SCRIPT_HASH,
        [makeTab("A"), makeTab("B"), makeTab("C")],
        new BlockProto({ allowEmpty: true, id: blockId })
      )
      const { rerender } = render(<Tabs {...getProps({ node, widgetMgr })} />)

      await user.click(screen.getAllByRole("tab")[2])

      const shorterList = new BlockNode(
        FAKE_SCRIPT_HASH,
        [makeTab("Only1"), makeTab("Only2")],
        new BlockProto({ allowEmpty: true, id: blockId })
      )
      shorterList.deltaBlock.tabContainer = { defaultTabIndex: 1 }

      rerender(<Tabs {...getProps({ node: shorterList, widgetMgr })} />)

      await waitFor(() => {
        expect(screen.getAllByRole("tab")[1]).toHaveAttribute(
          "aria-selected",
          "true"
        )
      })
      expect(screen.getAllByRole("tab")[1]).toHaveTextContent("Only2")
      expect(widgetMgr.getElementState(blockId, "activeTabLabel")).toBe(
        "Only2"
      )
      expect(screen.getAllByRole("tab")[0]).toHaveAttribute(
        "aria-selected",
        "false"
      )
    })
  })
})
