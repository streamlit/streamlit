/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ComponentType } from "react"
import { shallow } from "enzyme"
import withCollapsible, { Props, StyledToggle } from "./withCollapsible"

const testComponent: ComponentType = () => <div>test</div>

const getProps = (props: Partial<ReportElementProps> = {}): Props => ({
  label: "hi",
  collapsible: true,
  ...props,
})

describe("withCollapsible HOC", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const WithHoc = withCollapsible(testComponent)
    // @ts-ignore
    const wrapper = shallow(<WithHoc {...props} />)

    expect(wrapper.html()).not.toBeNull()
  })

  it("should render a expanded component", () => {
    const props = getProps()
    const WithHoc = withCollapsible(testComponent)
    // @ts-ignore
    const wrapper = shallow(<WithHoc {...props} />)
    const toggleHeader = wrapper.find(StyledToggle)

    expect(toggleHeader.exists()).toBeTruthy()
    expect(toggleHeader.text()).toEqual("Hide")
  })

  it("should render a collapsed component", () => {
    const props = getProps({
      collapsed: true,
    })
    const WithHoc = withCollapsible(testComponent)
    // @ts-ignore
    const wrapper = shallow(<WithHoc {...props} />)
    const toggleHeader = wrapper.find(StyledToggle)

    expect(toggleHeader.text()).toEqual("Show")
  })
})
