/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import axios, { CancelToken } from "axios"
import { SessionInfo } from "lib/SessionInfo"
import { BaseUriParts, buildHttpUri } from "lib/UriUtil"
import { getCookie } from "lib/utils"

/**
 * Handles uploading files to the server.
 */
export class FileUploadClient {
  private readonly getServerUri: () => BaseUriParts | undefined

  public constructor(getServerUri: () => BaseUriParts | undefined) {
    this.getServerUri = getServerUri
  }

  /**
   * Upload a file to the server. It will be associated with this browser's sessionID.
   *
   * @param widgetId: the ID of the FileUploader widget that's doing the upload.
   * @param files: the files to upload.
   * @param onUploadProgress: an optional function that will be called repeatedly with progress events during the upload.
   * @param cancelToken: an optional axios CancelToken that can be used to cancel the in-progress upload.
   */
  public async uploadFiles(
    widgetId: string,
    files: File[],
    onUploadProgress?: (progressEvent: any) => void,
    cancelToken?: CancelToken
  ): Promise<void> {
    const serverURI = this.getServerUri()
    if (serverURI === undefined) {
      throw new Error("Cannot upload file: not connected to a server")
    }

    const form = new FormData()
    form.append("sessionId", SessionInfo.current.sessionId)
    form.append("widgetId", widgetId)
    for (const file of files) {
      form.append(file.name, file)
    }

    await axios.request({
      cancelToken: cancelToken,
      url: buildHttpUri(serverURI, "upload_file"),
      method: "POST",
      data: form,
      onUploadProgress,
      withCredentials: true,
      headers: {
        "X-Xsrftoken": getCookie("_xsrf"),
      },
    })
  }
}
