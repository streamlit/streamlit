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
import { FileError } from "react-dropzone"
import { mount, shallow } from "lib/test_util"

import { ExtendedFile } from "lib/FileHelper"

import { FileUploader as FileUploaderProto } from "autogen/proto"
import FileDropzone from "./FileDropzone"
import FileUploader, { Props } from "./FileUploader"

const createFile = (id: string): ExtendedFile => {
  const file = new File(["Text in a file!"], "filename.txt", {
    type: "text/plain",
    lastModified: 0,
  }) as ExtendedFile
  file.id = id
  return file
}

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
  element: FileUploaderProto.create({
    id: "id",
    type: [],
    maxUploadSizeMb: 50,
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  // @ts-ignore
  widgetStateManager: jest.fn(),
  // @ts-ignore
  uploadClient: {
    uploadFiles: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
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

    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.element.label)
  })

  it("should upload files", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader.props().onDrop([createFile("id")], [])

    expect(props.uploadClient.uploadFiles.mock.calls.length).toBe(1)
    expect(wrapper.state("numValidFiles")).toBe(1)
  })

  it("should upload single file only", () => {
    const props = getProps({ multipleFiles: false })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader.props().onDrop(
      [],
      [
        {
          file: createFile("id1"),
          errors: [INVALID_TYPE_ERROR, TOO_MANY_FILES],
        },
        { file: createFile("id2"), errors: [TOO_MANY_FILES] },
        { file: createFile("id3"), errors: [TOO_MANY_FILES] },
      ]
    )

    expect(props.uploadClient.uploadFiles.mock.calls.length).toBe(1)
    expect(wrapper.state("numValidFiles")).toBe(1)
  })

  it("should replace file on single file uploader", () => {
    const props = getProps({ multipleFiles: false })
    const wrapper = mount(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)

    internalFileUploader.props().onDrop([createFile("id1")], [])
    const firstUploadedFiles: ExtendedFile[] = wrapper.state("files")
    expect(props.uploadClient.uploadFiles).toBeCalledTimes(1)
    expect(firstUploadedFiles.length).toBe(1)

    internalFileUploader.props().onDrop([createFile("id2")], [])
    expect(props.uploadClient.uploadFiles).toBeCalledTimes(2)
    // Expect replace param to be true
    expect(props.uploadClient.uploadFiles.mock.calls[1][5]).toBe(true)
    const secondUploadedFiles: ExtendedFile[] = wrapper.state("files")
    expect(secondUploadedFiles.length).toBe(1)
    expect(wrapper.state("numValidFiles")).toBe(1)
  })

  it("should upload multiple files", () => {
    const props = getProps({ multipleFiles: true })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader.props().onDrop(
      [createFile("id1"), createFile("id2")],
      [
        {
          file: createFile("id3"),
          errors: [INVALID_TYPE_ERROR, TOO_MANY_FILES],
        },
        { file: createFile("id4"), errors: [TOO_MANY_FILES] },
        { file: createFile("id5"), errors: [TOO_MANY_FILES] },
      ]
    )

    expect(props.uploadClient.uploadFiles.mock.calls.length).toBe(2)
    expect(wrapper.state("numValidFiles")).toBe(2)
  })

  it("should delete file", () => {
    const props = getProps({ multipleFiles: true })
    const wrapper = mount(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader.props().onDrop(
      [createFile("id1"), createFile("id2")],
      [
        {
          file: createFile("id3"),
          errors: [INVALID_TYPE_ERROR, TOO_MANY_FILES],
        },
        { file: createFile("id4"), errors: [TOO_MANY_FILES] },
        { file: createFile("id5"), errors: [TOO_MANY_FILES] },
      ]
    )

    expect(wrapper.state("numValidFiles")).toBe(2)

    // @ts-ignore
    wrapper.instance().removeFile(wrapper.state("files")[0].id)

    expect(wrapper.state("numValidFiles")).toBe(1)
  })

  it("should change status + add file attributes when dropping a File", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader.props().onDrop([createFile("id")], [])
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
      .onDrop([], [{ file: createFile("id"), errors: [INVALID_TYPE_ERROR] }])

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
      .onDrop([], [{ file: createFile("id"), errors: [FILE_TOO_LARGE] }])
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
