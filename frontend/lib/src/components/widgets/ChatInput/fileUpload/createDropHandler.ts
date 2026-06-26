/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { zip } from "lodash-es"
import { ErrorCode as FileErrorCode, FileRejection } from "react-dropzone"

import {
  ChatInput as ChatInputProto,
  FileURLs as FileURLsProto,
  IFileURLs,
} from "@streamlit/protobuf"

import { UploadFileInfo } from "~lib/components/shared/UploadedFile/UploadFileInfo"
import { FileUploadClient } from "~lib/FileUploadClient"
import { getRejectedFileInfo } from "~lib/util/FileHelper"

import { validateFileType } from "./fileUploadUtils"

interface CreateDropHandlerParams {
  acceptMultipleFiles: boolean
  maxFileSize: number
  uploadClient: FileUploadClient
  uploadFile: (fileURLs: FileURLsProto, file: File) => void
  addFiles: (files: UploadFileInfo[]) => void
  getNextLocalFileId: () => number
  deleteExistingFiles: () => void
  onUploadComplete: () => void
  element: ChatInputProto
}

/**
 * Validates files against type and size constraints, separating them into
 * accepted and rejected lists. This validation is necessary because:
 * 1. Directory uploads (webkitdirectory) bypass react-dropzone's validation
 * 2. Retry uploads call the drop handler directly, bypassing react-dropzone
 */
const filterFiles = (
  files: File[],
  element: ChatInputProto,
  maxFileSize: number
): { accepted: File[]; rejected: FileRejection[] } => {
  const accepted: File[] = []
  const rejected: FileRejection[] = []

  files.forEach(file => {
    // Check file size first
    if (file.size > maxFileSize) {
      rejected.push({
        file,
        errors: [
          {
            code: FileErrorCode.FileTooLarge,
            message: `File is too large. Maximum size is ${maxFileSize} bytes.`,
          },
        ],
      })
      return
    }

    // Check file type
    const validation = validateFileType(file, element.fileType)
    if (!validation.isValid) {
      rejected.push({
        file,
        errors: [
          {
            code: FileErrorCode.FileInvalidType,
            message: validation.errorMessage || "File type not allowed.",
          },
        ],
      })
      return
    }

    accepted.push(file)
  })

  return { accepted, rejected }
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
    element,
  }: CreateDropHandlerParams) =>
  (acceptedFiles: File[], rejectedFiles: FileRejection[]): void => {
    // Always validate files - this catches files that bypass react-dropzone's
    // validation, such as:
    // 1. Directory uploads (webkitdirectory bypasses react-dropzone)
    // 2. Retry uploads (dropHandler is called directly, bypassing react-dropzone)
    if (acceptedFiles.length > 0) {
      const { accepted, rejected } = filterFiles(
        acceptedFiles,
        element,
        maxFileSize
      )
      acceptedFiles = accepted
      rejectedFiles = [...rejectedFiles, ...rejected]
    }

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

    // When uploads bypass react-dropzone (e.g. pasting multiple files), more
    // than one valid file can reach here even in single-file mode. Keep the
    // first file and reject the rest, mirroring the drag-and-drop behavior.
    if (!acceptMultipleFiles && acceptedFiles.length > 1) {
      const [firstFile, ...extraFiles] = acceptedFiles
      acceptedFiles = [firstFile]
      rejectedFiles = [
        ...rejectedFiles,
        ...extraFiles.map(file => ({
          file,
          errors: [
            {
              code: FileErrorCode.TooManyFiles,
              message: "Only one file is allowed.",
            },
          ],
        })),
      ]
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
            return new UploadFileInfo(
              f.name,
              f.size,
              getNextLocalFileId(),
              {
                type: "error",
                errorMessage,
              },
              f
            )
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
