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
import { FileUploader as FileUploaderBaseui } from "baseui/file-uploader"
import { fromJS } from "immutable"

import FileUploader, { Props } from "./FileUploader"

const blobFile = new File(["Text in a file!"], "filename.txt", {
  type: "text/plain",
  lastModified: 0,
})

const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    type: [],
    progress: 0,
    maxUploadSizeMb: 50,
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  // @ts-ignore
  widgetStateManager: jest.fn(),
  // @ts-ignore
  uploadClient: { uploadFiles: jest.fn().mockResolvedValue(undefined) },
})

describe("FileUploader widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.state("status")).toBe("READY")
  })

  it("should show a label", () => {
    const props = getProps({ label: "Test label" })
    const wrapper = shallow(<FileUploader {...props} />)

    expect(wrapper.find("label").text()).toBe(props.element.get("label"))
  })

  it("should upload files", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileUploaderBaseui)
    internalFileUploader.props().onDrop([blobFile], [], null)

    expect(props.uploadClient.uploadFiles.mock.calls.length).toBe(1)
  })

  it("should change status when dropping a File", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileUploaderBaseui)
    internalFileUploader.props().onDrop([blobFile], [], null)

    expect(wrapper.state("status")).toBe("UPLOADING")
    expect(wrapper.find("div.uploadProgress").length).toBe(1)
  })

  it("should fail when File extension is not allowed", () => {
    const props = getProps({ type: ["png"] })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileUploaderBaseui)
    internalFileUploader.props().onDrop([], [blobFile], null)

    expect(wrapper.state("status")).toBe("ERROR")
    expect(wrapper.state("errorMessage")).toBe(
      "text/plain files are not allowed"
    )
    expect(wrapper.find("div.uploadError").length).toBe(1)
  })

  it("should fail when maxUploadSizeMb = 0", () => {
    const props = getProps({ maxUploadSizeMb: 0 })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileUploaderBaseui)
    internalFileUploader.props().onDrop([blobFile], [], null)

    expect(wrapper.state("status")).toBe("ERROR")
    expect(wrapper.state("errorMessage")).toBe(
      "The max file size allowed is 0MB"
    )
    expect(wrapper.find("div.uploadError").length).toBe(1)
  })
})
