import React, { ComponentType } from "react"
import { fromJS, Map as ImmutableMap } from "immutable"
import { mount } from "src/lib/test_util"

import FullScreenWrapper from "src/components/shared/FullScreenWrapper"
import withFullScreenWrapper, {
  AppElementProps,
} from "./withFullScreenWrapper"

const testComponent: ComponentType = () => <div>test</div>

const getProps = (props: Partial<AppElementProps> = {}): AppElementProps => ({
  element: fromJS({
    id: 1,
    label: "Label",
  }) as ImmutableMap<string, any>,
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
