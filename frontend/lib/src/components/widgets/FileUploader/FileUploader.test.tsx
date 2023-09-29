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

import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import { ReactWrapper, ShallowWrapper } from "enzyme"
import React from "react"
import { FileError } from "react-dropzone"
import { mount, shallow, render } from "@streamlit/lib/src/test_util"

import {
  FileUploader as FileUploaderProto,
  FileUploaderState as FileUploaderStateProto,
  FileURLs as FileURLsProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  UploadedFileInfo as UploadedFileInfoProto,
  IFileURLs,
} from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import FileDropzone from "./FileDropzone"
import FileUploader, { Props } from "./FileUploader"
import {
  ErrorStatus,
  UploadFileInfo,
  UploadedStatus,
  UploadingStatus,
} from "./UploadFileInfo"

const createFile = (): File => {
  return new File(["Text in a file!"], "filename.txt", {
    type: "text/plain",
    lastModified: 0,
  })
}

const buildFileUploaderStateProto = (
  fileUrlsArray: IFileURLs[]
): FileUploaderStateProto =>
  new FileUploaderStateProto({
    uploadedFileInfo: fileUrlsArray.map(
      fileUrls =>
        new UploadedFileInfoProto({
          fileId: fileUrls.fileId,
          fileUrls,
          name: "filename.txt",
          size: 15,
        })
    ),
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

const getProps = (elementProps: Partial<FileUploaderProto> = {}): Props => {
  return {
    element: FileUploaderProto.create({
      id: "id",
      type: [],
      maxUploadSizeMb: 50,
      ...elementProps,
    }),
    width: 0,
    disabled: false,
    widgetMgr: new WidgetStateManager({
      sendRerunBackMsg: jest.fn(),
      formsDataChanged: jest.fn(),
    }),
    // @ts-expect-error
    uploadClient: {
      uploadFile: jest.fn().mockImplementation(() => {
        return Promise.resolve()
      }),
      fetchFileURLs: jest.fn().mockImplementation((acceptedFiles: File[]) => {
        return Promise.resolve(
          acceptedFiles.map(file => {
            return new FileURLsProto({
              fileId: file.name,
              uploadUrl: file.name,
              deleteUrl: file.name,
            })
          })
        )
      }),
      deleteFile: jest.fn(),
    },
  }
}

/** Return a strongly-typed wrapper.state("files") */
function getFiles(
  wrapper: ShallowWrapper<FileUploader> | ReactWrapper<FileUploader>,
  statusType?: string
): UploadFileInfo[] {
  const result = wrapper.state<UploadFileInfo[]>("files")
  return statusType != null
    ? result.filter(f => f.status.type === statusType)
    : result
}

describe("FileUploader widget RTL tests", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<FileUploader {...props} />)
    const fileUploaderElement = screen.getByTestId("stFileUploader")
    expect(fileUploaderElement).toBeInTheDocument()
  })

  it("sets initial value properly non-empty", () => {
    const props = getProps()
    const { element, widgetMgr } = props

    widgetMgr.setFileUploaderStateValue(
      element,
      buildFileUploaderStateProto([
        new FileURLsProto({
          fileId: "filename.txt",
          uploadUrl: "filename.txt",
          deleteUrl: "filename.txt",
        }),
      ]),
      { fromUi: false }
    )

    render(<FileUploader {...props} />)
    const fileNameNode = screen.getByText("filename.txt")
    expect(fileNameNode).toBeInTheDocument()
  })

  it("shows a label", () => {
    const props = getProps({ label: "Test label" })
    render(<FileUploader {...props} />)

    const labelNode = screen.getByText("Test label")
    expect(labelNode).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      label: "Test label",
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<FileUploader {...props} />)

    const labelNode = screen.getByText("Test label")
    expect(labelNode).toBeInTheDocument()
    expect(labelNode).not.toBeVisible()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      label: "Test label",
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<FileUploader {...props} />)

    const labelNode = screen.getByText("Test label")
    expect(labelNode).toBeInTheDocument()
    expect(labelNode).not.toBeVisible()
  })
})

