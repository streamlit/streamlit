/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import React from "react"
import { render } from "@streamlit/lib/src/test_util"
import userEvent from "@testing-library/user-event"

import {
  FileUploader as FileUploaderProto,
  FileUploaderState as FileUploaderStateProto,
  FileURLs as FileURLsProto,
  UploadedFileInfo as UploadedFileInfoProto,
  IFileURLs,
} from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import FileUploader, { Props } from "./FileUploader"

const createFile = (filename = "filename.txt"): File => {
  return new File(["Text in a file!"], filename, {
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
          name: fileUrls.fileId,
          size: 15,
        })
    ),
  })

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

describe("FileUploader widget RTL tests", () => {
  it("uploads a single file upload", async () => {
    const user = userEvent.setup()
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZoneInput = screen.getByTestId(
      "stDropzoneInput"
    ) as HTMLInputElement

    const myFile = createFile()

    await user.upload(fileDropZoneInput, myFile)

    const fileName = screen.getByTestId("stUploadedFile")
    expect(fileName.textContent).toContain("filename.txt")
    expect(fileDropZoneInput.files?.[0]).toEqual(myFile)

    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename.txt",
          uploadUrl: "filename.txt",
          deleteUrl: "filename.txt",
        },
      ]),
      {
        fromUi: true,
      }
    )
  })
  it("uploads a single file even if too many files are selected", async () => {
    const props = getProps({ multipleFiles: false })
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZone = screen.getByTestId(
      "stFileUploadDropzone"
    ) as HTMLElement

    const myFiles = [
      new File(["Text in a file!"], "filename1.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["Text in an another file!"], "filename2.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["Another text in an another file!"], "filename3.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
    ]

    fireEvent.drop(fileDropZone, {
      dataTransfer: {
        types: ["Files", "Files", "Files"],
        files: myFiles,
      },
    })

    await waitFor(() =>
      expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(1)
    )

    const fileElements = screen.getAllByTestId("stUploadedFile")
    // We should have 3 files. One will be uploading, the other two will
    // be in the error state.
    expect(fileElements.length).toBe(3)
    expect(fileElements[0].textContent).toContain("filename1.txt")

    const errors = screen.getAllByTestId("stUploadedFileErrorMessage")

    expect(errors.length).toBe(2)
    expect(errors[0].textContent).toContain("Only one file is allowed.")
    expect(errors[1].textContent).toContain("Only one file is allowed.")

    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename1.txt",
          uploadUrl: "filename1.txt",
          deleteUrl: "filename1.txt",
        },
      ]),
      {
        fromUi: true,
      }
    )
  })
  it("replaces file on single file uploader", async () => {
    const user = userEvent.setup()
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZoneInput = screen.getByTestId(
      "stDropzoneInput"
    ) as HTMLInputElement

    const firstFile = createFile()

    await user.upload(fileDropZoneInput, firstFile)

    const fileName = screen.getByTestId("stUploadedFile")
    expect(fileName.textContent).toContain("filename.txt")
    expect(fileDropZoneInput.files?.[0]).toEqual(firstFile)

    expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(1)

    const secondFile = new File(["Another text in a file"], "filename2.txt", {
      type: "text/plain",
      lastModified: 0,
    })

    // Upload a replacement file
    await user.upload(fileDropZoneInput, secondFile)

    const currentFiles = screen.getAllByTestId("stUploadedFile")
    expect(currentFiles.length).toBe(1)
    expect(currentFiles[0].textContent).toContain("filename2.txt")
    expect(fileDropZoneInput.files?.[0]).toEqual(secondFile)
    expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(2)
  })

  it("uploads multiple files, even if some have errors", async () => {
    const props = getProps({ multipleFiles: true, type: [".txt"] })
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZone = screen.getByTestId(
      "stFileUploadDropzone"
    ) as HTMLElement

    const myFiles = [
      new File(["Text in a file!"], "filename1.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["Text in a file?"], "filename2.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["Another PDF file"], "anotherpdffile.pdf", {
        type: "application/pdf",
        lastModified: 0,
      }),
    ]

    fireEvent.drop(fileDropZone, {
      dataTransfer: {
        types: ["Files"],
        files: myFiles,
        items: myFiles.map(file => ({
          kind: "file",
          type: file.type,
          getAsFile: () => file,
        })),
      },
    })

    await waitFor(() =>
      expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(2)
    )

    const fileNames = screen.getAllByTestId("stUploadedFile")
    expect(fileNames.length).toBe(3)

    const errorFileNames = screen.getAllByTestId("stUploadedFileErrorMessage")
    expect(errorFileNames.length).toBe(1)

    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename1.txt",
          uploadUrl: "filename1.txt",
          deleteUrl: "filename1.txt",
        },
        {
          fileId: "filename2.txt",
          uploadUrl: "filename2.txt",
          deleteUrl: "filename2.txt",
        },
      ]),
      {
        fromUi: true,
      }
    )
  })

  it("can delete completed upload", async () => {
    const user = userEvent.setup()
    const props = getProps({ multipleFiles: true })
    jest.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZoneInput = screen.getByTestId(
      "stDropzoneInput"
    ) as HTMLInputElement

    // Upload two files
    await user.upload(fileDropZoneInput, createFile("filename1.txt"))
    await user.upload(fileDropZoneInput, createFile("filename2.txt"))

    const fileNames = screen.getAllByTestId("stUploadedFile")
    expect(fileNames.length).toBe(2)
    expect(fileNames[0].textContent).toContain("filename2.txt")
    expect(fileNames[1].textContent).toContain("filename1.txt")

    // WidgetStateManager should have been called with our two file IDs and first time with empty state
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(3)

    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenLastCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename1.txt",
          uploadUrl: "filename1.txt",
          deleteUrl: "filename1.txt",
        },
        {
          fileId: "filename2.txt",
          uploadUrl: "filename2.txt",
          deleteUrl: "filename2.txt",
        },
      ]),
      {
        fromUi: true,
      }
    )

    const firstDeleteBtn = screen.getAllByTestId("fileDeleteBtn")[0]

    await user.click(within(firstDeleteBtn).getByRole("button"))

    // We should only have a single file - the second file from the original upload list (filename1.txt).
    const fileNamesAfterDelete = screen.getAllByTestId("stUploadedFile")
    expect(fileNamesAfterDelete.length).toBe(1)
    expect(fileNamesAfterDelete[0].textContent).toContain("filename1.txt")

    // WidgetStateManager should have been called with the file ID
    // of the remaining file. This should be the fourth time WidgetStateManager
    // has been updated.
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(4)
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenLastCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename1.txt",
          uploadUrl: "filename1.txt",
          deleteUrl: "filename1.txt",
        },
      ]),
      {
        fromUi: true,
      }
    )
  })
})
