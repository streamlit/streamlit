import { shallow } from "src/lib/test_util"
import React from "react"
import { StyledCameraInputBaseButton } from "./styled-components"
import CameraInputButton, { CameraInputButtonProps } from "./CameraInputButton"

const getProps = (
  props: Partial<CameraInputButtonProps> = {}
): CameraInputButtonProps => {
  return {
    onClick: jest.fn(),
    disabled: false,
    children: jest.fn(),
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

  it("plumbs progress properly", () => {
    const props = getProps({ progress: 50 })
    const wrapper = shallow(<CameraInputButton {...props} />)
    const styledCameraInputBaseButton = wrapper.find(
      StyledCameraInputBaseButton
    )
    expect(styledCameraInputBaseButton.props().progress).toEqual(50)
  })
})
