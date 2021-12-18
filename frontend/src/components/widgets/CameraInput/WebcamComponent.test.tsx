import React from "react"
import Webcam from "react-webcam"
import { mount, shallow } from "src/lib/test_util"
import { StyledBox } from "./styled-components"
import WebcamComponent, { Props } from "./WebcamComponent"

const getProps = (props: Partial<Props> = {}): Props => {
  return {
    handleCapture: jest.fn(),
    width: 500,
    disabled: false,
    ...props,
  }
}

describe("Test Webcam Component", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<WebcamComponent {...props} />)
    expect(wrapper).toBeDefined()
  })

  it("renders ask permission screen when pending state", () => {
    const props = getProps()
    // automatically put in pending state
    const wrapper = shallow(<WebcamComponent {...props} />)
    expect(wrapper).toBeDefined()
    expect(
      wrapper
        .find(StyledBox)
        .at(0)
        .text()
    ).toEqual(
      "<Icon />This app would like to use your camera.Learn how to allow access."
    )
    // hidden style should not be there and webcam should not show
    expect(
      wrapper
        .find(StyledBox)
        .at(1)
        .props().hidden
    ).toEqual(true)
  })

  it("renders ask permission screen when error state", () => {
    const props = getProps()
    // automatically put in pending state
    const wrapper = shallow(<WebcamComponent {...props} />)
    expect(wrapper).toBeDefined()

    wrapper
      .find(Webcam)
      .props()
      .onUserMediaError(null)

    expect(
      wrapper
        .find(StyledBox)
        .at(0)
        .text()
    ).toEqual(
      "<Icon />This app would like to use your camera.Learn how to allow access."
    )

    expect(
      wrapper
        .find(StyledBox)
        .at(1)
        .props().hidden
    ).toEqual(true)
  })

  it("renders ask permission screen when error state", () => {
    const props = getProps()
    // automatically put in pending state
    const wrapper = shallow(<WebcamComponent {...props} />)
    expect(wrapper).toBeDefined()

    wrapper
      .find(Webcam)
      .props()
      .onUserMedia(null)

    console.log(wrapper.debug())

    // hidden style should not be there and webcam should show
    expect(wrapper.find(StyledBox).props().hidden).toEqual(false)
  })
})
