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

import { CancelTokenSource } from "axios"
import React from "react"
import { mount, shallow } from "lib/test_util"

import { Small } from "components/shared/TextElements"
import ProgressBar from "components/shared/ProgressBar"
import Button from "components/shared/Button"

import UploadedFile, { Props, UploadedFileStatus } from "./UploadedFile"
import { FileStatus, UploadFileInfo } from "./UploadFileInfo"

const MOCK_FILE = new File(["Text in a file!"], "filename.txt", {
  type: "text/plain",
  lastModified: 0,
})

const getProps = (fileStatus: FileStatus): Props => ({
  fileInfo: new UploadFileInfo(MOCK_FILE, fileStatus),
  onDelete: jest.fn(),
})

describe("FileStatus widget", () => {
  it("renders without crashing", () => {
    const props = getProps({ type: "uploaded" })
    const wrapper = shallow(<UploadedFileStatus {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("shows progress bar when uploading", () => {
    const props = getProps({
      type: "uploading",
      cancelToken: (null as unknown) as CancelTokenSource,
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

  it("shows deleting status", () => {
    const props = getProps({ type: "deleting" })
    const wrapper = shallow(<UploadedFileStatus {...props} />)
    const statusWrapper = wrapper.find(Small)
    expect(statusWrapper.text()).toBe("Removing file")
  })

  it("show file size when uploaded", () => {
    const props = getProps({ type: "uploaded" })

    const wrapper = shallow(<UploadedFileStatus {...props} />)
    const statusWrapper = wrapper.find(Small)
    expect(statusWrapper.text()).toBe("15.0B")
  })
})

describe("UploadedFile widget", () => {
  it("renders without crashing", () => {
    const props = getProps({ type: "uploaded" })
    const wrapper = shallow(<UploadedFile {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("calls delete callback", () => {
    const props = getProps({ type: "uploaded" })
    const wrapper = mount(<UploadedFile {...props} />)
    const deleteBtn = wrapper.find(Button)
    deleteBtn.simulate("click")
    expect(props.onDelete).toBeCalled()
  })
})
