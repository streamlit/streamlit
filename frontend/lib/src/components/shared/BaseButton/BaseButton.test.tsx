/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React from "react"
import { shallow } from "@streamlit/lib/src/test_util"

import BaseButton, {
  BaseButtonSize,
  BaseButtonKind,
  BaseButtonProps,
} from "./BaseButton"

const getProps = (
  propOverrides: Partial<BaseButtonProps> = {}
): BaseButtonProps => ({
  kind: BaseButtonKind.SECONDARY,
  size: BaseButtonSize.MEDIUM,
  onClick: () => {},
  disabled: false,
  fluidWidth: false,
  children: null,
  ...propOverrides,
})

describe("Button element", () => {
  Object.keys(BaseButtonKind).forEach(key => {
    const kind: BaseButtonKind =
      BaseButtonKind[key as keyof typeof BaseButtonKind]

    it(`renders ${kind} buttons correctly`, () => {
      const wrapper = shallow(
        <BaseButton {...getProps({ kind })}>Hello</BaseButton>
      )

      expect(
        wrapper
          .find(
            `Styled${kind.charAt(0).toUpperCase()}${kind.substring(1)}Button`
          )
          .exists()
      ).toBeTruthy()
    })

    it(`renders disabled ${kind} correctly`, () => {
      const wrapper = shallow(
        <BaseButton {...getProps({ kind, disabled: true })}>Hello</BaseButton>
      )

      expect(
        wrapper
          .find(
            `Styled${kind.charAt(0).toUpperCase()}${kind.substring(1)}Button`
          )
          .prop("disabled")
      ).toBe(true)
    })
  })

  Object.keys(BaseButtonSize).forEach(key => {
    const size: BaseButtonSize =
      BaseButtonSize[key as keyof typeof BaseButtonSize]

    it(`renders ${size} buttons correctly`, () => {
      const wrapper = shallow(
        <BaseButton {...getProps({ size })}>Hello</BaseButton>
      )

      expect(wrapper.find("StyledSecondaryButton").prop("size")).toBe(size)
    })
  })

  it("renders fluid width buttons correctly", () => {
    const wrapper = shallow(
      <BaseButton {...getProps({ fluidWidth: true })}>Hello</BaseButton>
    )

    expect(wrapper.find("StyledSecondaryButton").prop("fluidWidth")).toBe(true)
  })

  it("renders disabled buttons correctly", () => {
    const wrapper = shallow(
      <BaseButton {...getProps({ disabled: true })}>Hello</BaseButton>
    )

    expect(wrapper.find("StyledSecondaryButton").prop("disabled")).toBe(true)
  })

  it("calls onClick when button is clicked", () => {
    const onClick = jest.fn()
    const wrapper = shallow(
      <BaseButton {...getProps({ onClick })}>Hello</BaseButton>
    )
    wrapper.find("StyledSecondaryButton").simulate("click")

    expect(onClick).toBeCalled()
  })

  it("does not use container width by default", () => {
    const wrapper = shallow(<BaseButton {...getProps()}>Hello</BaseButton>)

    expect(wrapper.find("StyledSecondaryButton").prop("fluidWidth")).toBe(
      false
    )
  })

  it("renders use container width buttons correctly", () => {
    const wrapper = shallow(
      <BaseButton {...getProps({ fluidWidth: true })}>Hello</BaseButton>
    )

    expect(wrapper.find("StyledSecondaryButton").prop("fluidWidth")).toBe(true)
  })
})
