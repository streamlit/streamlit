import React from "react"
import { shallow } from "src/lib/test_util"

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
  Object.keys(Kind).forEach(key => {
    const kind: Kind = Kind[key as keyof typeof Kind]

    it(`renders ${kind} buttons correctly`, () => {
      const wrapper = shallow(<Button {...getProps({ kind })}>Hello</Button>)

      expect(
        wrapper
          .find(
            `Styled${kind.charAt(0).toUpperCase()}${kind.substring(1)}Button`
          )
          .exists()
      ).toBeTruthy()
    })
  })

  Object.keys(Size).forEach(key => {
    const size: Size = Size[key as keyof typeof Size]

    it(`renders ${size} buttons correctly`, () => {
      const wrapper = shallow(<Button {...getProps({ size })}>Hello</Button>)

      expect(wrapper.find("StyledPrimaryButton").prop("size")).toBe(size)
    })
  })

  it("renders fluid width buttons correctly", () => {
    const wrapper = shallow(
      <Button {...getProps({ fluidWidth: true })}>Hello</Button>
    )

    expect(wrapper.find("StyledPrimaryButton").prop("fluidWidth")).toBe(true)
  })

  it("renders disabled buttons correctly", () => {
    const wrapper = shallow(
      <Button {...getProps({ disabled: true })}>Hello</Button>
    )

    expect(wrapper.find("StyledPrimaryButton").prop("disabled")).toBe(true)
  })

  it("calls onClick when button is clicked", () => {
    const onClick = jest.fn()
    const wrapper = shallow(<Button {...getProps({ onClick })}>Hello</Button>)
    wrapper.find("StyledPrimaryButton").simulate("click")

    expect(onClick).toBeCalled()
  })
})
