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

import { ReactWrapper, ShallowWrapper } from "enzyme"
import React from "react"
import { FileError } from "react-dropzone"
import { mount, shallow } from "lib/test_util"

import { FileUploader as FileUploaderProto } from "autogen/proto"
import { WidgetStateManager } from "lib/WidgetStateManager"
import FileDropzone from "./FileDropzone"
import FileUploader, { getStatus, Props } from "./FileUploader"
import { ErrorStatus, UploadFileInfo, UploadingStatus } from "./UploadFileInfo"

jest.mock("lib/WidgetStateManager")

const createFile = (): File => {
  return new File(["Text in a file!"], "filename.txt", {
    type: "text/plain",
    lastModified: 0,
  })
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

const getProps = (elementProps: Partial<FileUploaderProto> = {}): Props => ({
  element: FileUploaderProto.create({
    id: "id",
    type: [],
    maxUploadSizeMb: 50,
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  // @ts-ignore
  widgetStateManager: new WidgetStateManager(jest.fn()),
  // @ts-ignore
  uploadClient: {
    uploadFiles: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
})

/** Return a strongly-typed wrapper.state("files") */
function getFiles(
  wrapper: ShallowWrapper<FileUploader> | ReactWrapper<FileUploader>
): UploadFileInfo[] {
  return wrapper.state<UploadFileInfo[]>("files")
}

/** Filter a file list on a given status string. */
function withStatus(
  files: UploadFileInfo[],
  statusType: string
): UploadFileInfo[] {
  return files.filter(f => f.status.type === statusType)
}

describe("FileUploader widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)

    expect(wrapper).toBeDefined()
    expect(getStatus({ files: wrapper.state("files") })).toBe("ready")
  })

  it("shows a label", () => {
    const props = getProps({ label: "Test label" })
    const wrapper = shallow(<FileUploader {...props} />)

    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.element.label)
  })

  it("uploads files", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader.props().onDrop([createFile()], [])

    expect(props.uploadClient.uploadFiles.mock.calls.length).toBe(1)

    const files = getFiles(wrapper)
    expect(files.length).toBe(1)
    expect(files[0].status.type).toBe("uploading")
    expect(getStatus({ files: wrapper.state("files") })).toBe("updating")
  })

  it("uploads single file only", () => {
    const props = getProps({ multipleFiles: false })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader.props().onDrop(
      [],
      [
        {
          file: createFile(),
          errors: [INVALID_TYPE_ERROR, TOO_MANY_FILES],
        },
        { file: createFile(), errors: [TOO_MANY_FILES] },
        { file: createFile(), errors: [TOO_MANY_FILES] },
      ]
    )

    expect(props.uploadClient.uploadFiles.mock.calls.length).toBe(1)

    // We should have 3 files. One will be uploading, the other two will
    // be in the error state.
    const files = getFiles(wrapper)
    expect(files.length).toBe(3)
    expect(withStatus(files, "uploading").length).toBe(1)
    expect(withStatus(files, "error").length).toBe(2)
  })

  it("replaces file on single file uploader", () => {
    const props = getProps({ multipleFiles: false })
    const wrapper = mount(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)

    internalFileUploader.props().onDrop([createFile()], [])
    const firstUploadedFiles = getFiles(wrapper)
    expect(props.uploadClient.uploadFiles).toBeCalledTimes(1)
    expect(firstUploadedFiles.length).toBe(1)
    expect(withStatus(firstUploadedFiles, "uploading").length).toBe(1)

    internalFileUploader.props().onDrop([createFile()], [])
    expect(props.uploadClient.uploadFiles).toBeCalledTimes(2)
    // Expect replace param to be true
    expect(props.uploadClient.uploadFiles.mock.calls[1][4]).toBe(true)
    const secondUploadedFiles = getFiles(wrapper)
    expect(secondUploadedFiles.length).toBe(1)
    expect(withStatus(secondUploadedFiles, "uploading").length).toBe(1)

    // Ensure that our new UploadFileInfo has a different ID than the first
    // file's.
    expect(firstUploadedFiles[0].id).not.toBe(secondUploadedFiles[0].id)
  })

  it("uploads multiple files", () => {
    const props = getProps({ multipleFiles: true })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)

    // Drop two valid files, and 3 invalid ones.
    internalFileUploader.props().onDrop(
      [createFile(), createFile()],
      [
        { file: createFile(), errors: [INVALID_TYPE_ERROR] },
        { file: createFile(), errors: [INVALID_TYPE_ERROR] },
        { file: createFile(), errors: [INVALID_TYPE_ERROR] },
      ]
    )

    expect(props.uploadClient.uploadFiles.mock.calls.length).toBe(2)

    // We should have two files uploading, and 3 showing an error.
    const files = getFiles(wrapper)
    expect(files.length).toBe(5)
    expect(withStatus(files, "uploading").length).toBe(2)
    expect(withStatus(files, "error").length).toBe(3)
  })

  it("deletes uploading file", () => {
    const props = getProps({ multipleFiles: true })
    const wrapper = mount(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader.props().onDrop([createFile(), createFile()], [])

    // We should have 2 uploading files
    const origFiles = getFiles(wrapper)
    expect(origFiles.length).toBe(2)
    expect(withStatus(origFiles, "uploading").length).toBe(2)

    // @ts-ignore
    wrapper.instance().deleteFile(origFiles[0].id)

    // Because the deleted file was uploading, we should have made a call
    // to uploadClient.delete, with the deleted file's ID as a param.
    expect(props.uploadClient.delete.mock.calls.length).toBe(1)
    expect(props.uploadClient.delete.mock.calls[0][1]).toBe(origFiles[0].id)

    // Our first file is now "deleting". Our second is still "uploading".
    const newFiles = getFiles(wrapper)
    expect(newFiles.length).toBe(2)
    expect(newFiles[0].status.type).toBe("deleting")
    expect(newFiles[1]).toBe(origFiles[1])
  })

  it("changes status + adds file attributes when dropping a File", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader.props().onDrop([createFile()], [])
    const files = getFiles(wrapper)

    expect(files[0].status.type).toBe("uploading")
    expect((files[0].status as UploadingStatus).cancelToken).toBeDefined()
    expect(files[0].id).toBeDefined()
  })

  it("should fail when File extension is not allowed", () => {
    const props = getProps({ type: ["png"] })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader
      .props()
      .onDrop([], [{ file: createFile(), errors: [INVALID_TYPE_ERROR] }])

    const files = getFiles(wrapper)

    expect(files[0].status.type).toBe("error")
    expect((files[0].status as ErrorStatus).errorMessage).toBe(
      "text/plain files are not allowed."
    )
  })

  it("should fail when maxUploadSizeMb = 0", () => {
    const props = getProps({ maxUploadSizeMb: 0 })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileDropzone)
    internalFileUploader
      .props()
      .onDrop([], [{ file: createFile(), errors: [FILE_TOO_LARGE] }])
    const files: UploadFileInfo[] = wrapper.state("files")

    expect(files[0].status.type).toBe("error")
    expect((files[0].status as ErrorStatus).errorMessage).toBe(
      "File must be 0.0B or smaller."
    )
  })

  it("should reset on disconnect", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const resetSpy = jest.spyOn(wrapper.instance(), "reset")
    wrapper.setProps({ disabled: true })
    expect(resetSpy).toBeCalled()
  })
})
