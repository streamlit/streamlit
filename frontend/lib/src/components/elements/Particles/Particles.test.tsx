/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { screen } from "@testing-library/react"

import { render } from "~lib/test_util"

import Particles, { ParticleProps, Props } from "./Particles"

const DummyParticle: FC<React.PropsWithChildren<ParticleProps>> = () => (
  <span />
)

const getProps = (): Props => ({
  className: "particles",
  scriptRunId: "51522269",
  numParticles: 10,
  numParticleTypes: 5,
  ParticleComponent: DummyParticle,
})

describe("Particles element", () => {
  vi.useFakeTimers()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<Particles {...props} />)

    const particleElement = screen.getByTestId("particles")
    expect(particleElement).toBeInTheDocument()
    expect(particleElement).toHaveClass("particles")

    const particleComponents = particleElement.children
    expect(particleComponents.length).toBe(10)
  })
})
