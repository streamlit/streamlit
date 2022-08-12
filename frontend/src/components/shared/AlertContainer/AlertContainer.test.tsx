import React from "react"
import { mount } from "src/lib/test_util"

import AlertContainer, { AlertContainerProps, Kind } from "./AlertContainer"

const getProps = (
  propOverrides: Partial<AlertContainerProps> = {}
): AlertContainerProps => ({
  kind: Kind.INFO,
  width: 100,
  children: null,
  ...propOverrides,
})

describe("AlertContainer element", () => {
  it("renders a Notification", () => {
    const wrapper = mount(<AlertContainer {...getProps()}></AlertContainer>)

    expect(wrapper.find("Notification").exists()).toBeTruthy()
  })

  it("renders its children", () => {
    const wrapper = mount(
      <AlertContainer {...getProps()}>
        <div className="foo" />
      </AlertContainer>
    )

    expect(wrapper.find(".foo").exists()).toBeTruthy()
  })

  it("sets its width", () => {
    const wrapper = mount(<AlertContainer {...getProps()} />)

    const overrides = wrapper.find("Notification").prop("overrides")

    // @ts-ignore
    expect(overrides.Body.style.width).toEqual("100")
  })
})
