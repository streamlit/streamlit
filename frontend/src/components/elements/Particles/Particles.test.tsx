import React, { FC } from "react"
import { mount } from "src/lib/test_util"

import Particles, { ParticleProps, Props } from "./Particles"

const DummyParticle: FC<ParticleProps> = () => <span />

const getProps = (): Props => ({
  className: "stHidden",
  numParticles: 10,
  numParticleTypes: 5,
  ParticleComponent: DummyParticle,
  scriptRunId: "51522269",
})

describe("Particles element", () => {
  jest.useFakeTimers()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Particles {...props} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.find(DummyParticle).length).toBe(10)
  })

  it("renders as hidden element", () => {
    const props = getProps()
    const wrapper = mount(<Particles {...props} />)

    expect(wrapper.find("div").prop("className")).toContain("stHidden")
  })
})
