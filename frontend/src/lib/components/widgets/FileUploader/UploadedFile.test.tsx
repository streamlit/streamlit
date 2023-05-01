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

import { CancelTokenSource } from "axios"
import React from "react"
import { mount, shallow } from "src/lib/test_util"

import { Small } from "src/lib/components/shared/TextElements"
import ProgressBar from "src/lib/components/shared/ProgressBar"

import UploadedFile, { Props, UploadedFileStatus } from "./UploadedFile"
import { FileStatus, UploadFileInfo } from "./UploadFileInfo"

const getProps = (fileStatus: FileStatus): Props => ({
  fileInfo: new UploadFileInfo("filename.txt", 15, 1, fileStatus),
  onDelete: jest.fn(),
})

describe("FileStatus widget", () => {
  it("renders without crashing", () => {
    const props = getProps({ type: "uploaded", serverFileId: 1 })
    const wrapper = shallow(<UploadedFileStatus {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("shows progress bar when uploading", () => {
    const props = getProps({
      type: "uploading",
      cancelToken: null as unknown as CancelTokenSource,
      progress: 40,
    })
    const wrapper = shallow(<UploadedFileStatus {...props} />)
    const progressBarWrapper = wrapper.find(ProgressBar)

    expect(progressBarWrapper.length).toBe(1)
  })

  it("shows error status", () => {
    const props = getProps({
      type: "error",
      errorMessage: "Everything is terrible",
    })
    const wrapper = shallow(<UploadedFileStatus {...props} />)
    const errorMessageWrapper = wrapper.find("StyledErrorMessage")
    expect(errorMessageWrapper.text()).toBe("Everything is terrible")
  })

  it("show file size when uploaded", () => {
    const props = getProps({ type: "uploaded", serverFileId: 1 })

    const wrapper = shallow(<UploadedFileStatus {...props} />)
    const statusWrapper = wrapper.find(Small)
    expect(statusWrapper.text()).toBe("15.0B")
  })
})

describe("UploadedFile widget", () => {
  it("renders without crashing", () => {
    const props = getProps({ type: "uploaded", serverFileId: 1 })
    const wrapper = shallow(<UploadedFile {...props} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.text()).toContain("filename.txt")
  })

  it("calls delete callback", () => {
    const props = getProps({ type: "uploaded", serverFileId: 1 })
    const wrapper = mount(<UploadedFile {...props} />)
    const deleteBtn = wrapper.find("button")
    deleteBtn.simulate("click")
    expect(props.onDelete).toBeCalled()
  })
})
