/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React from "react"
import "@testing-library/jest-dom"

import { screen, within } from "@testing-library/react"
import { render } from "@streamlit/lib/src/test_util"
import { BlockNode } from "@streamlit/lib/src/AppNode"
import { Block as BlockProto } from "@streamlit/lib/src/proto"

import Tabs, { TabProps } from "./Tabs"

function makeTab(label: string, children: BlockNode[] = []): BlockNode {
  return new BlockNode(
    children,
    new BlockProto({ allowEmpty: true, tab: { label } })
  )
}

function makeTabsNode(tabs: number): BlockNode {
  return new BlockNode(
    Array.from({ length: tabs }, (_element, index) => makeTab(`Tab ${index}`)),
    new BlockProto({ allowEmpty: true })
  )
}

const getProps = (props?: Partial<TabProps>): TabProps =>
  Object({
    widgetsDisabled: false,
    node: makeTabsNode(5),
    isStale: false,
    ...props,
    renderTabContent: jest.fn(),
  })

describe("st.tabs", () => {
  it("renders without crashing", () => {
    render(<Tabs {...getProps()} />)

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

  it("can be disabled", () => {
    render(<Tabs {...getProps({ widgetsDisabled: true })} />)
    const tabs = screen.getAllByRole("tab")

    tabs.forEach((_, index) => {
      // the selected tab does not have the disabled prop as true in baseweb
      if (index == 0) {
        return
      }
      expect(tabs[index]).toBeDisabled()
    })
  })
})
