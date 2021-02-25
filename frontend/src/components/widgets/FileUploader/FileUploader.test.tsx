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
import FileUploader, { Props } from "./FileUploader"
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
function withFileStatus(
  files: UploadFileInfo[],
  statusType: string
): UploadFileInfo[] {
  return files.filter(f => f.status.type === statusType)
}

describe("FileUploader widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader

    expect(wrapper).toBeDefined()
    expect(instance.status).toBe("ready")
  })

  it("shows a label", () => {
    const props = getProps({ label: "Test label" })
    const wrapper = shallow(<FileUploader {...props} />)

    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.element.label)
  })

  it("uploads a single selected file", async () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader
    const fileDropzone = wrapper.find(FileDropzone)
    fileDropzone.props().onDrop([createFile()], [])

    // We should have 1 file in the uploading state
    expect(props.uploadClient.uploadFiles.mock.calls.length).toBe(1)
    expect(getFiles(wrapper).length).toBe(1)
    expect(getFiles(wrapper)[0].status.type).toBe("uploading")
    expect(instance.status).toBe("updating")

    // WidgetStateManager should not have been called yet
    expect(props.widgetStateManager.setStringArrayValue).not.toHaveBeenCalled()

    await process.nextTick

    // After upload completes, our file should be "uploaded" and our status
    // should be "ready"
    expect(getFiles(wrapper).length).toBe(1)
    expect(getFiles(wrapper)[0].status.type).toBe("uploaded")
    expect(instance.status).toBe("ready")

    // And WidgetStateManager should have been called with the file's ID
    expect(props.widgetStateManager.setStringArrayValue).toHaveBeenCalledWith(
      props.element.id,
      [getFiles(wrapper)[0].id],
      {
        fromUi: true,
      }
    )
  })

  it("uploads a single file even if too many files are selected", async () => {
    const props = getProps({ multipleFiles: false })
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader
    const fileDropzone = wrapper.find(FileDropzone)
    fileDropzone.props().onDrop(
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
    expect(getFiles(wrapper).length).toBe(3)
    expect(withFileStatus(getFiles(wrapper), "uploading").length).toBe(1)
    expect(withFileStatus(getFiles(wrapper), "error").length).toBe(2)
    expect(instance.status).toBe("updating")

    await process.nextTick

    // Our upload has completed, our file should now be "uploaded", and
    // our status should now be "ready".
    expect(getFiles(wrapper).length).toBe(3)
    expect(withFileStatus(getFiles(wrapper), "uploaded").length).toBe(1)
    expect(withFileStatus(getFiles(wrapper), "error").length).toBe(2)
    expect(instance.status).toBe("ready")

    // WidgetStateManager should have been called with the file's ID
    expect(props.widgetStateManager.setStringArrayValue).toHaveBeenCalledWith(
      props.element.id,
      [getFiles(wrapper)[0].id],
      {
        fromUi: true,
      }
    )
  })

  it("replaces file on single file uploader", async () => {
    const props = getProps({ multipleFiles: false })
    const wrapper = mount(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader
    const fileDropzone = wrapper.find(FileDropzone)

    // Upload the first file
    fileDropzone.props().onDrop([createFile()], [])
    const origFile = getFiles(wrapper)[0]
    expect(props.uploadClient.uploadFiles).toBeCalledTimes(1)
    expect(getFiles(wrapper).length).toBe(1)
    expect(withFileStatus(getFiles(wrapper), "uploading").length).toBe(1)

    await process.nextTick

    expect(withFileStatus(getFiles(wrapper), "uploaded").length).toBe(1)
    expect(instance.status).toBe("ready")

    // Upload a replacement file
    fileDropzone.props().onDrop([createFile()], [])
    const replacementFile = getFiles(wrapper)[0]
    expect(props.uploadClient.uploadFiles).toBeCalledTimes(2)
    // Expect replace param to be true
    expect(props.uploadClient.uploadFiles.mock.calls[1][4]).toBe(true)
    expect(getFiles(wrapper).length).toBe(1)
    expect(withFileStatus(getFiles(wrapper), "uploading").length).toBe(1)

    // Ensure that our new UploadFileInfo has a different ID than the first
    // file's.
    expect(replacementFile.id).not.toBe(origFile.id)

    await process.nextTick

    // Ensure that our final status is as expected.
    expect(withFileStatus(getFiles(wrapper), "uploaded").length).toBe(1)
    expect(instance.status).toBe("ready")
  })

  it("uploads multiple files, even if some have errors", async () => {
    const props = getProps({ multipleFiles: true })
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader
    const fileDropzone = wrapper.find(FileDropzone)

    // Drop two valid files, and 3 invalid ones.
    fileDropzone.props().onDrop(
      [createFile(), createFile()],
      [
        { file: createFile(), errors: [INVALID_TYPE_ERROR] },
        { file: createFile(), errors: [INVALID_TYPE_ERROR] },
        { file: createFile(), errors: [INVALID_TYPE_ERROR] },
      ]
    )

    expect(props.uploadClient.uploadFiles.mock.calls.length).toBe(2)

    // We should have two files uploading, and 3 showing an error.
    expect(getFiles(wrapper).length).toBe(5)
    expect(withFileStatus(getFiles(wrapper), "uploading").length).toBe(2)
    expect(withFileStatus(getFiles(wrapper), "error").length).toBe(3)
    expect(instance.status).toBe("updating")

    await process.nextTick

    // When our upload completes, our uploading files should now be uploaded
    expect(getFiles(wrapper).length).toBe(5)
    expect(withFileStatus(getFiles(wrapper), "uploaded").length).toBe(2)
    expect(withFileStatus(getFiles(wrapper), "error").length).toBe(3)
    expect(instance.status).toBe("ready")

    // WidgetStateManager should have been called with the file IDs
    // of the uploaded files.
    const uploadedFiles = withFileStatus(getFiles(wrapper), "uploaded")
    expect(props.widgetStateManager.setStringArrayValue).toHaveBeenCalledWith(
      props.element.id,
      uploadedFiles.map(file => file.id),
      {
        fromUi: true,
      }
    )
  })

  it("can delete completed upload", async () => {
    const props = getProps({ multipleFiles: true })
    const wrapper = mount(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader

    // Upload two files
    instance.uploadFile(createFile())
    instance.uploadFile(createFile())

    await process.nextTick

    const origFiles = getFiles(wrapper)
    expect(origFiles.length).toBe(2)
    expect(withFileStatus(origFiles, "uploaded").length).toBe(2)
    expect(instance.status).toBe("ready")

    // Delete one of the files
    // @ts-ignore
    instance.deleteFile(origFiles[0].id)

    // Because the deleted file was uploaded, we should have made a call
    // to uploadClient.delete, with the deleted file's ID as a param.
    expect(props.uploadClient.delete.mock.calls.length).toBe(1)
    expect(props.uploadClient.delete.mock.calls[0][1]).toBe(origFiles[0].id)

    // Our first file is now "deleting". Our second is still "uploaded".
    expect(getFiles(wrapper).length).toBe(2)
    expect(getFiles(wrapper)[0].status.type).toBe("deleting")
    expect(getFiles(wrapper)[1]).toBe(origFiles[1])
    expect(instance.status).toBe("updating")

    await process.nextTick

    // After the deletion completes, we should only have a single file - the
    // second file from the original upload.
    expect(getFiles(wrapper).length).toBe(1)
    expect(getFiles(wrapper)[0]).toBe(origFiles[1])
    expect(instance.status).toBe("ready")

    // WidgetStateManager should have been called with the file ID
    // of the remaining file
    const uploadedFiles = withFileStatus(getFiles(wrapper), "uploaded")
    expect(
      props.widgetStateManager.setStringArrayValue
    ).toHaveBeenLastCalledWith(
      props.element.id,
      uploadedFiles.map(file => file.id),
      {
        fromUi: true,
      }
    )
  })

  it("can delete in-progress upload", async () => {
    const props = getProps({ multipleFiles: true })
    const wrapper = mount(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader

    // Upload a file...
    instance.uploadFile(createFile())
    expect(withFileStatus(getFiles(wrapper), "uploading").length).toBe(1)
    expect(instance.status).toBe("updating")

    const fileId = getFiles(wrapper)[0].id

    // and then immediately delete it before upload "completes"
    instance.deleteFile(fileId)

    // Because the deleted file was uploaded, we should have made a call
    // to uploadClient.delete, with the deleted file's ID as a param.
    expect(props.uploadClient.delete.mock.calls.length).toBe(1)
    expect(props.uploadClient.delete.mock.calls[0][1]).toBe(fileId)

    expect(withFileStatus(getFiles(wrapper), "deleting").length).toBe(1)
    expect(instance.status).toBe("updating")

    // Wait for the deletion to finish.
    await process.nextTick

    expect(getFiles(wrapper).length).toBe(0)
    expect(instance.status).toBe("ready")
  })

  it("can delete file with ErrorStatus", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader
    const fileDropzone = wrapper.find(FileDropzone)

    // Drop a file with an error status
    fileDropzone
      .props()
      .onDrop([], [{ file: createFile(), errors: [INVALID_TYPE_ERROR] }])

    expect(withFileStatus(getFiles(wrapper), "error").length).toBe(1)

    // Delete the file
    instance.deleteFile(getFiles(wrapper)[0].id)

    // File should be gone
    expect(getFiles(wrapper).length).toBe(0)

    // We should *not* have called uploadClient.delete, since the file
    // was not uploaded.
    expect(props.uploadClient.delete.mock.calls.length).toBe(0)
  })

  it("handles upload error", async () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader

    // Upload a file that will be rejected by the server
    props.uploadClient.uploadFiles = jest
      .fn()
      .mockRejectedValue(new Error("random upload error!"))

    instance.uploadFile(createFile())

    expect(getFiles(wrapper)[0].status.type).toBe("uploading")

    // Wait one tick for the upload to be rejected
    await process.nextTick

    // And another for the uploader to be re-rendered
    await process.nextTick

    // Our file should have an error status, and our uploader should still be
    // "ready"
    expect(getFiles(wrapper)[0].status.type).toBe("error")
    expect(
      (getFiles(wrapper)[0].status as ErrorStatus).errorMessage
    ).toContain("random upload error!")

    expect(instance.status).toBe("ready")
  })

  it("handles delete error", async () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader

    // Upload a file
    instance.uploadFile(createFile())
    await process.nextTick
    expect(getFiles(wrapper)[0].status.type).toBe("uploaded")

    // Delete our file, and have the deletion trigger an error.
    props.uploadClient.delete = jest
      .fn()
      .mockRejectedValue(new Error("random delete error!"))

    instance.deleteFile(getFiles(wrapper)[0].id)

    // Wait one tick for the deletion to be rejected
    await process.nextTick

    // And another for the uploader to be re-rendered
    await process.nextTick

    // Our file should have an error status, and our uploader should still be
    // "ready"
    expect(getFiles(wrapper)[0].status.type).toBe("error")
    expect(
      (getFiles(wrapper)[0].status as ErrorStatus).errorMessage
    ).toContain("random delete error!")

    expect(instance.status).toBe("ready")
  })

  it("changes status + adds file attributes when dropping a File", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const fileDropzone = wrapper.find(FileDropzone)
    fileDropzone.props().onDrop([createFile()], [])
    const files = getFiles(wrapper)

    expect(files[0].status.type).toBe("uploading")
    expect((files[0].status as UploadingStatus).cancelToken).toBeDefined()
    expect(files[0].id).toBeDefined()
  })

  it("shows an ErrorStatus when File extension is not allowed", () => {
    const props = getProps({ type: ["png"] })
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader
    const fileDropzone = wrapper.find(FileDropzone)
    fileDropzone
      .props()
      .onDrop([], [{ file: createFile(), errors: [INVALID_TYPE_ERROR] }])

    expect(getFiles(wrapper)[0].status.type).toBe("error")
    expect((getFiles(wrapper)[0].status as ErrorStatus).errorMessage).toBe(
      "text/plain files are not allowed."
    )

    // If a file has an error, the FileUploader still has a valid status
    expect(instance.status).toBe("ready")
  })

  it("shows an ErrorStatus when maxUploadSizeMb = 0", () => {
    const props = getProps({ maxUploadSizeMb: 0 })
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader
    const fileDropzone = wrapper.find(FileDropzone)
    fileDropzone
      .props()
      .onDrop([], [{ file: createFile(), errors: [FILE_TOO_LARGE] }])
    const files: UploadFileInfo[] = wrapper.state("files")

    expect(files[0].status.type).toBe("error")
    expect((files[0].status as ErrorStatus).errorMessage).toBe(
      "File must be 0.0B or smaller."
    )

    // If a file has an error, the FileUploader still has a valid status
    expect(instance.status).toBe("ready")
  })

  it("resets on disconnect", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const resetSpy = jest.spyOn(wrapper.instance(), "reset")
    wrapper.setProps({ disabled: true })
    expect(resetSpy).toBeCalled()
  })
})
