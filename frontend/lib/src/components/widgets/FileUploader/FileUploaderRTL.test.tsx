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
import { screen } from "@testing-library/react"
import React from "react"
import { FileError } from "react-dropzone"
import { render } from "@streamlit/lib/src/test_util"
import userEvent from "@testing-library/user-event"

import {
  FileUploader as FileUploaderProto,
  FileUploaderState as FileUploaderStateProto,
  FileURLs as FileURLsProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  UploadedFileInfo as UploadedFileInfoProto,
  IFileURLs,
} from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
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

describe("FileUploader widget RTL tests", () => {
  it("uploads rtl a single file upload", async () => {
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
})
