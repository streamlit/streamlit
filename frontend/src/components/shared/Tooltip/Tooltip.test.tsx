import React from "react"
import { PLACEMENT } from "baseui/tooltip"
import { mount } from "src/lib/test_util"

import Tooltip, { Placement, TooltipProps } from "./Tooltip"

const getProps = (
  propOverrides: Partial<TooltipProps> = {}
): TooltipProps => ({
  placement: Placement.AUTO,
  content: () => {},
  children: null,
  ...propOverrides,
})

describe("Tooltip element", () => {
  it("renders a Tooltip", () => {
    const wrapper = mount(<Tooltip {...getProps()}></Tooltip>)

    expect(wrapper.find("StatefulTooltip").exists()).toBeTruthy()
  })

  it("renders its children", () => {
    const wrapper = mount(
      <Tooltip {...getProps()}>
        <div className="foo" />
      </Tooltip>
    )

    expect(wrapper.find(".foo").exists()).toBeTruthy()
  })

  it("sets its placement", () => {
    const wrapper = mount(
      <Tooltip {...getProps({ placement: Placement.BOTTOM })} />
    )

    expect(wrapper.find("StatefulTooltip").prop("placement")).toEqual(
      PLACEMENT.bottom
    )
  })

  it("sets the same content", () => {
    const content = <span className="foo" />
    const wrapper = mount(<Tooltip {...getProps({ content })} />)

    expect(
      // @ts-ignore
      wrapper.find("StatefulTooltip").props().content.props.children
    ).toEqual(content)
  })
})
