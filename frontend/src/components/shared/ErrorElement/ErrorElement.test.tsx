import React from "react"
import { shallow } from "src/lib/test_util"

import ErrorElement, { ErrorElementProps } from "./ErrorElement"

const getProps = (
  propOverrides: Partial<ErrorElementProps> = {}
): ErrorElementProps => ({
  name: "Name",
  message: "Message",
  stack: "Stack\nLine 1   \nLine 2\n",
  width: 100,
  ...propOverrides,
})

describe("ErrorElement element", () => {
  it("renders an Alert without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<ErrorElement {...props} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.find("Alert")).toBeDefined()
  })

  it("renders stack without first line and trimmed lines", () => {
    const props = getProps()
    const wrapper = shallow(<ErrorElement {...props} />)

    expect(wrapper.find("code").exists()).toBe(true)
    expect(wrapper.find("code").text()).toEqual("Line 1\nLine 2\n")
  })

  it("does not render the stack when not defined", () => {
    const props = getProps({ stack: undefined })
    const wrapper = shallow(<ErrorElement {...props} />)

    expect(wrapper.find("code").exists()).toBe(false)
  })
})
