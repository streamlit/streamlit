import React from "react"
import { mount } from "src/lib/test_util"

import Balloons, { Props, NUM_BALLOONS } from "./Balloons"

const getProps = (): Props => ({
  scriptRunId: "51522269",
})

describe("Balloons element", () => {
  jest.useFakeTimers()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Balloons {...props} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.find("StyledBalloon").length).toBe(NUM_BALLOONS)

    wrapper.find("StyledBalloon").forEach(node => {
      expect(node.prop("src")).toBeTruthy()
    })
  })

  it("renders as hidden element", () => {
    const props = getProps()
    const wrapper = mount(<Balloons {...props} />)

    expect(wrapper.find("div").prop("className")).toContain("stHidden")
  })
})
