/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { FC } from "react"
import { render } from "@streamlit/lib/src/test_util"
import { screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import Particles, { ParticleProps, Props } from "./Particles"

const DummyParticle: FC<React.PropsWithChildren<ParticleProps>> = () => (
  <span />
)

const getProps = (): Props => ({
  className: "particles",
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
    render(<Particles {...props} />)

    const particleElement = screen.getByTestId("particles")
    expect(particleElement).toBeInTheDocument()

    // eslint-disable-next-line testing-library/no-node-access
    const particleComponents = particleElement.children
    expect(particleComponents.length).toBe(10)
  })

  it("renders as hidden element", () => {
    const props = getProps()
    render(<Particles {...props} />)

    const particleElement = screen.getByTestId("particles")
    expect(particleElement).toHaveClass("stHidden")
  })
})
