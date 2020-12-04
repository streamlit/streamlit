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
import { mount, shallow } from "lib/test_util"

import { Small } from "components/shared/TextElements"
import ProgressBar from "components/shared/ProgressBar"
import Button from "components/shared/Button"
import { FileStatuses } from "lib/FileHelper"

import UploadedFile, { Props, FileStatus } from "./UploadedFile"

const blobFile = new File(["Text in a file!"], "filename.txt", {
  type: "text/plain",
  lastModified: 0,
})

const getProps = (props: Partial<Props> = {}): Props => ({
  file: blobFile,
  progress: undefined,
  onDelete: jest.fn(),
  ...props,
})

describe("FileStatus widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<FileStatus {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("should show progress bar", () => {
    const props = getProps({ progress: 40 })
    const wrapper = shallow(<FileStatus {...props} />)
    const progressBarWrapper = wrapper.find(ProgressBar)

    expect(progressBarWrapper.length).toBe(1)
  })

  it("should show error", () => {
    const props = getProps({
      file: { status: FileStatuses.ERROR, ...blobFile },
    })
    const wrapper = shallow(<FileStatus {...props} />)
    const errorMessageWrapper = wrapper.find("StyledErrorMessage")
    expect(errorMessageWrapper.length).toBe(1)
  })

  it("should show deleting", () => {
    const props = getProps({
      file: { status: FileStatuses.DELETING, ...blobFile },
    })
    const wrapper = shallow(<FileStatus {...props} />)
    const statusWrapper = wrapper.find(Small)
    expect(statusWrapper.text()).toBe("Removing file")
  })

  it("should show size", () => {
    const props = getProps({
      file: {
        size: 2000,
        status: FileStatuses.UPLOADED,
        ...blobFile,
      },
    })

    const wrapper = shallow(<FileStatus {...props} />)
    const statusWrapper = wrapper.find(Small)
    expect(statusWrapper.text()).toBe("2.0KB")
  })
})

describe("UploadedFile widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<UploadedFile {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("should delete", () => {
    const props = getProps()
    const wrapper = mount(<UploadedFile {...props} />)
    const deleteBtn = wrapper.find(Button)
    deleteBtn.simulate("click")
    expect(props.onDelete).toBeCalled()
  })
})
