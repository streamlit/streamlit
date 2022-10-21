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
    expect(wrapper.find(StyledBox).at(0).text()).toEqual(
      "This app would like to use your camera.Learn how to allow access."
    )
    // hidden style should be there and webcam should not show
    expect(wrapper.find(StyledBox).at(1).props().hidden).toEqual(true)
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

    expect(wrapper.find(StyledBox).at(0).text()).toEqual(
      "This app would like to use your camera.Learn how to allow access."
    )

    expect(wrapper.find(StyledBox).at(1).props().hidden).toEqual(true)
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
