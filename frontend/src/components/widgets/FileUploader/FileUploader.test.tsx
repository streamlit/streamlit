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
import { FileError } from "react-dropzone"
import { shallow } from "enzyme"
import { fromJS } from "immutable"

import { ExtendedFile } from "lib/FileHelper"

import FileDropzone from "./FileDropzone"
import FileUploader, { Props } from "./FileUploader"

const blobFile = new File(["Text in a file!"], "filename.txt", {
  type: "text/plain",
  lastModified: 0,
})

const INVALID_TYPE_ERROR: FileError = {
  message: "error message",
  code: "file-invalid-type",
}

const TOO_MANY_FILES: FileError = {
  message: "error message",
  code: "too-many-files",
}

const FILE_TOO_LARGE: FileError = {
  message: "error message",
  code: "file-too-large",
}

const getProps = (elementProps: Record<string, unknown> = {}): Props => ({
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
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader.props().onDrop([blobFile], [])

    expect(props.uploadClient.uploadFiles.mock.calls.length).toBe(1)
  })

  it("should upload single file only", () => {
    const props = getProps({ multipleFiles: false })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader
      .props()
      .onDrop(
        [],
        [
          { file: blobFile, errors: [INVALID_TYPE_ERROR, TOO_MANY_FILES] },
          { file: blobFile, errors: [TOO_MANY_FILES] },
          { file: blobFile, errors: [TOO_MANY_FILES] },
        ]
      )

    expect(props.uploadClient.uploadFiles.mock.calls.length).toBe(1)
  })

  it("should change status + add file attributes when dropping a File", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader.props().onDrop([blobFile], [])
    const files: ExtendedFile[] = wrapper.state("files")

    expect(files[0].status).toBe("UPLOADING")
    expect(files[0].id).toBeDefined()
    expect(files[0].cancelToken).toBeDefined()
  })

  it("should fail when File extension is not allowed", () => {
    const props = getProps({ type: ["png"] })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader
      .props()
      .onDrop([], [{ file: blobFile, errors: [INVALID_TYPE_ERROR] }])

    const files: ExtendedFile[] = wrapper.state("files")

    expect(files[0].status).toBe("ERROR")
    expect(files[0].errorMessage).toBe("text/plain files are not allowed.")
  })

  it("should fail when maxUploadSizeMb = 0", () => {
    const props = getProps({ maxUploadSizeMb: 0 })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader
      .props()
      .onDrop([], [{ file: blobFile, errors: [FILE_TOO_LARGE] }])
    const files: ExtendedFile[] = wrapper.state("files")

    expect(files[0].status).toBe("ERROR")
    expect(files[0].errorMessage).toBe("File must be 0.0B or smaller.")
  })

  it("should reset on disconnect", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const resetSpy = jest.spyOn(wrapper.instance(), "reset")
    wrapper.setProps({ disabled: true })
    expect(resetSpy).toBeCalled()
  })
})
