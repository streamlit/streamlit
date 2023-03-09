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

import React, { ComponentType } from "react"
import { mount } from "src/lib/test_util"

import FullScreenWrapper from "src/components/shared/FullScreenWrapper"
import withFullScreenWrapper, {
  AppElementProps,
} from "./withFullScreenWrapper"

const testComponent: ComponentType = () => <div>test</div>

const getProps = (props: Partial<AppElementProps> = {}): AppElementProps => ({
  width: 100,
  ...props,
})

describe("withFullScreenWrapper HOC", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const WithHoc = withFullScreenWrapper(testComponent)
    // @ts-ignore
    const wrapper = mount(<WithHoc {...props} />)

    expect(wrapper.find("FullScreenWrapper").exists()).toBe(true)
  })

  it("should render a component wrapped with FullScreenWrapper", () => {
    const props = getProps()
    const WithHoc = withFullScreenWrapper(testComponent)
    // @ts-ignore
    const wrapper = mount(<WithHoc {...props} />)
    const fullScreenWrapper = wrapper.find(FullScreenWrapper)

    expect(fullScreenWrapper.props().width).toBe(props.width)
    expect(fullScreenWrapper.props().height).toBeUndefined()
  })

  it("should render FullScreenWrapper with an specific height", () => {
    const props = getProps({
      height: 100,
    })
    const WithHoc = withFullScreenWrapper(testComponent)
    // @ts-ignore
    const wrapper = mount(<WithHoc {...props} />)
    const fullScreenWrapper = wrapper.find(FullScreenWrapper)

    expect(fullScreenWrapper.props().width).toBe(props.width)
    expect(fullScreenWrapper.props().height).toBe(props.height)
  })
})
