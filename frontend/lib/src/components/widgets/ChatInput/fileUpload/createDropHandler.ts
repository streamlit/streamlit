/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import zip from "lodash/zip"
import { ErrorCode as FileErrorCode, FileRejection } from "react-dropzone"

import { FileURLs as FileURLsProto, IFileURLs } from "@streamlit/protobuf"

import { UploadFileInfo } from "~lib/components/widgets/FileUploader/UploadFileInfo"
import { FileUploadClient } from "~lib/FileUploadClient"
import { getRejectedFileInfo } from "~lib/util/FileHelper"

interface CreateDropHandlerParams {
  acceptMultipleFiles: boolean
  maxFileSize: number
  uploadClient: FileUploadClient
  uploadFile: (fileURLs: FileURLsProto, file: File) => void
  addFiles: (files: UploadFileInfo[]) => void
  getNextLocalFileId: () => number
  deleteExistingFiles: () => void
  onUploadComplete: () => void
}

export const createDropHandler =
  ({
    acceptMultipleFiles,
    maxFileSize,
    uploadClient,
    uploadFile,
    addFiles,
    getNextLocalFileId,
    deleteExistingFiles,
    onUploadComplete,
  }: CreateDropHandlerParams) =>
  (acceptedFiles: File[], rejectedFiles: FileRejection[]): void => {
    // If only single file upload is allowed but multiple were dropped/selected,
    // all files will be rejected by default. In this case, we take the first
    // valid file into acceptedFiles, and reject the rest.
    if (
      !acceptMultipleFiles &&
      acceptedFiles.length === 0 &&
      rejectedFiles.length > 1
    ) {
      const firstFileIndex = rejectedFiles.findIndex(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- TODO: Fix this
        file => file.errors?.[0].code === FileErrorCode.TooManyFiles
      )

      if (firstFileIndex >= 0) {
        acceptedFiles.push(rejectedFiles[firstFileIndex].file)
        rejectedFiles.splice(firstFileIndex, 1)
      }
    }

    if (!acceptMultipleFiles && acceptedFiles.length > 0) {
      deleteExistingFiles()
    }

    uploadClient
      .fetchFileURLs(acceptedFiles)
      .then((fileURLsArray: IFileURLs[]) => {
        zip(fileURLsArray, acceptedFiles).forEach(
          ([fileURLs, acceptedFile]) => {
            uploadFile(fileURLs as FileURLsProto, acceptedFile as File)
          }
        )
      })
      .catch((errorMessage: string) => {
        addFiles(
          acceptedFiles.map(f => {
            return new UploadFileInfo(f.name, f.size, getNextLocalFileId(), {
              type: "error",
              errorMessage,
            })
          })
        )
      })

    // Create an UploadFileInfo for each of our rejected files, and add them to
    // our state.
    if (rejectedFiles.length > 0) {
      const rejectedInfos = rejectedFiles.map(rejected =>
        getRejectedFileInfo(rejected, getNextLocalFileId(), maxFileSize)
      )
      addFiles(rejectedInfos)
    }

    onUploadComplete()
  }
