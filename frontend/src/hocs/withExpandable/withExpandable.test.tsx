import React, { ComponentType } from "react"
import { mount } from "src/lib/test_util"
import { StatelessAccordion } from "baseui/accordion"
import withExpandable, { Props } from "./withExpandable"

const testComponent: ComponentType = () => <div>test</div>

const getProps = (props?: Partial<Props>): Props =>
  Object({
    label: "hi",
    expandable: true,
    expanded: true,
    ...props,
  })

describe("withExpandable HOC", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const WithHoc = withExpandable(testComponent)
    // @ts-ignore
    const wrapper = mount(<WithHoc {...props} />)
    expect(wrapper.find(StatelessAccordion).exists()).toBe(true)
  })

  it("should render a expanded component", () => {
    const props = getProps()
    const WithHoc = withExpandable(testComponent)
    // @ts-ignore
    const wrapper = mount(<WithHoc {...props} />)
    const accordion = wrapper.find(StatelessAccordion)

    expect(accordion.prop("expanded").length).toBe(1)
  })

  it("should render a collapsed component", () => {
    const props = getProps({
      expanded: false,
    })
    const WithHoc = withExpandable(testComponent)
    // @ts-ignore
    const wrapper = mount(<WithHoc {...props} />)
    const accordion = wrapper.find(StatelessAccordion)

    expect(accordion.prop("expanded").length).toBe(0)
  })

  it("should become stale", () => {
    const props = getProps({
      isStale: true,
    })
    const WithHoc = withExpandable(testComponent)
    // @ts-ignore
    const wrapper = mount(<WithHoc {...props} />)
    const accordion = wrapper.find(StatelessAccordion)
    const overrides = accordion.prop("overrides")

    // @ts-ignore
    expect(overrides.Header.props.isStale).toBeTruthy()
  })
})
