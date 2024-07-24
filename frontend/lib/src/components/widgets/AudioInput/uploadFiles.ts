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

import _ from "lodash"
import { WidgetStateManager, FileUploadClient } from "@streamlit/lib"
import {
  FileUploaderState as FileUploaderStateProto,
  IFileURLs,
  UploadedFileInfo as UploadedFileInfoProto,
} from "@streamlit/lib/src/proto"
import { ensureError } from "@streamlit/lib/src/util/ErrorHandling"
import { WidgetInfo } from "@streamlit/lib/src/WidgetStateManager"

type SuccessfulUpload = {
  fileUrl: IFileURLs
  file: File
}

type FailedUpload = {
  file: File
  error: Error
}

export const uploadFiles = async ({
  files,
  uploadClient,
  widgetMgr,
  widgetInfo,
}: {
  files: File[]
  uploadClient: FileUploadClient
  widgetMgr: WidgetStateManager
  widgetInfo: WidgetInfo
}): Promise<{
  successfulUploads: SuccessfulUpload[]
  failedUploads: FailedUpload[]
}> => {
  let fileUrls: IFileURLs[] = []

  try {
    fileUrls = await uploadClient.fetchFileURLs(files)
  } catch (e) {
    console.error("Error fetching file URLs")
    return {
      successfulUploads: [],
      failedUploads: files.map(file => ({ file, error: ensureError(e) })),
    }
  }

  const filesWithUrls = _.zip(files, fileUrls)

  const successfulUploads: SuccessfulUpload[] = []
  const failedUploads: FailedUpload[] = []

  await Promise.all(
    filesWithUrls.map(async ([file, fileUrl]) => {
      if (!file || !fileUrl || !fileUrl.uploadUrl || !fileUrl.fileId) {
        console.error("No upload URL found")
        return { file, fileUrl, error: new Error("No upload URL found") }
      }

      try {
        await uploadClient.uploadFile(
          { id: fileUrl.fileId, formId: widgetInfo.formId || "" }, // TODO SEE IF DOWNSTREAM LOGIC CAN BE SIMPLIFIED
          fileUrl.uploadUrl,
          file,
          e => console.log(e)
        )
        successfulUploads.push({ fileUrl, file })
      } catch (e) {
        const error = ensureError(e)
        failedUploads.push({ file, error })
      }
    })
  )

  widgetMgr.setFileUploaderStateValue(
    widgetInfo,
    new FileUploaderStateProto({
      uploadedFileInfo: successfulUploads.map(
        ({ file, fileUrl }) =>
          new UploadedFileInfoProto({
            fileId: fileUrl.fileId,
            fileUrls: fileUrl,
            name: file.name,
            size: file.size,
          })
      ),
    }),
    {
      fromUi: true,
    },
    undefined
  )

  return { successfulUploads, failedUploads }
}
