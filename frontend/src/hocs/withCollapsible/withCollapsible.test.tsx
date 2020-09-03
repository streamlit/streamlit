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
import withCollapsible, {
  Props,
  AnimatedComponentWrapper,
} from "./withCollapsible"

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

  it("should render a collapsible component", () => {
    const props = getProps()
    const WithHoc = withCollapsible(testComponent)
    // @ts-ignore
    const wrapper = shallow(<WithHoc {...props} />)
    const toggleHeader = wrapper.find(AnimatedComponentWrapper)

    expect(toggleHeader.exists()).toBeTruthy()
  })

  it("should render a non-collapsible component", () => {
    const props = getProps({
      container: { collapsible: false },
    })
    const WithHoc = withCollapsible(testComponent)

    // @ts-ignore
    const wrapper = shallow(<WithHoc {...props} />)
    const toggleHeader = wrapper.find(AnimatedComponentWrapper)
    expect(toggleHeader.exists()).toBeFalsy()
  })
})
