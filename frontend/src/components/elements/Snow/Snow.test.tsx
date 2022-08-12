import React from "react"
import { mount } from "src/lib/test_util"

import Snow, { SnowProps, NUM_FLAKES } from "src/components/elements/Snow"

const getProps = (): SnowProps => ({
  scriptRunId: "51522269",
})

describe("Snow element", () => {
  jest.useFakeTimers()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Snow {...props} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.find("StyledFlake").length).toBe(NUM_FLAKES)

    wrapper.find("StyledFlake").forEach(node => {
      expect(node.prop("src")).toBeTruthy()
    })
  })

  it("renders as hidden element", () => {
    const props = getProps()
    const wrapper = mount(<Snow {...props} />)

    expect(wrapper.find("div").prop("className")).toContain("stHidden")
  })
})