// TODO(vdonato / kajarenc): Eventually convert all of these tests to use RTL.
// Ideally, we'd like to migrate off enzyme while we're working on the big
// `st.file_uploader` refactor, but migration of a lot of our existing tests
// would be very involved. Thus, we'll punt on the especially difficult tests
// for now and revisit rewriting them after the feature branch has landed on
// `develop`.
describe("FileUploader widget enzyme tests", () => {
  it("uploads a single selected file", async () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader
    const fileDropzone = wrapper.find(FileDropzone)
    fileDropzone.props().onDrop([createFile()], [])

    // Wait one tick to simulate FileURLsProto being received from the server,
    // after which we begin the file upload.
    await process.nextTick

    // We should have 1 file in the uploading state
    expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(1)
    expect(getFiles(wrapper).length).toBe(1)
    expect(getFiles(wrapper)[0].status.type).toBe("uploading")
    expect(instance.status).toBe("updating")

    // WidgetStateManager should not have been called yet
    expect(props.widgetMgr.setFileUploaderStateValue).not.toHaveBeenCalled()

    // Wait a tick to simulate the file upload completing.
    await process.nextTick

    // After upload completes, our file should be "uploaded" and our status
    // should be "ready". The file should also have a new ID, returned by our
    // uploadFile endpoint.
    const files = getFiles(wrapper)
    expect(files.length).toBe(1)
    const fileStatus = files[0].status as UploadedStatus
    expect(fileStatus.type).toBe("uploaded")
    expect(fileStatus.fileId).toBe("filename.txt")
    expect(fileStatus.fileUrls).toEqual({
      deleteUrl: "filename.txt",
      fileId: "filename.txt",
      uploadUrl: "filename.txt",
    })
    expect(instance.status).toBe("ready")

    // And WidgetStateManager should have been called with the file's ID
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([fileStatus.fileUrls]),
      {
        fromUi: true,
      }
    )
  })

  it("uploads a single file even if too many files are selected", async () => {
    const props = getProps({ multipleFiles: false })
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
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

    await process.nextTick
    expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(1)

    // We should have 3 files. One will be uploading, the other two will
    // be in the error state.
    expect(getFiles(wrapper).length).toBe(3)
    expect(getFiles(wrapper, "uploading").length).toBe(1)
    expect(getFiles(wrapper, "error").length).toBe(2)
    expect(instance.status).toBe("updating")

    await process.nextTick

    // Our upload has completed, our file should now be "uploaded", and
    // our status should now be "ready".
    expect(getFiles(wrapper).length).toBe(3)
    expect(getFiles(wrapper, "uploaded").length).toBe(1)
    expect(getFiles(wrapper, "error").length).toBe(2)
    expect(instance.status).toBe("ready")

    const uploadedFile = getFiles(wrapper, "uploaded")[0]
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([
        (uploadedFile.status as UploadedStatus).fileUrls,
      ]),
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
    await process.nextTick

    const origFile = getFiles(wrapper)[0]
    expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(1)
    expect(getFiles(wrapper).length).toBe(1)
    expect(getFiles(wrapper, "uploading").length).toBe(1)

    await process.nextTick

    expect(getFiles(wrapper, "uploaded").length).toBe(1)
    expect(instance.status).toBe("ready")

    // Upload a replacement file
    fileDropzone.props().onDrop([createFile()], [])
    await process.nextTick

    const replacementFile = getFiles(wrapper)[0]
    expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(2)
    expect(getFiles(wrapper).length).toBe(1)
    expect(getFiles(wrapper, "uploading").length).toBe(1)

    // Ensure that our new UploadFileInfo has a different ID than the first
    // file's.
    expect(replacementFile.id).not.toBe(origFile.id)

    await process.nextTick

    // Ensure that our final status is as expected.
    expect(getFiles(wrapper, "uploaded").length).toBe(1)
    expect(instance.status).toBe("ready")
  })

  it("uploads multiple files, even if some have errors", async () => {
    const props = getProps({ multipleFiles: true })
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
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

    await process.nextTick

    expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(2)

    // We should have two files uploading, and 3 showing an error.
    expect(getFiles(wrapper).length).toBe(5)
    expect(getFiles(wrapper, "uploading").length).toBe(2)
    expect(getFiles(wrapper, "error").length).toBe(3)
    expect(instance.status).toBe("updating")

    await process.nextTick

    // When our upload completes, our uploading files should now be uploaded
    expect(getFiles(wrapper).length).toBe(5)
    expect(getFiles(wrapper, "uploaded").length).toBe(2)
    expect(getFiles(wrapper, "error").length).toBe(3)
    expect(instance.status).toBe("ready")

    // WidgetStateManager should have been called with the server IDs
    // of the uploaded files.
    const uploadedFiles = getFiles(wrapper, "uploaded")
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto(
        uploadedFiles.map(f => (f.status as UploadedStatus).fileUrls)
      ),
      {
        fromUi: true,
      }
    )
  })

  it("can delete completed upload", async () => {
    const props = getProps({ multipleFiles: true })
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    const wrapper = mount(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader

    // Upload two files
    // @ts-expect-error -- dummy value being used as first arg
    instance.uploadFile("someUploadUrl1", createFile())
    // @ts-expect-error -- dummy value being used as first arg
    instance.uploadFile("someUploadUrl2", createFile())

    await process.nextTick

    const initialFiles = getFiles(wrapper)
    expect(initialFiles.length).toBe(2)
    expect(getFiles(wrapper, "uploaded").length).toBe(2)
    expect(instance.status).toBe("ready")

    // WidgetStateManager should have been called with our two file IDs
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(1)

    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenLastCalledWith(
      props.element,
      buildFileUploaderStateProto(
        initialFiles.map(f => (f.status as UploadedStatus).fileUrls)
      ),
      {
        fromUi: true,
      }
    )

    // Delete the first file
    instance.deleteFile(initialFiles[0].id)

    await process.nextTick

    // We should only have a single file - the second file from the original
    // upload.
    expect(getFiles(wrapper).length).toBe(1)
    expect(getFiles(wrapper)[0]).toBe(initialFiles[1])
    expect(instance.status).toBe("ready")

    // WidgetStateManager should have been called with the file ID
    // of the remaining file. This should be the second time WidgetStateManager
    // has been updated.
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(2)
    const newWidgetValue = [initialFiles[1]]
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenLastCalledWith(
      props.element,
      buildFileUploaderStateProto(
        newWidgetValue.map(f => (f.status as UploadedStatus).fileUrls)
      ),
      {
        fromUi: true,
      }
    )
  })

  it("can delete in-progress upload", async () => {
    const props = getProps({ multipleFiles: true })
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    const wrapper = mount(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader

    // Upload a file...
    // @ts-expect-error -- dummy value being used as first arg
    instance.uploadFile("someFileUrl", createFile())
    expect(getFiles(wrapper, "uploading").length).toBe(1)
    expect(instance.status).toBe("updating")

    const fileId = getFiles(wrapper)[0].id

    // and then immediately delete it before upload "completes"
    instance.deleteFile(fileId)

    // Wait for the update
    await process.nextTick

    expect(getFiles(wrapper).length).toBe(0)
    expect(instance.status).toBe("ready")

    // WidgetStateManager will still have been called once, with a single
    // value - the id that was last returned from the server.
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(1)
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([]),
      {
        fromUi: true,
      }
    )
  })

  it("can delete file with ErrorStatus", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader
    const fileDropzone = wrapper.find(FileDropzone)

    // Drop a file with an error status
    fileDropzone
      .props()
      .onDrop([], [{ file: createFile(), errors: [INVALID_TYPE_ERROR] }])

    expect(getFiles(wrapper, "error").length).toBe(1)

    // Delete the file
    instance.deleteFile(getFiles(wrapper)[0].id)

    // File should be gone
    expect(getFiles(wrapper).length).toBe(0)
  })

  it("handles upload error", async () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader

    // Upload a file that will be rejected by the server
    props.uploadClient.uploadFile = jest
      .fn()
      .mockRejectedValue(new Error("random upload error!"))

    // @ts-expect-error -- dummy value being used as first arg
    instance.uploadFile("someFileUploadUrl", createFile())

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

  it("changes status + adds file attributes when dropping a File", async () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const fileDropzone = wrapper.find(FileDropzone)
    fileDropzone.props().onDrop([createFile()], [])
    await process.nextTick

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

  it("does not reset on disconnect", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const instance = wrapper.instance() as FileUploader
    // @ts-expect-error
    const resetSpy = jest.spyOn(instance, "reset")
    wrapper.setProps({ disabled: true })
    expect(resetSpy).not.toHaveBeenCalled()
  })

  it("resets its value when form is cleared", async () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setIntValue")

    const wrapper = shallow(<FileUploader {...props} />)

    // Upload a single file
    const fileDropzone = wrapper.find(FileDropzone)
    fileDropzone.props().onDrop([createFile()], [])

    // Wait two ticks so that fileUrls can be fetched and our file uploaded.
    await process.nextTick
    await process.nextTick

    let files = getFiles(wrapper)
    expect(files).toHaveLength(1)
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([
        (files[0].status as UploadedStatus).fileUrls,
      ]),
      {
        fromUi: true,
      }
    )

    // "Submit" the form
    props.widgetMgr.submitForm("form")
    wrapper.update()

    // Our widget should be reset, and the widgetMgr should be updated
    files = getFiles(wrapper)
    expect(files).toHaveLength(0)
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([]),
      {
        fromUi: true,
      }
    )
  })
})
