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

import { CancelToken } from "axios"
import { ExtendedFile } from "lib/FileHelper"
import HttpClient from "lib/HttpClient"
import { SessionInfo } from "lib/SessionInfo"

/**
 * Handles uploading files to the server.
 */
export class FileUploadClient extends HttpClient {
  /**
   * Upload a file to the server. It will be associated with this browser's sessionID.
   *
   * @param widgetId: the ID of the FileUploader widget that's doing the upload.
   * @param files: the files to upload.
   * @param onUploadProgress: an optional function that will be called repeatedly with progress events during the upload.
   * @param cancelToken: an optional axios CancelToken that can be used to cancel the in-progress upload.
   * @param replace: an optional boolean to indicate if the file should replace existing files associated with the widget.
   */
  public async uploadFiles(
    widgetId: string,
    files: ExtendedFile[],
    totalFiles?: number,
    onUploadProgress?: (progressEvent: any) => void,
    cancelToken?: CancelToken,
    replace?: boolean
  ): Promise<void> {
    const form = new FormData()
    form.append("sessionId", SessionInfo.current.sessionId)
    form.append("widgetId", widgetId)

    // We need to send totalFiles in order to reduce reruns for multiple file uploads.
    // We are uploading files in parallel so that if one file fails, the rest do not.
    // Because these are happening in parallel, the server needs to know how many files
    // are expected before trigger a rerun as reruns can be expensive.
    form.append("totalFiles", (totalFiles || files.length).toString())
    if (replace) form.append("replace", "true")
    for (const file of files) {
      form.append(file.id || file.name, file, file.name)
    }

    await this.request("upload_file", {
      cancelToken,
      method: "POST",
      data: form,
      onUploadProgress,
    })
  }

  public async delete(widgetId: string, fileId: string): Promise<void> {
    await this.request(
      `upload_file/${SessionInfo.current.sessionId}/${widgetId}/${fileId}`,
      { method: "DELETE" }
    )
  }
}
