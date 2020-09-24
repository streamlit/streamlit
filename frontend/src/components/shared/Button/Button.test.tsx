/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { shallow } from "enzyme"

import Button, { Size, Kind, ButtonProps } from "./Button"

const getProps = (propOverrides: Partial<ButtonProps> = {}): ButtonProps => ({
  kind: Kind.PRIMARY,
  size: Size.MEDIUM,
  onClick: () => {},
  disabled: false,
  fluidWidth: false,
  children: null,
  ...propOverrides,
})

describe("Button element", () => {
  for (let key in Kind) {
    const kind: Kind = Kind[key as keyof typeof Kind]

    it(`renders ${kind} buttons correctly`, () => {
      const wrapper = shallow(<Button {...getProps({ kind })}>Hello</Button>)

      expect(wrapper.find(`.${kind}-button`).exists()).toBeTruthy()
    })
  }

  for (let key in Size) {
    const size: Size = Size[key as keyof typeof Size]

    it(`renders ${size} buttons correctly`, () => {
      const wrapper = shallow(<Button {...getProps({ size })}>Hello</Button>)

      expect(wrapper.find(`.${size}-button`).exists()).toBeTruthy()
    })
  }

  it("renders fluid width buttons correctly", () => {
    const wrapper = shallow(
      <Button {...getProps({ fluidWidth: true })}>Hello</Button>
    )

    expect(wrapper.find(".button-fluid-width").exists()).toBeTruthy()
  })

  it("renders disabled buttons correctly", () => {
    const wrapper = shallow(
      <Button {...getProps({ disabled: true })}>Hello</Button>
    )

    expect(wrapper.find("button").prop("disabled")).toEqual(true)
  })

  it("calls onClick when button is clicked", () => {
    const onClick = jest.fn()
    const wrapper = shallow(<Button {...getProps({ onClick })}>Hello</Button>)
    wrapper.simulate("click")

    expect(onClick).toBeCalled()
  })
})
