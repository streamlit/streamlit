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

import React, { PureComponent, ReactNode } from "react"
import { mount } from "src/lib/test_util"

import FullScreenWrapper from "src/components/shared/FullScreenWrapper"
import withFullScreenWrapper from "./withFullScreenWrapper"

interface TestProps {
  width: number
  isFullScreen: boolean
  label: string
}

class TestComponent extends PureComponent<TestProps> {
  public render = (): ReactNode => this.props.label
}

const WrappedTestComponent = withFullScreenWrapper(TestComponent)

describe("withFullScreenWrapper HOC", () => {
  it("renders without crashing", () => {
    const props = { width: 100, label: "label" }
    const wrapper = mount(<WrappedTestComponent {...props} />)

    expect(wrapper.find(FullScreenWrapper).exists()).toBe(true)
  })

  it("renders a component wrapped with FullScreenWrapper", () => {
    const props = { width: 100, label: "label" }
    const wrapper = mount(<WrappedTestComponent {...props} />)
    const fullScreenWrapper = wrapper.find(FullScreenWrapper)

    expect(fullScreenWrapper.props().width).toBe(props.width)
    expect(fullScreenWrapper.props().height).toBeUndefined()
  })

  it("renders FullScreenWrapper with specified height", () => {
    const props = { width: 123, label: "label", height: 455 }
    const wrapper = mount(<WrappedTestComponent {...props} />)
    const fullScreenWrapper = wrapper.find(FullScreenWrapper)

    expect(fullScreenWrapper.props().width).toBe(props.width)
    expect(fullScreenWrapper.props().height).toBe(props.height)
  })

  it("passes unrelated props to wrapped component", () => {
    const props = { width: 100, label: "label" }
    const wrapper = mount(<WrappedTestComponent {...props} />)
    const componentInstance = wrapper.find(TestComponent)
    expect(componentInstance.props().label).toBe("label")
  })

  it("passes `isFullScreen` to wrapped component", () => {
    const props = { width: 100, label: "label" }
    const wrapper = mount(<WrappedTestComponent {...props} />)

    // by default, isFullScreen == false
    expect(wrapper.find(TestComponent).props().isFullScreen).toBe(false)

    // when FullScreenWrapper.expanded == true, then isFullScreen == true
    wrapper.find("FullScreenWrapper").setState({ expanded: true })
    expect(wrapper.find(TestComponent).props().isFullScreen).toBe(true)
  })

  it("works if wrapped component does not have `isFullScreen` prop", () => {
    // This test exists just to show that a component that does not take
    // an "isFullScreen" property can still be wrapped with the FullScreenWrapper,
    // and the typechecker won't complain. (The component instance will still
    // receive "isFullScreen" in its props - but it won't "know" about it.)
    class NoFullScreenPropComponent extends PureComponent<
      Omit<TestProps, "isFullScreen">
    > {
      public render = (): ReactNode => this.props.label
    }
    const WrappedNoFullScreenPropComponent = withFullScreenWrapper(
      NoFullScreenPropComponent
    )

    const props = { width: 100, label: "label" }
    const wrapper = mount(<WrappedNoFullScreenPropComponent {...props} />)
    expect(wrapper.find(NoFullScreenPropComponent).props().label).toBe("label")
  })

  it("defines `displayName`", () => {
    expect(WrappedTestComponent.displayName).toEqual(
      "withFullScreenWrapper(TestComponent)"
    )
  })
})
