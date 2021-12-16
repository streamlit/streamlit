import { shallow } from "src/lib/test_util"
import React from "react"
import { Size, StyledCameraInputBaseButton } from "./styled-components"
import CameraInputButton, { CameraInputButtonProps } from "./CameraInputButton"

const getProps = (
  props: Partial<CameraInputButtonProps> = {}
): CameraInputButtonProps => {
  return {
    size: Size.XSMALL,
    onClick: jest.fn(),
    disabled: false,
    fluidWidth: false,
    children: jest.fn(),
    autoFocus: true,
    progress: 0,
    ...props,
  }
}

describe("Testing Camera Input Button", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<CameraInputButton {...props} />)
    expect(wrapper).toBeDefined()
  })

  it("plumbs size properly", () => {
    const props = getProps({ size: Size.LARGE })
    const wrapper = shallow(<CameraInputButton {...props} />)
    const styledCameraInputBaseButton = wrapper.find(
      StyledCameraInputBaseButton
    )
    expect(styledCameraInputBaseButton.props().size).toEqual(Size.LARGE)
  })

  it("plumbs progress properly", () => {
    const props = getProps({ progress: 50 })
    const wrapper = shallow(<CameraInputButton {...props} />)
    const styledCameraInputBaseButton = wrapper.find(
      StyledCameraInputBaseButton
    )
    expect(styledCameraInputBaseButton.props().progress).toEqual(50)
  })

  it("plumbs fluidWidth(false) properly", () => {
    const props = getProps({ fluidWidth: false })
    const wrapper = shallow(<CameraInputButton {...props} />)
    const styledCameraInputBaseButton = wrapper.find(
      StyledCameraInputBaseButton
    )
    expect(styledCameraInputBaseButton.props().fluidWidth).toEqual(true)
  })

  it("plumbs fluidWidth(true) properly", () => {
    const props = getProps({ fluidWidth: true })
    const wrapper = shallow(<CameraInputButton {...props} />)
    const styledCameraInputBaseButton = wrapper.find(
      StyledCameraInputBaseButton
    )
    expect(styledCameraInputBaseButton.props().fluidWidth).toEqual(true)
  })

  it("plumbs autoFocus(true) properly", () => {
    const props = getProps({ autoFocus: true })
    const wrapper = shallow(<CameraInputButton {...props} />)
    const styledCameraInputBaseButton = wrapper.find(
      StyledCameraInputBaseButton
    )
    expect(styledCameraInputBaseButton.props().autoFocus).toEqual(true)
  })

  it("plumbs autoFocus(false) properly", () => {
    const props = getProps({ autoFocus: false })
    const wrapper = shallow(<CameraInputButton {...props} />)
    const styledCameraInputBaseButton = wrapper.find(
      StyledCameraInputBaseButton
    )
    expect(styledCameraInputBaseButton.props().autoFocus).toEqual(false)
  })
})
