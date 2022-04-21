import React from "react"
import { act } from "react-dom/test-utils"

import { mount } from "src/lib/test_util"
import { StyledBox } from "./styled-components"
import { FacingMode } from "./SwitchFacingModeButton"
import WebcamComponent, { Props } from "./WebcamComponent"

jest.mock("react-webcam")
const getProps = (props: Partial<Props> = {}): Props => {
  return {
    handleCapture: jest.fn(),
    width: 500,
    disabled: false,
    setClearPhotoInProgress: jest.fn(),
    clearPhotoInProgress: false,
    facingMode: FacingMode.USER,
    setFacingMode: jest.fn(),
    ...props,
  }
}

describe("Test Webcam Component", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<WebcamComponent {...props} />)
    expect(wrapper).toBeDefined()
  })

  it("renders ask permission screen when pending state", () => {
    const props = getProps()
    // automatically put in pending state
    const wrapper = mount(<WebcamComponent {...props} />)
    expect(wrapper).toBeDefined()
    expect(
      wrapper
        .find(StyledBox)
        .at(0)
        .text()
    ).toEqual(
      "This app would like to use your camera.Learn how to allow access."
    )
    // hidden style should be there and webcam should not show
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
    const wrapper = mount(<WebcamComponent {...props} />)
    expect(wrapper).toBeDefined()

    act(() => {
      wrapper
        .find("Webcam")
        .props()
        // @ts-ignore
        .onUserMediaError(null)
    })
    wrapper.update()

    expect(
      wrapper
        .find(StyledBox)
        .at(0)
        .text()
    ).toEqual(
      "This app would like to use your camera.Learn how to allow access."
    )

    expect(
      wrapper
        .find(StyledBox)
        .at(1)
        .props().hidden
    ).toEqual(true)
  })

  it("does not render ask permission screen in success state", () => {
    const props = getProps()
    // automatically put in pending state
    const wrapper = mount(<WebcamComponent {...props} />)
    expect(wrapper).toBeDefined()

    act(() => {
      wrapper
        .find("Webcam")
        .props()
        // @ts-ignore
        .onUserMedia(null)
    })
    wrapper.update()

    // hidden style should not be there and webcam should show
    expect(wrapper.find(StyledBox).props().hidden).toEqual(false)
  })
})
