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
import { enableFetchMocks } from "jest-fetch-mock"

import { mount, shallow } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import {
  CameraInput as CameraInputProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "src/autogen/proto"
import { WidgetLabel } from "src/lib/components/widgets/BaseWidget"
import CameraInput, { Props, State } from "./CameraInput"
import { FacingMode } from "./SwitchFacingModeButton"
import WebcamComponent from "./WebcamComponent"
import { StyledBox } from "./styled-components"

jest.mock("react-webcam")

jest.mock("react-device-detect", () => {
  return {
    isMobile: true,
  }
})

const INITIAL_SERVER_FILE_ID = 1

const getProps = (elementProps: Partial<CameraInputProto> = {}): Props => {
  let mockServerFileIdCounter = INITIAL_SERVER_FILE_ID
  return {
    element: CameraInputProto.create({
      id: "id",
      label: "test_label",
      help: "help",
      formId: "",
      ...elementProps,
    }),
    width: 0,
    disabled: false,
    widgetMgr: new WidgetStateManager({
      sendRerunBackMsg: jest.fn(),
      formsDataChanged: jest.fn(),
    }),
    mockServerFileIdCounter: 1,
    // @ts-expect-error
    uploadClient: {
      uploadFile: jest.fn().mockImplementation(() => {
        // Mock UploadClient to return an incremented ID for each upload.
        return Promise.resolve(mockServerFileIdCounter++)
      }),
    },
  }
}

describe("CameraInput widget", () => {
  enableFetchMocks()
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<CameraInput {...props} />)
    const instance = wrapper.instance() as CameraInput

    expect(wrapper).toBeDefined()
    expect(instance.status).toBe("ready")

    expect(wrapper.find(WebcamComponent)).toHaveLength(1)
    expect(wrapper.find(StyledBox)).toHaveLength(0)
  })

  it("sets initial value properly if non-empty", () => {
    const props = getProps()

    const wrapper = shallow(<CameraInput {...props} />)
    expect(wrapper.state()).toEqual({
      files: [],
      newestServerFileId: 0,
      clearPhotoInProgress: false,
      facingMode: FacingMode.USER,
      imgSrc: null,
      shutter: false,
      minShutterEffectPassed: true,
    })
  })

  it("shows a label", () => {
    const props = getProps()
    const wrapper = shallow(<CameraInput {...props} />)
    expect(wrapper.find(WidgetLabel).props().label).toEqual(
      props.element.label
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    const wrapper = mount(<CameraInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    const wrapper = mount(<CameraInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED
    )
  })

  it("shows a SwitchFacingMode button", () => {
    const props = getProps()
    const wrapper = mount(<CameraInput {...props} />)

    act(() => {
      wrapper
        .find("Webcam")
        .props()
        // @ts-expect-error
        .onUserMedia(null)
    })

    wrapper.update()

    expect(wrapper.find("SwitchFacingModeButton").exists()).toBeTruthy()
  })

  it("changes `facingMode` when SwitchFacingMode button clicked", () => {
    const props = getProps()
    const wrapper = mount<CameraInput, Props, State>(
      <CameraInput {...props} />
    )

    act(() => {
      wrapper
        .find("Webcam")
        .props()
        // @ts-expect-error
        .onUserMedia(null)
    })

    wrapper.update()

    act(() => {
      wrapper.find("SwitchFacingModeButton").find("button").simulate("click")
    })
    wrapper.update()

    expect(wrapper.instance().state.facingMode).toBe(FacingMode.ENVIRONMENT)
  })

  it("test handle capture function", async () => {
    const props = getProps()
    const wrapper = shallow<CameraInput, Props, State>(
      <CameraInput {...props} />
    )
    // @ts-expect-error
    await wrapper.instance().handleCapture("test img")

    expect(wrapper.instance().state.files).toHaveLength(1)
    expect(wrapper.instance().state.files[0].name).toContain("camera-input-")
    expect(wrapper.instance().state.shutter).toBe(false)
    expect(wrapper.instance().state.minShutterEffectPassed).toBe(true)

    expect(wrapper.find(StyledBox)).toHaveLength(1)
    expect(wrapper.find(WebcamComponent)).toHaveLength(0)
  })

  it("test remove capture", async () => {
    const props = getProps()
    const wrapper = shallow<CameraInput, Props, State>(
      <CameraInput {...props} />
    )
    // @ts-expect-error
    await wrapper.instance().handleCapture("test img")

    // @ts-expect-error
    await wrapper.instance().removeCapture()
    expect(wrapper.state()).toEqual({
      files: [],
      newestServerFileId: 1,
      clearPhotoInProgress: true,
      facingMode: FacingMode.USER,
      imgSrc: null,
      shutter: false,
      minShutterEffectPassed: true,
    })
  })
})
