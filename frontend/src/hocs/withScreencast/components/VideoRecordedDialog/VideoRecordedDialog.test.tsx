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
import { ModalHeader, ModalBody, Button } from "reactstrap"

import VideoRecordedDialog, { Props } from "./VideoRecordedDialog"

URL.createObjectURL = jest.fn()

const getProps = (props: object = {}): Props => ({
  fileName: "test",
  onClose: jest.fn(),
  videoBlob: new Blob(),
  ...props,
})

describe("VideoRecordedDialog", () => {
  it("renders without crashing", () => {
    const wrapper = shallow(<VideoRecordedDialog {...getProps()} />)

    expect(wrapper.html()).not.toBeNull()
  })

  it("should render a header", () => {
    const props = getProps()
    const wrapper = shallow(<VideoRecordedDialog {...props} />)
    const headerWrapper = wrapper.find(ModalHeader)

    // @ts-ignore
    headerWrapper.props().toggle()

    expect(headerWrapper.props().children).toBe("Next steps")
    expect(props.onClose).toBeCalled()
  })

  it("should render a video", () => {
    const wrapper = shallow(<VideoRecordedDialog {...getProps()} />)
    const bodyWrapper = wrapper.find(ModalBody)

    expect(bodyWrapper.find("video").length).toBe(1)
    expect(URL.createObjectURL).toBeCalled()
  })

  it("should render a download button", () => {
    const props = getProps()
    const wrapper = shallow(<VideoRecordedDialog {...props} />)
    const buttonWrapper = wrapper.find(ModalBody).find(Button)

    buttonWrapper.simulate("click")

    expect(buttonWrapper.length).toBe(1)
    expect(props.onClose).toBeCalled()
  })
})
