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
import { mount } from "src/lib/test_util"
import { BlockNode } from "src/lib/AppNode"
import { Block as BlockProto } from "src/autogen/proto"

import { Tabs as UITabs } from "baseui/tabs-motion"
import Tabs, { Props } from "./Tabs"

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

const getProps = (props?: Partial<Props>): Props =>
  Object({
    widgetsDisabled: false,
    node: makeTabsNode(5),
    isStale: false,
    renderTabContent: jest.fn(),
    ...props,
  })

describe("st.tabs", () => {
  it("renders without crashing", () => {
    const wrapper = mount(<Tabs {...getProps()} />)
    expect(wrapper.find(UITabs).exists()).toBe(true)
    expect(wrapper.find("StyledTab").length).toBe(5)
  })

  it("sets the tab labels correctly", () => {
    const wrapper = mount(<Tabs {...getProps()} />)

    expect(wrapper.find("StyledTab").length).toBe(5)
    wrapper.find("StyledTab").forEach((option, index) => {
      expect(option.text()).toBe(`Tab ${index}`)
    })
  })

  it("can be disabled", () => {
    const wrapper = mount(<Tabs {...getProps({ widgetsDisabled: true })} />)

    wrapper.find("StyledTab").forEach((option, index) => {
      if (index === 0) {
        // the selected tab does not have the disabled prop as true in baseweb
        expect(option.prop("disabled")).toBe(false)
      } else {
        expect(option.prop("disabled")).toBe(true)
      }
    })
  })
})
