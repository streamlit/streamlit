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

import axios from "axios"

import { IFileURLs } from "@streamlit/protobuf"

import { FileUploadClient } from "~lib/FileUploadClient"
import { WidgetInfo } from "~lib/WidgetStateManager"
import { UploadFileInfo } from "~lib/components/widgets/FileUploader/UploadFileInfo"

interface CreateUploadFileParams {
  getNextLocalFileId: () => number
  addFiles: (files: UploadFileInfo[]) => void
  updateFile: (id: number, fileInfo: UploadFileInfo) => void
  uploadClient: FileUploadClient
  element: WidgetInfo
  onUploadProgress: (e: ProgressEvent, id: number) => void
  onUploadComplete: (id: number, fileURLs: IFileURLs) => void
}

export const createUploadFileHandler =
  ({
    getNextLocalFileId,
    addFiles,
    updateFile,
    uploadClient,
    element,
    onUploadProgress,
    onUploadComplete,
  }: CreateUploadFileParams) =>
  (fileURLs: IFileURLs, file: File): void => {
    // Create an UploadFileInfo for this file and add it to our state.
    const cancelToken = axios.CancelToken.source()
    const uploadingFileInfo = new UploadFileInfo(
      file.name,
      file.size,
      getNextLocalFileId(),
      {
        type: "uploading",
        cancelToken,
        progress: 1,
      }
    )
    addFiles([uploadingFileInfo])

    uploadClient
      .uploadFile(
        {
          formId: "", // TODO[kajarnec] fix this probably with uploadFile refactoring
          ...element,
        },
        fileURLs.uploadUrl as string,
        file,
        e => onUploadProgress(e, uploadingFileInfo.id),
        cancelToken.token
      )
      .then(() => onUploadComplete(uploadingFileInfo.id, fileURLs))
      .catch(err => {
        // If this was a cancel error, we don't show the user an error -
        // the cancellation was in response to an action they took.
        if (!axios.isCancel(err)) {
          updateFile(
            uploadingFileInfo.id,
            uploadingFileInfo.setStatus({
              type: "error",
              errorMessage: err ? err.toString() : "Unknown error",
            })
          )
        }
      })
  }
