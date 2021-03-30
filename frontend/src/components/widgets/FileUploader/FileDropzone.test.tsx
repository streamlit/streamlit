/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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
import { shallow } from "src/lib/test_util"
import Dropzone from "react-dropzone"
import FileDropzone, { Props } from "./FileDropzone"

const getProps = (props: Partial<Props> = {}): Props => ({
  disabled: false,
  onDrop: jest.fn(),
  multiple: true,
  acceptedExtensions: [],
  maxSizeBytes: 200,
  ...props,
})

describe("FileDropzone widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<FileDropzone {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("renders dropzone without extensions", () => {
    const props = getProps({
      acceptedExtensions: [],
    })
    const wrapper = shallow(<FileDropzone {...props} />)
    const dropzoneWrapper = wrapper.find(Dropzone)
    expect(dropzoneWrapper.props().accept).toBe(undefined)
  })

  it("renders dropzone with extensions", () => {
    const props = getProps({
      acceptedExtensions: [".jpg"],
    })
    const wrapper = shallow(<FileDropzone {...props} />)
    const dropzoneWrapper = wrapper.find(Dropzone)
    expect(dropzoneWrapper.props().accept).toEqual([".jpg"])
  })
})
